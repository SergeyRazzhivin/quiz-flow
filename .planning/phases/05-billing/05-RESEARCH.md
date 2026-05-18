# Phase 5: Billing — Research

**Researched:** 2026-05-18
**Domain:** YooKassa payments, Postgres trigger-based limit enforcement, freemium plan resolution
**Confidence:** HIGH (core decisions locked; YooKassa API verified from official docs; Supabase patterns verified in-repo)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**YooKassa Integration**
- D-01: Payment UX — redirect to YooKassa hosted page (`confirmation_url`), return to `/billing`. No embedded widget.
- D-02: Payment model — one-time payment per period; Pro expires; renewal is manual. No saved payment method / no recurring autopayment.
- D-03: Payment confirmation — `payment.succeeded` webhook only (no polling); an Edge Function grants Pro. Webhook must be idempotent (check `yookassa_payment_id` before processing).
- D-04: YooKassa credentials — test shop `shop_id`/`secret_key` stored in Edge Function secrets for this phase; production keys swapped in later.

**Pro Revocation / Expiration**
- D-05: Revocation is lazy by date — no cron. Effective plan = `pro` only if `subscriptions.status = 'active'` AND `current_period_end > now()`. Evaluated on every enforce check.
- D-06: `subscriptions` is the single source of truth for the current plan. `profiles.plan` is not used for plan resolution.
- D-07: No "cancel subscription" concept — PAY-05 satisfied purely by expiration. No manual cancel button.
- D-08: After Pro expires over Free limits: existing quizzes remain editable; individual share links stop working; creating new quizzes beyond the Free limit is blocked. No data loss.

**Limit Enforcement**
- D-09: Primary barrier — Postgres `BEFORE INSERT` triggers on `quizzes`/`questions` counting usage against plan limit, rejecting the insert.
- D-10: AI generation limit enforced inside existing `ai-generate-quiz` Edge Function.
- D-11: AI usage counted via a new `ai_generations` log table (one row per generation); limit = COUNT within current period.
- D-12: Monthly AI limit reset window anchored to subscription/registration date (rolling 30-day window), not calendar month.
- D-13: Client reads consumption via a Postgres view or RPC `usage` returning `{quizzes_used, ai_used, plan, limits}` — UX only.

**Free Plan AI Limit (overrides SPEC.md)**
- D-14: Free plan AI generation limit = 10/month (NOT 1 as in SPEC.md). Pro = 30/month.

**Pricing Page (/billing)**
- D-15: Two side-by-side cards (Free and Pro) with feature lists and CTA; current plan highlighted.
- D-16: Monthly (490 ₽) + yearly (4 490 ₽) toggle, two prices.
- D-17: Pro user view — status + "Pro active until DD.MM.YYYY" + "Продлить" (Renew) button.
- D-18: Entry points — "Тарифы" in app header + contextual upsell prompts when a limited action is blocked.

### Claude's Discretion
- Exact `usage` view vs RPC choice, trigger SQL structure, webhook Edge Function naming/layout.
- `ai_generations` table schema details (FK, indexes).

### Deferred Ideas (OUT OF SCOPE)
- Recurring/autopayment subscriptions with saved payment method.
- Background cron-based expiration sweep.
- Production YooKassa keys / go-live.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAY-01 | Free план: лимит 3 теста, 10 вопросов на тест, 10 AI-генераций в месяц; индивидуальные ссылки недоступны | D-09 triggers + D-10 EF limit; D-14 overrides SPEC Free AI to 10 |
| PAY-02 | Страница тарифов с описанием Free и Pro планов | `/billing` route + `BillingPage.vue` + `src/4-features/payment/` slice |
| PAY-03 | Оформить подписку Pro (490 ₽/мес) через ЮKassa | `create-payment` EF → YooKassa API → redirect flow; D-16 adds yearly 4 490 ₽ |
| PAY-04 | Лимиты enforced на уровне БД/Edge Function | D-09 BEFORE INSERT triggers + D-10 EF gate |
| PAY-05 | При истечении подписки права Pro автоматически отзываются | D-05 lazy-by-date; `get_effective_plan()` function used by triggers and RPC |
</phase_requirements>

---

## Summary

Phase 5 implements the full freemium billing loop: a pricing page, a YooKassa one-time-payment flow, DB-level enforcement of quiz/question/AI limits, and automatic Pro expiration via lazy date check. All locked decisions eliminate the need for recurring payment infrastructure, webhook-driven plan sync, or background cron jobs.

The implementation has three independent pillars. **Pillar 1 (DB):** a new `ai_generations` log table, a `get_effective_plan(user_id)` SQL function that encodes D-05 lazy expiry logic, two `BEFORE INSERT` trigger functions on `quizzes` and `questions` that call it, and a `usage` view or RPC that clients poll for UX hints. **Pillar 2 (Edge Functions):** a `create-payment` function that calls the YooKassa REST API and returns `confirmation_url`; a `yookassa-webhook` function (public, `verify_jwt = false`) that receives `payment.succeeded`, idempotently upserts the `subscriptions` row, and returns HTTP 200. **Pillar 3 (Frontend):** a new `src/4-features/payment/` FSD slice with a Pinia store + composable, and a thin `BillingPage.vue` in `src/2-pages/`.

