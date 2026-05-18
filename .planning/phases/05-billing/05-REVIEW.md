---
phase: 05-billing
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/1-app/router/index.ts
  - src/2-pages/BillingPage.vue
  - src/3-widgets/AppHeader.vue
  - src/3-widgets/BillingWidget.vue
  - src/4-features/payment/model/payment.test.ts
  - src/4-features/payment/model/usePaymentStore.ts
  - src/4-features/payment/ui/PricingCards.vue
  - src/4-features/payment/ui/ProStatusBanner.vue
  - src/4-features/payment/ui/pricingComponents.test.ts
  - supabase/config.toml
  - supabase/functions/ai-generate-quiz/index.ts
  - supabase/functions/create-payment/index.ts
  - supabase/functions/yookassa-webhook/index.ts
  - supabase/migrations/015_billing_enforcement.sql
findings:
  critical: 3
  warning: 7
  info: 4
  total: 14
status: fixes_applied
fixes_applied: 2026-05-18
fixes_applied_scope: critical+warning
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-18
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The billing phase implements YooKassa payment creation, a payment webhook, and
DB-level freemium enforcement. The architecture is mostly sound — IP allowlist,
idempotency check, atomic insert-then-count for AI limits, and DB triggers as the
authoritative barrier are all present. However the webhook has a serious
**payment-amount integrity gap**: it grants Pro based purely on the `period`
field in metadata and never verifies the actual amount paid, and it does not
check the `paid`/`amount` of the YooKassa object. Several limit-enforcement
edge cases (off-by-one in the AI gate, unverified webhook trust of `period`, and
a missing payment-status verification) need fixing before this ships.

## Critical Issues

### CR-01: Webhook never verifies the amount actually paid

**Status:** FIXED (commit 6269d4e)
**File:** `supabase/functions/yookassa-webhook/index.ts:107-157`
**Issue:** The webhook grants Pro purely from `payload.object.metadata.period`.
It never reads `payload.object.amount` and never compares it against the
expected price (`490.00` monthly / `4490.00` yearly). A `payment.succeeded`
event whose metadata says `period: 'yearly'` but whose amount is `1.00 RUB`
would still grant a full year of Pro. `metadata` is attacker-influenceable only
indirectly, but the integrity guarantee for a payment system must be the
amount, not a free-text label. Also `payload.object.status` is never checked to
equal `succeeded` (relying on `event` name alone — a `payment.canceled` object
carried under a spoofed event name would be processed by the period branch).
**Fix:**
```ts
const obj = payload.object
const amount = obj?.amount?.value          // e.g. "490.00"
const currency = obj?.amount?.currency
const EXPECTED = { monthly: '490.00', yearly: '4490.00' } as const
if (obj?.status !== 'succeeded' || obj?.paid !== true) {
  return respond({ ignored: true }, 200)
}
if (currency !== 'RUB' || EXPECTED[period as 'monthly'|'yearly'] !== amount) {
  console.error('yookassa-webhook: amount mismatch', period, amount)
  return respond({ ignored: true }, 200)
}
```
Derive `period` from the verified amount rather than trusting the metadata
label, or at minimum cross-check the two.

### CR-02: AI monthly limit is off-by-one — allows one extra generation

**Status:** FIXED (commits f158e46, fdd8ae7) — requires human verification (limit logic)
**File:** `supabase/functions/ai-generate-quiz/index.ts:344-374`
**Issue:** The row is inserted first, then counted, then `if (usageCount > aiLimit)`
rejects. With `aiLimit = 10`, the 11th request inserts its row and the count
becomes 11, which triggers rejection — correct. But the 10th request makes the
count `10`, and `10 > 10` is false, so it passes. That is intended (10 allowed).
The real bug: a Free user gets exactly 10, but the gate compares the *post-insert*
count, so the boundary is correct only if no rows are ever orphaned. Rolled-back
rows on count failure (line 363) and over-limit rejections (line 372) are deleted,
but a crash between insert (344) and count (354) leaves a phantom row that
permanently consumes a generation — `ai_generations` has no cleanup. Over time a
user silently loses quota. **Fix:** make the row provisional (e.g. add a
`status`/`job_id` column set only after the `ai_jobs` row is created) and count
only confirmed rows, or tie the `ai_generations` row to the `ai_jobs` row in a
single transaction / RPC so a partial failure cannot leak quota.

