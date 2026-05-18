# Phase 5: Billing - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/015_billing_enforcement.sql` | migration | CRUD / transform | `supabase/migrations/013_quiz_stats_rpc.sql` + `007_rls_policies.sql` | exact (RPC + RLS) |
| `supabase/functions/create-payment/index.ts` | edge-function | request-response | `supabase/functions/ai-generate-quiz/index.ts` | exact (owner-auth EF) |
| `supabase/functions/yookassa-webhook/index.ts` | edge-function | event-driven | `supabase/functions/verify-quiz-access/index.ts` | role-match (public EF, service_role) |
| `supabase/functions/ai-generate-quiz/index.ts` (MODIFIED) | edge-function | request-response | itself — extend in place | exact |
| `supabase/config.toml` (MODIFIED) | config | — | existing `[functions.*]` blocks | exact |
| `src/4-features/payment/model/usePaymentStore.ts` | store | CRUD / request-response | `src/4-features/quiz-stats/model/useQuizStatsStore.ts` | exact |
| `src/4-features/payment/ui/PricingCards.vue` | component | display | `src/4-features/quiz-stats/ui/SummaryCards.vue` | role-match |
| `src/4-features/payment/ui/ProStatusBanner.vue` | component | display | `src/4-features/quiz-stats/ui/SummaryCards.vue` | role-match |
| `src/4-features/payment/ui/LimitBlockToast.vue` | component | event-driven | `vue-sonner` usage in `useQuizStatsStore.ts` | partial |
| `src/2-pages/BillingPage.vue` | page | — | `src/2-pages/QuizStatsPage.vue` (+ `QuizStatsWidget.vue` shell) | exact |
| `src/3-widgets/AppHeader.vue` (MODIFIED) | widget | — | itself — add nav RouterLink | exact |
| `src/1-app/router/index.ts` (MODIFIED) | config | — | itself — add `/billing` route | exact |

**Note on migration numbering:** RESEARCH.md proposes `008_billing_enforcement.sql`, but `008` is already taken (`008_storage_covers_policies.sql`) and the latest migration is `014`. The new migration MUST be **`015_billing_enforcement.sql`**.

## Pattern Assignments

### `supabase/migrations/015_billing_enforcement.sql` (migration, CRUD + transform)

**Analog:** `supabase/migrations/013_quiz_stats_rpc.sql` (SECURITY DEFINER RPC pattern) + `007_rls_policies.sql` (RLS dual-policy pattern)

**SECURITY DEFINER RPC pattern with manual auth check** (013, lines 13-27):
```sql
CREATE OR REPLACE FUNCTION get_quiz_stats(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- SECURITY DEFINER bypasses RLS, so we enforce ownership manually.
  SELECT owner_id INTO v_owner_id FROM quizzes WHERE id = p_quiz_id;
  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  ...
```
Copy this shape for `get_usage()` / `get_effective_plan()`. Note 013 uses `LANGUAGE plpgsql SECURITY DEFINER STABLE` and does NOT use `SET search_path = public` — RESEARCH recommends adding `SET search_path = public` to enforcement functions; follow RESEARCH on that point since triggers run in a less predictable context.

**GRANT EXECUTE pattern** (013, line 65):
```sql
-- Only authenticated (owner) role may call this function. No anon grant.
GRANT EXECUTE ON FUNCTION get_quiz_stats(uuid) TO authenticated;
```
Apply the same `GRANT EXECUTE ... TO authenticated` (no anon grant) to `get_usage` and `get_effective_plan`.

**COALESCE-to-empty pattern for JSON aggregation** (013, line 48): `SELECT COALESCE(jsonb_agg(...), '[]'::jsonb)` — reuse so `get_usage()` never returns SQL NULL fields.

**RLS dual-policy pattern for the new `ai_generations` table** (007, lines 11-19, 75-80):
```sql
CREATE POLICY "owner_manage_subscriptions"
  ON subscriptions TO authenticated
  USING  ( user_id = (SELECT auth.uid()) )
  WITH CHECK ( user_id = (SELECT auth.uid()) );
-- No anon access to subscriptions.
```
Copy verbatim shape for `ai_generations` (`user_id = (SELECT auth.uid())`, no anon policy — AI generation is owner-only). **Critical:** always use `(SELECT auth.uid())` not bare `auth.uid()` — 007 header documents this enables Postgres initPlan optimization.

**RLS enable line** (each migration table): `ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;`

---

### `supabase/functions/create-payment/index.ts` (edge-function, request-response)

**Analog:** `supabase/functions/ai-generate-quiz/index.ts` — owner-authenticated EF, `verify_jwt = true` (omitted from config.toml).