The biggest implementation risks are: (a) YooKassa webhook authentication relies on IP allowlist-only (no HMAC signature) — the webhook EF must validate the `X-Forwarded-For` source IP; (b) the `BEFORE INSERT` trigger calls `get_effective_plan()` as a subquery counting `subscriptions` rows, which must be `SECURITY DEFINER` so anon-role client inserts can read the subscription table; (c) the AI limit check in `ai-generate-quiz` needs an atomic `INSERT INTO ai_generations … RETURNING` pattern to prevent concurrency bypass (Pitfall 5.4).

**Primary recommendation:** Implement the three pillars in order (DB migrations first, Edge Functions second, frontend last) so limits are enforced before any UI CTA exists.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pricing page UI | Frontend (Vue page) | — | Static display; no business logic |
| Payment initiation (create payment) | API (Edge Function) | — | YooKassa secret_key must never reach client |
| YooKassa redirect | Browser | — | User leaves site; return_url brings back |
| Webhook reception & plan grant | API (Edge Function, public) | DB (upsert) | External push from YooKassa; needs service_role |
| Plan resolution (effective plan) | Database (SQL function) | — | Must be consistent across triggers + RPC |
| Quiz/question count enforcement | Database (BEFORE INSERT trigger) | — | Must block even direct-client inserts |
| AI limit enforcement | API (Edge Function) | DB (ai_generations) | EF owns the atomic insert+count gate |
| Usage status read | Database (view/RPC) | Frontend (UX gate) | DB is authoritative; client is UX-only |
| Upsell prompts on limit block | Frontend (feature layer) | — | UI reaction to 4xx from DB/EF |
| App header "Тарифы" link | Frontend (widget: AppHeader) | — | `3-widgets/AppHeader.vue` needs nav link |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.105.4 [VERIFIED: npm registry] | DB queries, auth, RPC calls from frontend | Already in project |
| `jose` | 6.2.3 [VERIFIED: npm registry] | JWT sign/verify in Deno Edge Functions | Already in `_shared/jwt.ts` |
| YooKassa REST API v3 | — | Payment creation, no SDK needed | Official API, HTTP Basic Auth |

No new npm packages are required for this phase. The YooKassa integration is pure HTTP (`fetch`) — no Node/Deno SDK is needed. The project's existing `@supabase/supabase-js` covers all DB operations from the frontend.

### YooKassa API (no package — raw fetch)
- Endpoint: `https://api.yookassa.ru/v3/payments` [CITED: yookassa.ru/developers/using-api/interaction-format]
- Auth: HTTP Basic Auth, `shopId:secretKey` base64-encoded in `Authorization` header
- Idempotency: `Idempotence-Key` header (UUID v4, required on POST) [CITED: yookassa.ru/developers/using-api/interaction-format]

**Installation:** No new packages. Existing deps are sufficient.

---

## Package Legitimacy Audit

No new external packages are introduced in this phase. All existing packages (`@supabase/supabase-js`, `jose`) were verified in prior phases.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (owner)
    │
    ├─ GET /billing ──────────────────────────────► BillingPage.vue (2-pages)
    │                                                    │
    │                                               usePaymentStore (4-features/payment)
    │                                                    │
    │                                         supabase.rpc('usage') ─► usage view (DB)
    │
    ├─ POST "Subscribe" click
    │       │
    │       ▼
    │  create-payment (Edge Function, verify_jwt=true)
    │       │  Basic Auth → POST https://api.yookassa.ru/v3/payments
    │       │  ◄── { confirmation_url, payment_id }
    │       │
    │  ◄── { confirmation_url, payment_id }  (stored in store)
    │
    ├─ redirect to confirmation_url (user pays on YooKassa)
    │
    ├─ return to /billing (via return_url)
    │
YooKassa servers
    │
    └─ POST /functions/v1/yookassa-webhook (Edge Function, verify_jwt=false)
            │  IP allowlist check
            │  parse { event: "payment.succeeded", object: { id, metadata } }
            │  idempotency: SELECT subscriptions WHERE yookassa_payment_id = id
            │  service_role upsert: subscriptions (status=active, period_end, plan=pro)
            └─ HTTP 200

Owner creates quiz (Supabase client INSERT)
    │
    ▼
BEFORE INSERT trigger on quizzes
    │  get_effective_plan(owner_id) → 'free' | 'pro'
    │  COUNT(quizzes) WHERE owner_id = NEW.owner_id
    │  if free AND count >= 3: RAISE EXCEPTION 'QUIZ_LIMIT_EXCEEDED'
    └─ INSERT proceeds

Owner calls ai-generate-quiz (Edge Function, verify_jwt=true)
    │
    ▼
