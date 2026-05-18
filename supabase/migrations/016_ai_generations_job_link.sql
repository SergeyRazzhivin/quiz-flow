-- 016_ai_generations_job_link.sql
-- CR-02: tie every ai_generations usage row to the ai_jobs row it belongs to.
--
-- Before this change the ai-generate-quiz Edge Function inserted the usage row
-- FIRST and created the ai_jobs row afterwards. A crash between the two left a
-- phantom ai_generations row that permanently consumed one of the owner's
-- monthly AI generations, with no cleanup path — the user silently lost quota.
--
-- With job_id present the EF creates the ai_jobs row first and links the usage
-- row to it; a partial failure can no longer leak quota because the usage row
-- is only ever counted once its owning job exists. ON DELETE CASCADE means a
-- removed job also removes its usage row.

ALTER TABLE ai_generations
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES ai_jobs (id) ON DELETE CASCADE;

-- The window count still scans (user_id, created_at); job_id is set on insert.
COMMENT ON COLUMN ai_generations.job_id IS
  'The ai_jobs row this usage record belongs to (CR-02 — prevents quota leak on partial failure).';

-- WR-03: persist the billing period the subscriber actually paid for so the
-- renew CTA charges the same plan instead of always defaulting to monthly.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS current_period text
  CHECK (current_period IN ('monthly', 'yearly'));

COMMENT ON COLUMN subscriptions.current_period IS
  'The billing period of the active subscription (monthly|yearly) — drives the renew CTA (WR-03).';

-- ─── get_usage() — re-create to expose current_period ───────────────────────
-- Same body as migration 015 plus the period field consumed by ProStatusBanner.
CREATE OR REPLACE FUNCTION get_usage()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid;
  v_plan         plan_type;
  v_is_pro       boolean;
  v_quizzes_used integer;
  v_ai_used      integer;
  v_window_start timestamptz;
  v_period_end   timestamptz;
  v_period       text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_plan   := get_effective_plan(v_user_id);
  v_is_pro := (v_plan = 'pro'::plan_type);

  SELECT COUNT(*) INTO v_quizzes_used
  FROM quizzes
  WHERE owner_id = v_user_id;

  v_window_start := get_ai_window_start(v_user_id);

  SELECT COUNT(*) INTO v_ai_used
  FROM ai_generations
  WHERE user_id = v_user_id
    AND created_at >= v_window_start;

  -- current_period_end / current_period of the active, unexpired subscription.
  SELECT current_period_end, current_period
    INTO v_period_end, v_period
  FROM subscriptions
  WHERE user_id = v_user_id
    AND status = 'active'
    AND current_period_end > now()
  LIMIT 1;

  RETURN json_build_object(
    'plan',           v_plan,
    'quizzes_used',   v_quizzes_used,
    'quizzes_limit',  CASE WHEN v_is_pro THEN NULL ELSE 3 END,
    'ai_used',        v_ai_used,
    'ai_limit',       CASE WHEN v_is_pro THEN 30 ELSE 10 END,
    'period_end',     v_period_end,
    'current_period', v_period
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_usage() TO authenticated;

-- ─── payments — pending payment audit trail (WR-05) ─────────────────────────
-- create-payment records a pending row at YooKassa-payment-creation time so a
-- missed webhook (e.g. IP-allowlist drift) leaves a reconcilable audit record
-- and a paid-but-not-granted state is detectable. The webhook is no longer the
-- only place a payment is ever known.
CREATE TABLE IF NOT EXISTS payments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  yookassa_payment_id  text NOT NULL UNIQUE,
  period               text NOT NULL CHECK (period IN ('monthly', 'yearly')),
  amount               numeric(10, 2) NOT NULL,
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'succeeded', 'canceled')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (user_id);

-- Owner-only read for reconciliation/UX; writes go through service_role EFs
-- only — no INSERT/UPDATE policy for the authenticated role.
DROP POLICY IF EXISTS "owner_own_payments" ON payments;
CREATE POLICY "owner_own_payments"
  ON payments FOR SELECT TO authenticated
  USING ( user_id = (SELECT auth.uid()) );