**Imports pattern** (ai-generate-quiz, lines 17-19):
```typescript
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { GENERIC_500_MESSAGE, serializeError } from '../_shared/errors.ts'
```

**JSON helper + CORS preflight** (ai-generate-quiz, lines 25, 33-35, 204-206):
```typescript
const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' }
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}
// inside Deno.serve:
if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
```

**Owner auth pattern — Bearer token re-verification** (ai-generate-quiz, lines 209-224):
```typescript
const authHeader = req.headers.get('Authorization')
if (!authHeader) return json({ error: 'Missing authorization header' }, 401)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const token = authHeader.replace('Bearer ', '')
const { data: { user }, error: userError } = await supabase.auth.getUser(token)
if (userError || !user) return json({ error: 'Unauthorized' }, 401)
```
Copy verbatim — this is the canonical owner-auth gate. `user.id` is the trusted caller id; put it in YooKassa `metadata.user_id`, never trust the request body for it (mirrors ai-generate-quiz Pitfall 6 / `owner_id`).

**Input validation pattern** (ai-generate-quiz, lines 251-263): validate and reject unknown values before doing work — apply to the `period` field (`'monthly' | 'yearly'`).

**Error handling — generic message, log detail** (ai-generate-quiz, lines 347-351):
```typescript
} catch (err) {
  console.error('create-payment error:', serializeError(err))
  return json({ error: GENERIC_500_MESSAGE }, 500)
}
```

YooKassa-specific bits (Basic Auth, `Idempotence-Key`, `fetch` to `api.yookassa.ru/v3/payments`) have no in-repo analog — use RESEARCH.md Pattern 1.

---

### `supabase/functions/yookassa-webhook/index.ts` (edge-function, event-driven, public)

**Analog:** `supabase/functions/verify-quiz-access/index.ts` — public EF (`verify_jwt = false`), uses `service_role` client, no Supabase JWT.