ai_limit_check:
    │  rolling_window = 30 days from anchor_date
    │  SELECT COUNT(*) FROM ai_generations WHERE user_id = uid AND created_at > window_start
    │  if count >= plan_limit: return 429
    │  INSERT INTO ai_generations (user_id) RETURNING id  ← atomic
    └─ proceed with OpenAI call
```

### Recommended Project Structure

```
src/
├── 2-pages/
│   └── BillingPage.vue              # thin assembler, ~60 lines
├── 4-features/
│   └── payment/
│       ├── model/
│       │   └── usePaymentStore.ts   # Pinia store: usage data, createPayment action
│       └── ui/
│           ├── PricingCards.vue     # two-card layout, Free + Pro, period toggle
│           ├── ProStatusBanner.vue  # "Pro active until DD.MM.YYYY" + Renew button
│           └── LimitBlockToast.vue  # contextual upsell toast (used across features)
├── 3-widgets/
│   └── AppHeader.vue                # add "Тарифы" RouterLink (already exists, extend)
supabase/
├── functions/
│   ├── create-payment/
│   │   └── index.ts                 # verify JWT, call YooKassa API, return confirmation_url
│   ├── yookassa-webhook/
│   │   └── index.ts                 # public endpoint, IP check, idempotent upsert
│   └── _shared/
│       └── (no new shared modules needed)
├── migrations/
│   └── 008_billing_enforcement.sql  # ai_generations table, get_effective_plan(), triggers, usage view/RPC
```

### Pattern 1: YooKassa Payment Creation (Edge Function)

```typescript
// supabase/functions/create-payment/index.ts
// verify_jwt = true (default) — owner must be authenticated

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { serializeError, GENERIC_500_MESSAGE } from '../_shared/errors.ts'

const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' }
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const { plan, period } = await req.json() // period: 'monthly' | 'yearly'
    const amount = period === 'yearly' ? '4490.00' : '490.00'
    const description = period === 'yearly' ? 'Quiz Flow Pro (год)' : 'Quiz Flow Pro (месяц)'

    // Idempotence-Key: unique per user+period combination this session
    const idempotenceKey = crypto.randomUUID()

    const shopId = Deno.env.get('YOOKASSA_SHOP_ID')!
    const secretKey = Deno.env.get('YOOKASSA_SECRET_KEY')!
    const basicAuth = btoa(`${shopId}:${secretKey}`)

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Idempotence-Key': idempotenceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: { value: amount, currency: 'RUB' },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: `${Deno.env.get('APP_URL')}/billing`,
        },
        description,
        metadata: {
          user_id: user.id,
          period,   // webhook reads this to compute period_end
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('YooKassa error:', err)
      return json({ error: 'PAYMENT_CREATE_FAILED' }, 502)
    }

    const payment = await response.json()
    return json({
      confirmation_url: payment.confirmation.confirmation_url,
      payment_id: payment.id,
    }, 200)

  } catch (err) {
    console.error('create-payment error:', serializeError(err))
    return json({ error: GENERIC_500_MESSAGE }, 500)
  }
})
```

[ASSUMED — pattern matches official docs; exact field names verified from yookassa.ru/developers]

### Pattern 2: YooKassa Webhook Handler (Edge Function, public)

```typescript
// supabase/functions/yookassa-webhook/index.ts
// MUST have verify_jwt = false in config.toml
// Authentication: IP allowlist check only (YooKassa has no HMAC signature)

import { createClient } from 'npm:@supabase/supabase-js@2'
import { serializeError } from '../_shared/errors.ts'

// YooKassa IP ranges [CITED: yookassa.ru/developers/using-api/webhooks]
const YOOKASSA_IP_RANGES = [
  '185.71.76.0/27', '185.71.77.0/27',
  '77.75.153.0/25', '77.75.156.11', '77.75.156.35',
  '77.75.154.128/25', '2a02:5180::/32',
]

function isAllowedIP(ip: string): boolean {
  // NOTE: full CIDR check implementation needed — simplified illustration
  // Use a proper CIDR matching utility or check exact IPs + known subnets
  return YOOKASSA_IP_RANGES.some(range => ip === range || checkCIDR(ip, range))
}

