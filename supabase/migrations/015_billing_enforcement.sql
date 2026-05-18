-- supabase/migrations/015_billing_enforcement.sql
-- Phase 5 (Billing) DB enforcement spine.
-- Freemium limits MUST be authoritative at the DB layer (PAY-04) — bypassing the
-- UI must not circumvent them. This migration ships before any billing UI or
-- Edge Function so the barrier exists before any CTA references it.
--
-- Contents:
--   * subscriptions UNIQUE(user_id) constraint + created_at column
--   * ai_generations log table (owner-only RLS)
--   * get_effective_plan()      — D-05 lazy-by-date plan resolver, no cron
--   * check_quiz_limit()        — BEFORE INSERT trigger on quizzes (D-09)
--   * check_question_limit()    — BEFORE INSERT trigger on questions (D-09)
--   * get_ai_window_start()     — D-12 rolling-30-day window anchor
--   * get_usage()               — D-13 single-call usage RPC
--
-- References: PAY-01, PAY-04, PAY-05. Decisions D-05, D-06, D-08, D-09, D-11..D-14.
-- All functions are SECURITY DEFINER + SET search_path = public (Pitfall 3).

-- ===========================================================================
-- Task 1: subscriptions constraint/column, ai_generations table, plan resolver
-- ===========================================================================

-- ─── subscriptions: UNIQUE(user_id) ─────────────────────────────────────────
-- migration 006 created subscriptions without a unique constraint; one
-- subscription row per user is required so get_effective_plan() / get_usage()
-- can rely on a single authoritative row. Guarded for idempotency.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_unique'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- ─── subscriptions: created_at column ───────────────────────────────────────
-- migration 006 omitted created_at; get_ai_window_start() anchors the rolling
-- AI window to the subscription start date (D-12).
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ─── ai_generations ─────────────────────────────────────────────────────────
-- One row per AI generation with created_at — the authoritative AI usage log
-- (D-11). Counted over a rolling 30-day window by get_usage() (D-12).
CREATE TABLE IF NOT EXISTS ai_generations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

-- Window-count lookups are by (user_id, created_at) — index DESC for recency.
CREATE INDEX IF NOT EXISTS ai_generations_user_created_idx
  ON ai_generations (user_id, created_at DESC);

-- Owner-only RLS — AI generation is owner-only, NO anon policy at all (T-05-04).
-- Always (SELECT auth.uid()), never bare auth.uid() (initPlan optimization).
DROP POLICY IF EXISTS "owner_own_ai_generations" ON ai_generations;
CREATE POLICY "owner_own_ai_generations"
  ON ai_generations TO authenticated
  USING  ( user_id = (SELECT auth.uid()) )
  WITH CHECK ( user_id = (SELECT auth.uid()) );

-- ─── get_effective_plan(p_user_id uuid) → plan_type ─────────────────────────
-- D-05: revocation is lazy-by-date. The effective plan is 'pro' only when an
-- 'active' subscription row exists AND current_period_end > now() — no cron job
-- ever flips the status. D-06: subscriptions is the single source of truth for
-- the current plan; profiles.plan is NOT consulted.
CREATE OR REPLACE FUNCTION get_effective_plan(p_user_id uuid)
RETURNS plan_type
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan plan_type;
BEGIN
  SELECT 'pro'::plan_type
  INTO v_plan
  FROM subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND current_period_end > now()
  LIMIT 1;

  RETURN COALESCE(v_plan, 'free'::plan_type);
END;
$$;

GRANT EXECUTE ON FUNCTION get_effective_plan(uuid) TO authenticated;

-- ===========================================================================
-- Task 2: enforcement triggers + usage RPCs
-- ===========================================================================