**Imports + service_role client** (verify-quiz-access, lines 15-19, 48-51):
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { GENERIC_500_MESSAGE, serializeError } from '../_shared/errors.ts'
// ...
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
```

**Body parse with malformed-JSON guard** (verify-quiz-access, lines 29-37): wrap `await req.json()` in try/catch returning 400 — apply to the webhook payload parse.

**Idempotency check before state change** (NEW pattern — see CLAUDE.md pitfall "ЮKassa webhook idempotency"): `SELECT id FROM subscriptions WHERE yookassa_payment_id = paymentId` via `.maybeSingle()`, return HTTP 200 if found. Use RESEARCH.md Pattern 2. Note: webhook must return HTTP 200 fast for processed/ignored events; return non-200 only to trigger a YooKassa retry.

**Error handling** (verify-quiz-access, lines 138-146): `console.error(serializeError(err))` + generic response. Webhook returns 500 on DB failure (so YooKassa retries) per RESEARCH Pattern 2 — diverges from verify-quiz-access only in status code.

IP allowlist / CIDR check has no in-repo analog — use RESEARCH.md Pattern 2 and Pitfall 1.

---

### `supabase/functions/ai-generate-quiz/index.ts` (MODIFIED — edge-function)

**Analog:** itself. The owner-auth block (lines 209-224) and `json()` helper already exist.

Insert the AI-limit gate **after** user auth (line 224) and **before** the `ai_jobs` insert (line 319), per RESEARCH.md Pattern 4. The existing `PLAN_LIMITS` const (lines 28-31) currently reads `profiles.plan` (line 248) — per D-06 the new AI count gate must resolve plan via `get_effective_plan` RPC (subscriptions = source of truth), not `profiles.plan`. The existing file-size limit logic may keep reading `profiles.plan` or be migrated; planner decides, but the new AI monthly-count limit (D-14: free=10, pro=30) must use `subscriptions`.

---

### `supabase/config.toml` (MODIFIED — config)

**Analog:** existing `[functions.*]` blocks (config.toml, lines 90-112).

Add one block — webhook is public (`verify_jwt = false`); `create-payment` is omitted (defaults to `verify_jwt = true`, like `create-quiz-access`):
```toml
[functions.yookassa-webhook]
verify_jwt = false
```

---

### `src/4-features/payment/model/usePaymentStore.ts` (store, CRUD + request-response)

**Analog:** `src/4-features/quiz-stats/model/useQuizStatsStore.ts`

**Imports + FSD header** (useQuizStatsStore, lines 1-9):
```typescript
// FSD: 4-features — imports from 5-entities and 6-shared only.
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { supabase } from '@shared/api/supabase'
import { useAuthStore } from '@features/auth/model/useAuthStore'
```
`useAuthStore` import is allowed — auth is a foundational feature consumed cross-feature in this repo (also used by `AppHeader`). No other feature-to-feature imports.

**Store shape — composition API store with ref/computed** (useQuizStatsStore, lines 37-44, 120):
```typescript
export const useQuizStatsStore = defineStore('quiz-stats', () => {
  const authStore = useAuthStore()
  const isLoading = ref(false)
  const error    = ref<string | null>(null)
  // ...
  return { stats, accuracy, isPro, isLoading, error, completionRate, loadStats, $reset }
})
```
Name the store `'payment'`. Expose `usage`, `loading`, `error`, `isProActive` (computed), `fetchUsage`, `createPayment`, `$reset`.

**subscriptions read pattern** (useQuizStatsStore, lines 47-62) — note D-06 supersedes this for plan resolution: prefer `supabase.rpc('get_usage')`. But the error discipline is the load-bearing part:
```typescript
// a failed query (network/RLS) must NOT silently downgrade a Pro owner to Free
if (subError) throw subError
```

**RPC call pattern** (useQuizStatsStore, lines 75-77):
```typescript
const { data: statsData, error: statsError } = await (supabase as any).rpc('get_quiz_stats', { p_quiz_id: quizId })
if (statsError) throw statsError
```
Use the same `(supabase as any).rpc('get_usage')` shape for `fetchUsage`.

**Error handling — try/catch/finally with toast** (useQuizStatsStore, lines 96-104):
```typescript
} catch (e) {
  console.error('loadStats failed', e)
  error.value = 'Не удалось загрузить...'
  toast.error('Не удалось загрузить...')
} finally {
  isLoading.value = false
}
```

`createPayment` (calls the `create-payment` EF via `fetch` + session token, then `window.location.href = confirmation_url`) has no exact in-repo analog — use RESEARCH.md Pattern 6.

---

### `src/4-features/payment/ui/PricingCards.vue` & `ProStatusBanner.vue` (component, display)

**Analog:** `src/4-features/quiz-stats/ui/SummaryCards.vue` (props-driven display component in the same FSD slice position). Read it during planning for the card markup, prop typing, and Tailwind class conventions.

**Design tokens** (from CONTEXT.md "Specific Ideas" + repo convention in `QuizStatsWidget.vue`): dark surfaces `bg-neutral-950` / `bg-neutral-900`, borders `border-neutral-800`, text `text-neutral-50` / `text-neutral-400`, rounded `rounded-xl`. CTA gradient per CONTEXT.md: `from-violet-600 to-indigo-600`. Use `@shared/ui/Button.vue` for CTAs (see `AppHeader.vue` import). Icons from `lucide-vue-next` (see `QuizStatsWidget.vue` line 3).

### `src/4-features/payment/ui/LimitBlockToast.vue` (component, event-driven)

**Analog:** `vue-sonner` `toast` usage in `useQuizStatsStore.ts` line 7/100. This is the contextual upsell prompt (D-18). Trigger it from feature stores when a DB trigger / EF returns a limit error — see Shared Patterns "Trigger Error Handling" below.

---

### `src/2-pages/BillingPage.vue` (page — thin assembler)

**Analog:** `src/2-pages/QuizStatsPage.vue` (5-line page delegating to a widget) and the shell in `src/3-widgets/QuizStatsWidget.vue`.

**Thin page pattern** (QuizStatsPage.vue, full file):
```vue
<script setup lang="ts">
import QuizStatsWidget from '@widgets/QuizStatsWidget.vue'
</script>
<template>
  <QuizStatsWidget />
</template>
```
CLAUDE.md caps pages at ~80 lines. Two valid options for planner: (a) mirror QuizStats — create a `BillingWidget.vue` in `3-widgets/` that composes the `payment` feature UI, page delegates to it; (b) since billing uses a single feature slice, the page MAY compose `payment` feature components directly if kept thin. Option (a) is the established repo pattern.

**Widget shell pattern** (QuizStatsWidget.vue, lines 14-31): `onMounted(() => void store.fetchUsage())`, page shell `min-h-[100dvh] bg-neutral-950`, `<AppHeader />`, `<main class="mx-auto max-w-5xl px-4 py-12">`, with loading-skeleton / error / data branches. Reuse this branch structure. Pitfall 6: call `fetchUsage()` in `onMounted` so the page refreshes after the YooKassa `return_url` round-trip.

---

### `src/3-widgets/AppHeader.vue` (MODIFIED — widget)

**Analog:** itself — add a `RouterLink` to `/billing` ("Тарифы") in the existing `<nav>` block (lines 25-39), guarded by `v-if="authStore.user"` like the "/my" link. Copy the existing link classes verbatim:
```vue
<RouterLink v-if="authStore.user" to="/billing"
  class="text-sm text-neutral-300 hover:text-neutral-50">
  Тарифы