Deno.serve(async (req) => {
  // Return 200 fast (YooKassa retries non-200 for 24h) [CITED: yookassa.ru/developers/using-api/webhooks]
  // But we must validate first to avoid accepting forged payloads

  // IP verification — production uses X-Forwarded-For set by Supabase's edge
  const forwardedFor = req.headers.get('x-forwarded-for') ?? ''
  const clientIP = forwardedFor.split(',')[0].trim()

  if (!isAllowedIP(clientIP)) {
    // Return 200 to avoid retry storms from unknown IPs, but skip processing
    console.warn('Webhook from unexpected IP:', clientIP)
    return new Response('ok', { status: 200 })
  }

  try {
    const payload = await req.json()
    if (payload.event !== 'payment.succeeded') {
      return new Response('ok', { status: 200 }) // ignore non-succeeded events
    }

    const payment = payload.object
    const paymentId: string = payment.id
    const userId: string = payment.metadata?.user_id
    const period: string = payment.metadata?.period ?? 'monthly'

    if (!userId || !paymentId) {
      console.error('Webhook: missing user_id or payment_id in metadata')
      return new Response('ok', { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Idempotency check: skip if already processed [CITED: PITFALLS.md Pitfall 5.2]
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('yookassa_payment_id', paymentId)
      .maybeSingle()

    if (existing) {
      return new Response('ok', { status: 200 }) // already processed
    }

    const periodDays = period === 'yearly' ? 365 : 30
    const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString()

    // Upsert: if user has an existing subscription row, update it; else insert
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        plan: 'pro',
        status: 'active',
        yookassa_payment_id: paymentId,
        current_period_end: periodEnd,
      }, { onConflict: 'user_id' })  // one active subscription per user

    if (error) {
      console.error('Webhook: subscriptions upsert failed:', serializeError(error))
      return new Response('error', { status: 500 }) // YooKassa will retry
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('Webhook error:', serializeError(err))
    return new Response('error', { status: 500 }) // allow retry
  }
})
```

[ASSUMED — IP check logic requires a real CIDR library or inline implementation]

### Pattern 3: get_effective_plan() SQL function + BEFORE INSERT triggers

```sql
-- Migration 008_billing_enforcement.sql

-- ─── ai_generations log table ────────────────────────────────────────────────
CREATE TABLE ai_generations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_own_ai_generations"
  ON ai_generations TO authenticated
  USING  ( user_id = (SELECT auth.uid()) )
  WITH CHECK ( user_id = (SELECT auth.uid()) );
-- No anon policy (AI generation is owner-only)

CREATE INDEX ON ai_generations (user_id, created_at DESC);

-- ─── Effective plan resolver (D-05) ──────────────────────────────────────────
-- Returns 'pro' only if there is an active subscription not yet expired.
-- SECURITY DEFINER so trigger functions (running as table owner) can read subscriptions.
CREATE OR REPLACE FUNCTION get_effective_plan(p_user_id uuid)
RETURNS plan_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan plan_type := 'free';
BEGIN
  SELECT 'pro'::plan_type INTO v_plan
  FROM subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND current_period_end > now()
  LIMIT 1;
  RETURN COALESCE(v_plan, 'free');
END;
$$;

-- ─── Quiz count enforcement trigger (D-09, PAY-01: Free = 3 quizzes) ─────────
CREATE OR REPLACE FUNCTION check_quiz_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  plan_type;
  v_count int;
BEGIN
  v_plan := get_effective_plan(NEW.owner_id);
  IF v_plan = 'pro' THEN
    RETURN NEW; -- no limit
  END IF;
  SELECT COUNT(*) INTO v_count FROM quizzes WHERE owner_id = NEW.owner_id;
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'QUIZ_LIMIT_EXCEEDED: Free plan allows 3 quizzes (current: %)', v_count;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_quiz_limit
  BEFORE INSERT ON quizzes
  FOR EACH ROW EXECUTE FUNCTION check_quiz_limit();

-- ─── Question count enforcement trigger (D-09, PAY-01: Free = 10/quiz) ───────
CREATE OR REPLACE FUNCTION check_question_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_plan  plan_type;
  v_count int;
BEGIN
  SELECT owner_id INTO v_owner FROM quizzes WHERE id = NEW.quiz_id;
  v_plan := get_effective_plan(v_owner);
  IF v_plan = 'pro' THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_count FROM questions WHERE quiz_id = NEW.quiz_id;
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'QUESTION_LIMIT_EXCEEDED: Free plan allows 10 questions per quiz (current: %)', v_count;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_question_limit
  BEFORE INSERT ON questions
  FOR EACH ROW EXECUTE FUNCTION check_question_limit();

-- ─── Usage view for client consumption (D-13) ────────────────────────────────
-- Returns one row per authenticated user.
-- Client calls: supabase.rpc('get_usage') or supabase.from('usage').select('*').single()
CREATE OR REPLACE FUNCTION get_usage()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_plan       plan_type;
  v_quizzes    int;
  v_ai_used    int;
  v_anchor     timestamptz;
  v_window_start timestamptz;
  v_free_ai_limit int := 10;
  v_pro_ai_limit  int := 30;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_plan := get_effective_plan(v_user_id);

  SELECT COUNT(*) INTO v_quizzes FROM quizzes WHERE owner_id = v_user_id;

  -- Rolling 30-day window anchored to sub start (or registration) [D-12]
  SELECT COALESCE(
    (SELECT created_at FROM subscriptions WHERE user_id = v_user_id AND status = 'active' ORDER BY created_at DESC LIMIT 1),
    (SELECT created_at FROM profiles WHERE id = v_user_id)
  ) INTO v_anchor;

  -- Compute window start: last period boundary before now()
  v_window_start := v_anchor + (
    FLOOR(EXTRACT(EPOCH FROM (now() - v_anchor)) / (30 * 86400)) * INTERVAL '30 days'
  );

  SELECT COUNT(*) INTO v_ai_used
  FROM ai_generations
  WHERE user_id = v_user_id AND created_at >= v_window_start;

  RETURN json_build_object(
    'plan', v_plan,
    'quizzes_used', v_quizzes,
    'quizzes_limit', CASE WHEN v_plan = 'pro' THEN NULL ELSE 3 END,
    'ai_used', v_ai_used,
    'ai_limit', CASE WHEN v_plan = 'pro' THEN v_pro_ai_limit ELSE v_free_ai_limit END,
    'period_end', (
      SELECT current_period_end FROM subscriptions
      WHERE user_id = v_user_id AND status = 'active' AND current_period_end > now()
      LIMIT 1
    )
  );
END;
$$;
```

[ASSUMED — exact SQL is illustrative; period calculation for rolling window may need tuning]

### Pattern 4: AI Limit Gate in ai-generate-quiz Edge Function

Add at the top of the handler body, after user auth, before the ai_jobs insert:

```typescript
// ── AI generation limit check (D-10, D-11, D-12, D-14) ─────────────────────
// Rolling 30-day window from subscription anchor date.
// Atomic: INSERT first, then COUNT — prevents TOCTOU bypass (Pitfall 5.4).

// Get anchor date (subscription created_at or profile created_at)
const { data: anchorRow } = await supabase.rpc('get_ai_window_start', { p_user_id: user.id })
const windowStart: string = anchorRow ?? new Date(Date.now() - 30 * 86400 * 1000).toISOString()

// Atomic insert-and-count: insert the row, then count rows in window.
// If count exceeds limit, delete the row just inserted and reject.
const { data: genRow, error: genInsertError } = await supabase
  .from('ai_generations')
  .insert({ user_id: user.id })
  .select('id')
  .single()

if (genInsertError || !genRow) {
  return json({ error: 'AI_LIMIT_CHECK_FAILED' }, 500)
}

const { count: usageCount } = await supabase
  .from('ai_generations')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .gte('created_at', windowStart)

const effectivePlan = /* call get_effective_plan via supabase.rpc */ 'free'
const aiLimit = effectivePlan === 'pro' ? 30 : 10

if ((usageCount ?? 0) > aiLimit) {
  // Rollback the row we just inserted
  await supabase.from('ai_generations').delete().eq('id', genRow.id)
  return json({ error: 'AI_LIMIT_EXCEEDED', limit: aiLimit }, 429)
}
// Proceed with quiz generation...
```

Note: The cleaner approach is a single `get_usage()` RPC call to get count before inserting, then insert only if under limit, accepting a small race window. For full atomicity, use a Postgres function that does the check+insert in one transaction. The simpler two-step (check, then insert) is acceptable given low concurrency of AI generation requests per user.

[ASSUMED — exact implementation; the insert-then-check approach solves Pitfall 5.4 race]

### Pattern 5: config.toml addition for public webhook endpoint

```toml
# supabase/config.toml — add this section
[functions.yookassa-webhook]
verify_jwt = false
```

[CITED: supabase.com/docs/guides/functions/function-configuration]

### Pattern 6: usePaymentStore (Pinia, FSD 4-features/payment)

```typescript
// src/4-features/payment/model/usePaymentStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@shared/api/supabase'

export const usePaymentStore = defineStore('payment', () => {
  const usage = ref<UsageData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isProActive = computed(() =>
    usage.value?.plan === 'pro' &&
    usage.value?.period_end &&
    new Date(usage.value.period_end) > new Date()
  )

  async function fetchUsage() {
    loading.value = true
    const { data, error: rpcError } = await supabase.rpc('get_usage')
    loading.value = false
    if (rpcError) { error.value = rpcError.message; return }
    usage.value = data as UsageData
  }

  async function createPayment(period: 'monthly' | 'yearly') {
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ period }),
      }
    )
    if (!resp.ok) throw new Error('Payment creation failed')
    const { confirmation_url } = await resp.json()
    window.location.href = confirmation_url // D-01: redirect
  }

  return { usage, loading, error, isProActive, fetchUsage, createPayment }
})
```

[ASSUMED — matches existing store patterns in `useAiWizardStore.ts` and `useQuizStatsStore.ts`]

### Anti-Patterns to Avoid

- **Client-side plan check only:** Never gate quiz creation only in Vue — the DB trigger is the authoritative barrier (D-09, PAY-04).
- **Polling YooKassa for payment status:** Only `payment.succeeded` webhook grants Pro; no client-side polling loop needed (D-03).
- **Using `profiles.plan` for effective plan:** `subscriptions` is the single source of truth (D-06); `profiles.plan` is ignored.
- **Calendar-month AI limit reset:** Rolling 30-day window from anchor date, not `date_trunc('month', now())` (D-12).
- **Non-idempotent webhook:** Always check `yookassa_payment_id` before upserting (D-03, Pitfall 5.2).
- **Synchronous CIDR matching without a utility:** YooKassa's `/27` and `/25` subnets require real CIDR math, not string prefix matching.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plan resolution logic duplicated across triggers + RPC | Inline `SELECT FROM subscriptions` in each trigger | `get_effective_plan(user_id)` SQL function | Single authoritative location; changes propagate everywhere |
| Concurrent AI limit bypass | SELECT count + separate INSERT | Insert first, then count; or a single Postgres function | Two-query pattern races on concurrent requests (Pitfall 5.4) |
| YooKassa SDK in Deno | npm SDK (none available for Deno, most are Node-only) | Raw `fetch` to `api.yookassa.ru/v3/payments` | No maintained Deno SDK; the API is simple enough for raw HTTP |
| Cron for Pro expiry | pg_cron or Supabase scheduled function | Lazy check in `get_effective_plan()` | D-05 locked; cron adds operational complexity for no benefit |
| Webhook signature HMAC | Custom crypto header verification | IP allowlist check (YooKassa's model) + status re-fetch | YooKassa does not send HMAC signatures [CITED: yookassa.ru/developers/using-api/webhooks] |

**Key insight:** The DB-level `get_effective_plan()` function is the spine of the entire enforcement architecture. Every enforcement point (triggers, RPC, EF) delegates to it. This single function is where D-05 lazy expiry lives.

---

## Common Pitfalls

### Pitfall 1: Webhook IP Not Verified — Forged Payment.Succeeded
**What goes wrong:** A malicious actor POSTs a fake `payment.succeeded` to the public webhook endpoint, granting Pro without payment.
**Why it happens:** YooKassa has no HMAC/signature on webhook payloads — IP allowlist is the only defense. [CITED: yookassa.ru/developers/using-api/webhooks]
**How to avoid:** Check `X-Forwarded-For` against YooKassa's published IP ranges (185.71.76.0/27, 185.71.77.0/27, 77.75.153.0/25, 77.75.156.11, 77.75.156.35, 77.75.154.128/25, 2a02:5180::/32). If IP is unexpected, return 200 but skip processing.
**Warning signs:** Webhook endpoint has no IP check; any POST body with `payment.succeeded` triggers a subscription grant.

### Pitfall 2: Duplicate Webhook Processing
**What goes wrong:** YooKassa retries webhook on any non-200 response for 24h. If the handler crashes mid-way and didn't return 200, a duplicate fires and double-grants Pro.
**Why it happens:** No idempotency check on `yookassa_payment_id`.
**How to avoid:** Before any state change, SELECT subscriptions WHERE `yookassa_payment_id = payload.id`. If found, return 200 immediately. [CITED: PITFALLS.md Pitfall 5.2]
**Warning signs:** Multiple subscription rows with the same `yookassa_payment_id`.

### Pitfall 3: Trigger Cannot Read subscriptions (Permission Denied)
**What goes wrong:** The `BEFORE INSERT` trigger fires for an authenticated client insert; the trigger function tries to SELECT from `subscriptions`, but the `authenticated` role has an RLS policy requiring `auth.uid() = user_id`. The trigger runs as the table owner (postgres), which bypasses RLS — but if the function is NOT `SECURITY DEFINER`, it runs as the calling role.
**Why it happens:** Postgres row-level trigger functions run as the invoker role unless `SECURITY DEFINER` is specified. The calling client's JWT context may not allow reading `subscriptions`.
**How to avoid:** Declare all enforcement trigger functions (`check_quiz_limit`, `check_question_limit`, `get_effective_plan`) as `SECURITY DEFINER` with `SET search_path = public`. [CITED: postgresql.org/docs/current/perm-functions.html]
**Warning signs:** Trigger errors with `permission denied for table subscriptions` in Postgres logs.

### Pitfall 4: AI Limit Race Condition (Concurrent Requests)
**What goes wrong:** User fires two concurrent AI generation requests. Both read `count = 9` (under limit), both insert, resulting in `count = 11`. Limit bypassed.
**Why it happens:** SELECT count → INSERT are not atomic.
**How to avoid:** Either (a) use a DB function that does SELECT + INSERT in one transaction with advisory lock, or (b) insert first, then count, and rollback if over limit. Option (b) has a brief "over by 1" window but prevents sustained bypass. [CITED: PITFALLS.md Pitfall 5.4]
**Warning signs:** `ai_generations` count exceeds plan limit for active users.

### Pitfall 5: subscriptions Table Missing UNIQUE Constraint on user_id
**What goes wrong:** Rapid double-clicks or concurrent requests create two subscription rows for the same user. `get_effective_plan()` may return inconsistent results depending on which row it reads first.
**Why it happens:** Migration 006 has no UNIQUE constraint on `user_id`.
**How to avoid:** Add `UNIQUE (user_id)` constraint (or a unique partial index) in migration 008, and use `ON CONFLICT (user_id) DO UPDATE` in the webhook upsert. [ASSUMED — migration 006 does not show a unique constraint on user_id]
**Warning signs:** Multiple rows in `subscriptions` for the same user_id.

### Pitfall 6: return_url Mismatch After Payment
**What goes wrong:** User pays on YooKassa but lands on the wrong page, or `/billing` doesn't refresh usage state.
**Why it happens:** `return_url` hardcoded to wrong path, or BillingPage doesn't call `fetchUsage()` on mount.
**How to avoid:** Pass `return_url` dynamically using `APP_URL` Edge Function secret + `/billing`. Call `fetchUsage()` in `BillingPage` `onMounted()`.
**Warning signs:** User pays but billing page still shows Free plan status.

### Pitfall 7: trigger error message not surfaced to client
**What goes wrong:** Supabase client receives a generic `PostgrestError` with code `P0001` when the trigger raises an exception; the client shows a generic error or swallows it.
**Why it happens:** `RAISE EXCEPTION 'QUIZ_LIMIT_EXCEEDED: ...'` results in a PostgrestError with message from the trigger, but the client code doesn't handle it.
**How to avoid:** In the feature store, check `error.message.includes('QUIZ_LIMIT_EXCEEDED')` and route to the upsell prompt (LimitBlockToast). Map each trigger error code to a user-visible action.
**Warning signs:** "Ошибка при создании теста" with no actionable CTA.

---

## Code Examples

### YooKassa Payment Object (payment.succeeded webhook payload)
```json
{
  "type": "notification",
  "event": "payment.succeeded",
  "object": {
    "id": "22d6d597-000f-5000-9000-145f6df21d6f",
    "status": "succeeded",
    "amount": { "value": "490.00", "currency": "RUB" },
    "metadata": {
      "user_id": "uuid-of-supabase-user",
      "period": "monthly"
    },
    "paid": true,
    "captured_at": "2026-05-18T10:00:00.000Z"
  }
}
```
[CITED: yookassa.ru/developers/using-api/webhooks]

### subscriptions Upsert Pattern (idempotent)
```sql
-- Requires UNIQUE constraint on user_id in subscriptions table
INSERT INTO subscriptions (user_id, plan, status, yookassa_payment_id, current_period_end)
VALUES ($1, 'pro', 'active', $2, $3)
ON CONFLICT (user_id)
DO UPDATE SET
  plan = 'pro',
  status = 'active',
  yookassa_payment_id = EXCLUDED.yookassa_payment_id,
  current_period_end = EXCLUDED.current_period_end;