-- ─── check_quiz_limit() — BEFORE INSERT trigger fn on quizzes ───────────────
-- D-09: the trigger is the primary enforcement barrier, effective even against
-- direct client DB queries. A Free owner is blocked at the 4th quiz.
-- D-08: only NEW quiz creation is blocked — existing quizzes stay editable.
CREATE OR REPLACE FUNCTION check_quiz_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Pro owners have no quiz limit.
  IF get_effective_plan(NEW.owner_id) = 'pro'::plan_type THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM quizzes
  WHERE owner_id = NEW.owner_id;

  IF v_count >= 3 THEN
    -- Literal token QUIZ_LIMIT_EXCEEDED — the frontend matches
    -- error.message.includes('QUIZ_LIMIT_EXCEEDED') (Pitfall 7).
    RAISE EXCEPTION 'QUIZ_LIMIT_EXCEEDED: Free plan is limited to 3 quizzes. Upgrade to Pro for unlimited quizzes.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_quiz_limit ON quizzes;
CREATE TRIGGER enforce_quiz_limit
  BEFORE INSERT ON quizzes
  FOR EACH ROW
  EXECUTE FUNCTION check_quiz_limit();

-- ─── check_question_limit() — BEFORE INSERT trigger fn on questions ─────────
-- D-09: blocks the 11th question for a Free owner at the DB level.
-- The owner is resolved through the parent quiz row.
CREATE OR REPLACE FUNCTION check_question_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_count integer;
BEGIN
  SELECT owner_id INTO v_owner
  FROM quizzes
  WHERE id = NEW.quiz_id;

  -- Pro owners have no question limit.
  IF get_effective_plan(v_owner) = 'pro'::plan_type THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM questions
  WHERE quiz_id = NEW.quiz_id;

  IF v_count >= 10 THEN
    -- Literal token QUESTION_LIMIT_EXCEEDED — matched by the frontend (Pitfall 7).
    RAISE EXCEPTION 'QUESTION_LIMIT_EXCEEDED: Free plan is limited to 10 questions per quiz. Upgrade to Pro for unlimited questions.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_question_limit ON questions;
CREATE TRIGGER enforce_question_limit
  BEFORE INSERT ON questions
  FOR EACH ROW
  EXECUTE FUNCTION check_question_limit();

-- ─── get_ai_window_start(p_user_id uuid) → timestamptz ──────────────────────
-- D-12: the monthly AI limit window is a rolling 30-day window anchored to the
-- subscription start date (or, absent a subscription, the registration date).
-- The window start is the most recent 30-day boundary at or before now().
CREATE OR REPLACE FUNCTION get_ai_window_start(p_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anchor timestamptz;
BEGIN
  -- Anchor: latest active subscription's created_at, else profile registration.
  SELECT s.created_at
  INTO v_anchor
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_anchor IS NULL THEN
    SELECT p.created_at INTO v_anchor
    FROM profiles p
    WHERE p.id = p_user_id;
  END IF;

  -- Fallback for safety — should not happen for a valid user.
  v_anchor := COALESCE(v_anchor, now());

  -- Most recent 30-day boundary at or before now().
  RETURN v_anchor
       + FLOOR(EXTRACT(EPOCH FROM (now() - v_anchor)) / (30 * 86400))
       * INTERVAL '30 days';
END;
$$;

GRANT EXECUTE ON FUNCTION get_ai_window_start(uuid) TO authenticated;

-- ─── get_usage() → json ─────────────────────────────────────────────────────
-- D-13: the client reads {plan, quizzes_used, quizzes_limit, ai_used, ai_limit,
-- period_end} in a single RPC call. D-14: Free AI limit = 10/month, Pro = 30.
CREATE OR REPLACE FUNCTION get_usage()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
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

  -- current_period_end of the active, unexpired subscription (NULL for Free).
  SELECT current_period_end INTO v_period_end
  FROM subscriptions
  WHERE user_id = v_user_id
    AND status = 'active'
    AND current_period_end > now()
  LIMIT 1;

  RETURN json_build_object(
    'plan',          v_plan,
    'quizzes_used',  v_quizzes_used,
    'quizzes_limit', CASE WHEN v_is_pro THEN NULL ELSE 3 END,
    'ai_used',       v_ai_used,
    'ai_limit',      CASE WHEN v_is_pro THEN 30 ELSE 10 END,
    'period_end',    v_period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_usage() TO authenticated;