### CR-03: `get_usage` Free quiz limit hardcoded as 3 but trigger uses `>= 3` — consistent; the AI window count uses `>=` while RPC anchor differs from gate anchor

**Status:** FIXED (commit f158e46)
**File:** `supabase/migrations/015_billing_enforcement.sql:242-247` vs `supabase/functions/ai-generate-quiz/index.ts:334-340`
**Issue:** `get_usage()` counts `ai_used` against `get_ai_window_start()` which
returns the rolling 30-day boundary anchored to subscription/registration date.
The Edge Function AI gate (`ai-generate-quiz`) *also* calls `get_ai_window_start`,
but on RPC failure silently falls back to `now() - 30 days` (line 337-340). The
two window anchors then diverge: the displayed `ai_used` (RPC anchor) and the
enforced limit (fallback anchor) count different row sets, so a user can be told
"4 of 10 used" while the gate counts 9 and blocks them — or vice versa, letting
them exceed the displayed limit. A billing limit must be enforced and displayed
against the *same* window. **Fix:** if `get_ai_window_start` fails, reject the
request (`return json({ error: 'AI_LIMIT_CHECK_FAILED' }, 500)`) instead of
falling back to a different anchor — never enforce against a window the user
cannot see.

## Warnings

### WR-01: Webhook trusts `period` defaulting to `'monthly'` when metadata missing

**Status:** FIXED (commit 6269d4e)
**File:** `supabase/functions/yookassa-webhook/index.ts:114`
**Issue:** `const period = payload.object?.metadata?.period ?? 'monthly'`. If
`metadata.period` is absent, the webhook silently grants a 30-day Pro period.
Combined with CR-01 (no amount check) this means a malformed-but-IP-valid event
grants Pro. **Fix:** require `period` to be exactly `'monthly'` or `'yearly'`;
otherwise log and `return respond({ ignored: true }, 200)`.

### WR-02: Webhook idempotency upsert keyed on `user_id`, not `yookassa_payment_id`

**Status:** FIXED (commit 6269d4e) — requires human verification (period-extension logic)
**File:** `supabase/functions/yookassa-webhook/index.ts:146-157`
**Issue:** The idempotency SELECT checks `yookassa_payment_id` (correct), but the
upsert uses `onConflict: 'user_id'`. A second, *different* payment by the same
user overwrites the prior `yookassa_payment_id` and `current_period_end` instead
of extending it. A user who renews mid-period loses the remaining days of their
current term — the period is replaced, not extended. **Fix:** when an active
subscription exists, compute the new `current_period_end` from
`GREATEST(now(), existing.current_period_end) + interval`, so renewals stack.

### WR-03: Renew CTA always sends `monthly` regardless of user's current plan

**Status:** FIXED (commits fdd8ae7, c8d5998)
**File:** `src/4-features/payment/ui/ProStatusBanner.vue:23-26`
**Issue:** `handleRenew()` hardcodes `createPayment('monthly')`. A Pro-yearly
subscriber clicking "Продлить подписку" is charged for and granted only a
monthly extension. The comment says "the user can adjust on the YooKassa page"
but the YooKassa hosted page shows a fixed amount — it cannot change the period.
**Fix:** pass the user's current period (derive from `usage` or store it on the
subscription) so renewal matches the active plan.

### WR-04: `fetchUsage` types RPC result with `as UsageData` — no runtime validation