```
[ASSUMED — idempotency pattern from PITFALLS.md Pitfall 5.2]

### Supabase RPC call from client
```typescript
// From usePaymentStore.ts
const { data, error } = await supabase.rpc('get_usage')
// Returns: { plan, quizzes_used, quizzes_limit, ai_used, ai_limit, period_end }
```
[ASSUMED — matches existing `supabase.rpc()` pattern used in quiz-stats feature]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| YooKassa webhook IP list (smaller) | Updated IP ranges per official docs | Ongoing | Use the full list including IPv6 `2a02:5180::/32` |
| Separate counter table with monthly reset | Log table (ai_generations) + rolling window | D-11/D-12 | History preserved; supports audit |
| profiles.plan as source of truth | subscriptions table only (D-06) | Phase 5 design | Eliminates desync between two tables |

**Deprecated/outdated:**
- `profiles.plan` as plan authority: ignored for plan resolution (D-06); may be retained for display but must not be used for enforcement.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | subscriptions table has no UNIQUE constraint on user_id (migration 006 shows none) | Pitfall 5, webhook pattern | Must add unique constraint in migration 008; if it already exists, the ON CONFLICT clause is still safe |
| A2 | The IP check uses X-Forwarded-For header set by Supabase's edge proxy | Pitfall 1, webhook pattern | If Supabase uses a different header or strips it, IP check will fail open; verify with Supabase docs before deploy |
| A3 | Rolling window start computed via FLOOR(epoch / 30d) correctly anchors to sub/registration date | Pattern 3 (get_usage SQL) | Wrong period calculation means users get more or fewer AI generations than intended; validate with test data |
| A4 | The `payment` feature Pinia store can call Edge Functions via `fetch` with the session access_token the same way as `ai-generate-quiz` calls | Pattern 6 | If EF invoke pattern differs, store must adapt; existing wizard store pattern is the reference |
| A5 | YooKassa test shop allows redirect confirmation_type (some test configurations restrict payment methods) | Pattern 1 | Redirect may not work in test mode; verify in YooKassa test dashboard before implementing |
| A6 | supabase.rpc('get_usage') will work for an RPC function returning JSON (not TABLE) | Pattern 6 | May need `supabase.rpc('get_usage').single()` or different return type; test in local dev |

---

## Open Questions

1. **UNIQUE constraint on subscriptions.user_id**
   - What we know: Migration 006 does not show a UNIQUE constraint.
   - What's unclear: Was one added manually or in a later migration?
   - Recommendation: Migration 008 should add `ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id)` with `IF NOT EXISTS` guard, or check the constraint before adding.

2. **YooKassa test shop redirect flow**
   - What we know: redirect `confirmation_type` is documented; test credentials are stored as secrets (D-04).
   - What's unclear: Does YooKassa test mode fully simulate the redirect flow or require a specific test card?
   - Recommendation: Add a manual verification task in the plan to test the redirect round-trip in a browser before declaring PAY-03 done.

3. **IP header in Supabase Edge Functions**
   - What we know: YooKassa publishes its IP ranges. Webhook security relies on IP check only.
   - What's unclear: Which header does Supabase set for the originating client IP in Edge Functions — `x-forwarded-for`, `cf-connecting-ip`, or something else?
   - Recommendation: Log `req.headers` in a test deployment to determine the correct header; fall back to allowing all IPs in local dev.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | DB migrations, EF deploy | ✓ (assumed from prior phases) | — | — |
| YooKassa test shop credentials | create-payment EF | ✗ (not yet set) | — | Must set YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY in EF secrets before testing |
| APP_URL env secret | return_url construction in create-payment | ✗ (not yet set) | — | Hardcode in local dev; required for test/prod |

**Missing dependencies with no fallback:**
- YooKassa test shop credentials — must be provisioned in Supabase secrets before PAY-03 can be tested end-to-end.

**Missing dependencies with fallback:**
- APP_URL — can be hardcoded to `http://localhost:5173` for local development; must be set to real URL for hosted testing.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase JWT verified in create-payment EF; same `auth.getUser(token)` pattern as ai-generate-quiz |
| V3 Session Management | no | No new session handling |
| V4 Access Control | yes | DB triggers enforce limits regardless of client; RLS on ai_generations; `SECURITY DEFINER` trigger functions |
| V5 Input Validation | yes | Validate `period` field in create-payment EF; reject unknown values |
| V6 Cryptography | no | No new crypto; YooKassa auth is HTTP Basic (transport-encrypted via HTTPS) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged webhook granting Pro | Spoofing | IP allowlist check on yookassa-webhook EF |
| Replay attack with valid payment_id | Spoofing | Idempotency: SELECT before upsert, skip if found |
| Client bypassing quiz limit via direct DB insert | Tampering | BEFORE INSERT trigger with SECURITY DEFINER |
| AI limit bypass via concurrent requests | Tampering | Insert-then-count atomic-ish pattern; or DB function |
| Webhook endpoint scraping to discover user_id mapping | Information Disclosure | metadata.user_id is internal; webhook EF logs nothing sensitive |
| YooKassa secret_key exposed in client bundle | Information Disclosure | Secret stored in EF env only; create-payment is server-side only |