</RouterLink>
```

### `src/1-app/router/index.ts` (MODIFIED — config)

**Analog:** itself — add one route, copy the `meta: { requiresAuth: true }` shape (line 19):
```typescript
{ path: '/billing', component: () => import('@pages/BillingPage.vue'), meta: { requiresAuth: true } },
```

## Shared Patterns

### Owner Authentication (Edge Functions)
**Source:** `supabase/functions/ai-generate-quiz/index.ts` lines 209-224
**Apply to:** `create-payment` (verify_jwt=true). NOT the webhook — that is public and uses service_role with no JWT (see `verify-quiz-access`).
Pattern: read `Authorization` header → `createClient` with `SUPABASE_SERVICE_ROLE_KEY` → `supabase.auth.getUser(token)` → 401 on failure. Trust `user.id` only, never the request body.

### Error Handling (Edge Functions)
**Source:** `supabase/functions/_shared/errors.ts` (`GENERIC_500_MESSAGE`, `serializeError`)
**Apply to:** all three EF files (`create-payment`, `yookassa-webhook`, modified `ai-generate-quiz`).
Pattern: `catch (err) { console.error('<fn> error:', serializeError(err)); return json({ error: GENERIC_500_MESSAGE }, 500) }` — log real detail server-side, return generic message to client.

### SECURITY DEFINER + manual auth (DB functions)
**Source:** `supabase/migrations/013_quiz_stats_rpc.sql` lines 13-27, 65
**Apply to:** `get_usage`, `get_effective_plan`, `check_quiz_limit`, `check_question_limit`.
Pattern: `LANGUAGE plpgsql SECURITY DEFINER` + manual ownership/auth check via `auth.uid()` because DEFINER bypasses RLS + `GRANT EXECUTE ... TO authenticated` (no anon grant). RESEARCH adds `SET search_path = public` for trigger functions — follow that (Pitfall 3).

### RLS Dual-Policy
**Source:** `supabase/migrations/007_rls_policies.sql` lines 11-19, 75-80
**Apply to:** new `ai_generations` table.
Pattern: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... TO authenticated USING ( user_id = (SELECT auth.uid()) ) WITH CHECK (...)`. No anon policy (AI generation is owner-only). Always `(SELECT auth.uid())`, never bare `auth.uid()`.

### Trigger / Limit Error Handling (frontend)
**Source:** RESEARCH.md Pitfall 7 + `vue-sonner` usage in `useQuizStatsStore.ts` line 100
**Apply to:** all feature stores that perform a gated insert/action (quiz create, question create, AI generation, share-link create).
Pattern: catch the `PostgrestError`, check `error.message.includes('QUIZ_LIMIT_EXCEEDED' | 'QUESTION_LIMIT_EXCEEDED' | 'AI_LIMIT_EXCEEDED')`, and route to the `LimitBlockToast` upsell instead of a generic error toast (D-18).

### Public Edge Function (verify_jwt=false)
**Source:** `supabase/functions/verify-quiz-access/index.ts` + `supabase/config.toml` lines 84-110
**Apply to:** `yookassa-webhook` only.
Pattern: register `[functions.yookassa-webhook] verify_jwt = false` in config.toml; use `service_role` client; no Supabase JWT; authenticate the caller by other means (IP allowlist for the webhook).

## No Analog Found

| Concern | Role | Data Flow | Reason |
|---------|------|-----------|--------|
| YooKassa REST API call (Basic Auth, `Idempotence-Key`, `fetch` to `api.yookassa.ru`) | external integration | request-response | No payment integration exists yet — use RESEARCH.md Pattern 1 |
| Webhook IP allowlist / CIDR matching | edge-function | event-driven | No IP-validation code in repo — use RESEARCH.md Pattern 2 + Pitfall 1 |
| `confirmation_url` redirect (`window.location.href`) in a store action | store | request-response | No redirect-out flow in existing stores — use RESEARCH.md Pattern 6 |
| Rolling 30-day window SQL (`get_usage` period anchor) | migration | transform | No period-windowed counting exists — use RESEARCH.md Pattern 3 (flagged LOW confidence, A3) |

## Metadata

**Analog search scope:** `src/2-pages`, `src/3-widgets`, `src/4-features`, `src/1-app/router`, `supabase/functions`, `supabase/migrations`
**Files scanned:** ~12 read in full (stores, EFs, migrations, page, widget, header, router, config)
**Pattern extraction date:** 2026-05-18