**Status:** FIXED (commit c8d5998)
**File:** `src/4-features/payment/model/usePaymentStore.ts:69-71`
**Issue:** `data as UsageData` blind-casts the RPC payload. If `get_usage`
returns a shape change or `null` (it can `RAISE EXCEPTION` but a partial JSON is
possible), `isProActive` and `PricingCards` dereference undefined fields.
**Fix:** validate required fields (`plan`, numeric counters) before assigning;
treat a malformed payload as an error.

### WR-05: `create-payment` does not persist a pending payment record

**Status:** FIXED (commit bdb2c49)
**File:** `supabase/functions/create-payment/index.ts:103-111`
**Issue:** The function returns `confirmation_url`/`payment_id` but never records
the created payment server-side. The webhook is then the *only* place a payment
is ever known. If the webhook IP allowlist drifts (YooKassa changes ranges) or
the webhook is missed, there is no reconciliation record and no way to detect a
paid-but-not-granted state. **Fix:** insert a `payments`/pending row keyed on
`payment_id` at creation time so the webhook can reconcile and an audit exists.

### WR-06: IPv6 allowlist uses string-prefix match

**Status:** FIXED (commit 6269d4e)
**File:** `supabase/functions/yookassa-webhook/index.ts:40,63-68`
**Issue:** IPv6 membership is `ip.toLowerCase().startsWith('2a02:5180:')`.
Compressed IPv6 forms (`2a02:5180::1`) and zero-omission make string-prefix
matching fragile — an address like `2a02:51800:...` (different network) also
passes the `startsWith` test because there is no separator boundary enforced
after the prefix. **Fix:** parse the IPv6 address into its first two 16-bit
hextets and compare numerically, or require the prefix to be followed by `:`
and a valid hextet.

### WR-07: `period` from webhook metadata not validated before use as branch key

**Status:** FIXED (commit 6269d4e)
**File:** `supabase/functions/yookassa-webhook/index.ts:114,143`
**Issue:** `period` is typed `unknown` (line 99) and used directly in
`period === 'yearly' ? 365 : 30` without a type/allowlist guard. Any non-yearly
value (including objects) silently yields 30 days. Low impact but it is an
unvalidated external input flowing into a grant decision. **Fix:** validate
`period` against `['monthly','yearly']` and reject otherwise (see WR-01).

## Info

### IN-01: `authStore` retrieved but unused in `usePaymentStore`

**File:** `src/4-features/payment/model/usePaymentStore.ts:41-42`
**Issue:** `const authStore = useAuthStore()` is suppressed with an
eslint-disable for `no-unused-vars`. Dead binding. **Fix:** remove the line and
the disable comment, or use it (the create-payment EF already resolves the user
server-side, so it is genuinely unneeded).

### IN-02: `console.error` debug artifacts in shipped client code

**File:** `src/4-features/payment/model/usePaymentStore.ts:73,109`
**Issue:** `console.error('fetchUsage failed', e)` and
`console.error('createPayment failed', e)` ship to the browser console. Minor,
but consider routing through a logging utility consistent with the rest of the
app. **Fix:** use the project logger if one exists; otherwise acceptable.

### IN-03: Magic numbers for AI limits duplicated across layers

**File:** `supabase/functions/ai-generate-quiz/index.ts:331` and `supabase/migrations/015_billing_enforcement.sql:262`
**Issue:** `aiLimit = effectivePlan === 'pro' ? 30 : 10` is duplicated in the EF
and in `get_usage()`. Likewise quiz limit `3` appears in the trigger and the
RPC. If a limit changes, three files must be edited in sync. **Fix:** centralize
limits in one place (a config table or a single SQL function the EF also calls).

### IN-04: `MissingClarification` — `clientIp` empty string passes through to `isYooKassaIp`

**File:** `supabase/functions/yookassa-webhook/index.ts:87-89`
**Issue:** When `x-forwarded-for` is absent, `clientIp` is `''`. `isYooKassaIp('')`
correctly returns false, so behavior is safe — but the empty-string path is
implicit. **Fix:** add an explicit early reject when `clientIp` is empty for
clarity.

---

_Reviewed: 2026-05-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