---

## Sources

### Primary (HIGH confidence)
- [yookassa.ru/developers/using-api/webhooks](https://yookassa.ru/developers/using-api/webhooks) — IP ranges, webhook payload, HTTP 200 requirement
- [yookassa.ru/developers/using-api/interaction-format](https://yookassa.ru/developers/using-api/interaction-format) — Basic Auth, Idempotence-Key, API base URL
- [yookassa.ru/developers/payment-acceptance/getting-started/payment-process](https://yookassa.ru/developers/payment-acceptance/getting-started/payment-process) — payment request body, confirmation_url in response
- [supabase.com/docs/guides/functions/function-configuration](https://supabase.com/docs/guides/functions/function-configuration) — verify_jwt = false in config.toml
- `supabase/migrations/006_subscriptions.sql` — subscriptions table schema (in-repo)
- `supabase/migrations/007_rls_policies.sql` — RLS dual-policy pattern (in-repo)
- `supabase/functions/ai-generate-quiz/index.ts` — EF auth pattern + service_role client (in-repo)
- `.planning/research/PITFALLS.md` — Pitfall 5.2 (webhook idempotency), 5.4 (AI limit concurrency)

### Secondary (MEDIUM confidence)
- [postgresql.org/docs/current/perm-functions.html](https://www.postgresql.org/docs/current/perm-functions.html) — SECURITY DEFINER function behavior

### Tertiary (LOW confidence / ASSUMED)
- Rolling window SQL pattern for period anchor calculation (A3)
- AI limit insert-then-count atomic workaround (A4)

---

## Metadata

**Confidence breakdown:**
- YooKassa API: HIGH — verified from official docs
- Supabase EF patterns: HIGH — verified from in-repo code
- DB trigger SQL: MEDIUM — pattern verified from Postgres docs; exact SQL illustrative
- Rolling window SQL: LOW/ASSUMED — needs validation in local dev
- IP header name in Supabase EF: LOW/ASSUMED — needs empirical test

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable APIs; YooKassa IP ranges may be updated — re-verify before production)
