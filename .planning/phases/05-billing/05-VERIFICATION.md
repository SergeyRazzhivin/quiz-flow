---
phase: 05-billing
verified: 2026-05-18T17:11:00Z
status: human_needed
score: 13/13 must-have truth groups verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 12/13
  gaps_closed:
    - "vue-tsc --noEmit passes with no errors (plan 05-03 acceptance criterion)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "YooKassa payment round-trip (deferred from plan 05-02 Task 4)"
    expected: "Deploy create-payment / yookassa-webhook / ai-generate-quiz; set YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY / APP_URL secrets; register the webhook for payment.succeeded; invoke create-payment with {period:'monthly'}, get a confirmation_url, complete a test-card payment, confirm redirect to /billing and subscriptions row = pro/active/~30 days; re-send the same webhook and confirm no double-grant."
    why_human: "Requires deployed Edge Functions, live YooKassa test-shop credentials, and a real payment flow — cannot be verified by static code inspection."
  - test: "Visual review of the /billing page and limit-upsell toast (plan 05-03 Task 4)"
    expected: "Two side-by-side Free/Pro cards, dark theme with violet Pro accent (no orange); period toggle switches Pro price 490 ₽ / 4 490 ₽ with a Скидка 24% chip; Free card shows usage meters and a disabled Текущий план button; Подписаться shows Переходим к оплате… and navigates to YooKassa; a Pro user sees the status banner; a blocked limited action surfaces a toast with a Перейти на Pro action."
    why_human: "Visual appearance, interaction states, and toast UX cannot be verified programmatically. Auto-approved in the --auto chain — never actually reviewed by a human."
---

# Phase 5: Billing Verification Report

**Phase Goal:** An owner can view plan tiers, subscribe to Pro via YooKassa, and have freemium limits enforced automatically at the DB/Edge Function level; Pro access is revoked automatically on cancellation or expiry.
**Verified:** 2026-05-18T17:11:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (commits 20a5750, f5769a5)

## Re-Verification Summary

The single gap from the initial verification — stale test fixtures in
`pricingComponents.test.ts` (and `payment.test.ts`) missing the `current_period`
field added by the WR-03 fix — has been resolved:

- **`npx vue-tsc --noEmit`** → exit 0, no type errors (previously 7 TS2741 errors).
- **`npx vitest run`** → exit 0; 14 test files passed, 1 skipped; 120 tests passed,
  3 todo. `payment.test.ts` 11/11 and `pricingComponents.test.ts` 7/7 both green.
  (The `createPayment failed`/`limit error` lines in stderr are intentional
  console logging from negative-path tests that themselves assert and pass.)

No regressions detected. Score is now 13/13. Status is `human_needed` (not
`passed`) only because two human-UAT items remain outstanding — these are
carried-forward deferred items, not gaps.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Free owner blocked at DB level from a 4th quiz | ✓ VERIFIED | `015...sql:101-132` — `check_quiz_limit()` raises `QUIZ_LIMIT_EXCEEDED` at `v_count >= 3`; `enforce_quiz_limit` BEFORE INSERT trigger attached |
| 2 | Free owner blocked at DB level from an 11th question | ✓ VERIFIED | `015...sql:137-172` — `check_question_limit()` raises `QUESTION_LIMIT_EXCEEDED` at `v_count >= 10`; trigger attached |
| 3 | Expired subscription resolves to 'free' with no cron | ✓ VERIFIED | `get_effective_plan()` `015...sql:71-89` — `status='active' AND current_period_end > now()`, `COALESCE(...,'free')` |
| 4 | Client reads usage in one RPC call | ✓ VERIFIED | `get_usage()` returns plan/quizzes_used/quizzes_limit/ai_used/ai_limit/period_end/current_period; granted to authenticated only |
| 5 | Owner can create a YooKassa payment + get confirmation_url | ✓ VERIFIED | `create-payment/index.ts` — owner-auth gate, period allowlist, POST to `api.yookassa.ru/v3/payments`, returns confirmation_url; store `createPayment()` redirects via `window.location.href` |
| 6 | payment.succeeded webhook grants Pro until period_end | ✓ VERIFIED | `yookassa-webhook/index.ts` — IP allowlist, status/paid/amount verification (CR-01), upsert plan='pro' status='active' |
| 7 | Duplicate webhook does not double-grant | ✓ VERIFIED | Idempotency SELECT on `yookassa_payment_id` via `.maybeSingle()` before any upsert; existing row → 200 |
| 8 | Owner over AI limit rejected with 429 before OpenAI call | ✓ VERIFIED | `ai-generate-quiz/index.ts:393-399` — insert-then-count gate, `AI_LIMIT_EXCEEDED` 429; window-anchor RPC failure now rejects (CR-03 fix) |
| 9 | /billing shows Free vs Pro cards side by side | ✓ VERIFIED | `PricingCards.vue` — `grid-cols-1 sm:grid-cols-2`, two cards, feature lists, Текущий план highlight |
| 10 | Monthly/yearly toggle + Подписаться starts YooKassa flow | ✓ VERIFIED | `PricingCards.vue:20` price 490 ₽ / 4 490 ₽; CTA calls `store.createPayment` |
| 11 | Pro owner sees status banner with active-until date + Продлить | ✓ VERIFIED | `ProStatusBanner.vue` — "Pro активен", `toLocaleDateString('ru-RU')`, renew uses `current_period` (WR-03 fix) |
| 12 | Limit error surfaces an upsell toast with 'Перейти на Pro' | ✓ VERIFIED | `usePaymentStore.handleLimitError()` matches all three tokens, toast action routes to /billing |
| 13 | Pro access revoked automatically on expiry (lazy, no cron) | ✓ VERIFIED | `get_effective_plan` date check + `isProActive` computed mirror; D-07 — no cancel concept, expiry-only |

**Score:** 13/13 truth groups verified. The plan-level acceptance criterion (clean `vue-tsc`) now passes.

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `supabase/migrations/015_billing_enforcement.sql` | ✓ VERIFIED | ai_generations table, get_effective_plan, both triggers, get_usage/get_ai_window_start RPCs; applied to live DB (user confirmed) |
| `supabase/migrations/016_ai_generations_job_link.sql` | ✓ VERIFIED | job_id link (CR-02), subscriptions.current_period (WR-03), payments audit table (WR-05), get_usage re-created; applied to live DB |
| `supabase/functions/create-payment/index.ts` | ✓ VERIFIED | Owner-auth, period allowlist, YooKassa POST, pending payments insert |
| `supabase/functions/yookassa-webhook/index.ts` | ✓ VERIFIED | CIDR IP match, status/amount verification, idempotency, period-extending upsert |
| `supabase/functions/ai-generate-quiz/index.ts` | ✓ VERIFIED | AI gate via get_effective_plan RPC, insert-then-count, 429 |
| `src/4-features/payment/model/usePaymentStore.ts` | ✓ VERIFIED | fetchUsage with runtime validation, createPayment, handleLimitError |
| `src/4-features/payment/ui/PricingCards.vue` | ✓ VERIFIED | Two-card grid, period toggle, gradient CTA |
| `src/4-features/payment/ui/ProStatusBanner.vue` | ✓ VERIFIED | Active-until date, period-correct renew |
| `src/3-widgets/BillingWidget.vue` | ✓ VERIFIED | onMounted fetchUsage, loading/error/data branches |
| `src/2-pages/BillingPage.vue` | ✓ VERIFIED | Thin assembler |
| `src/1-app/router/index.ts` / `AppHeader.vue` | ✓ VERIFIED | /billing route (requiresAuth), Тарифы link guarded by `authStore.user` |
| `src/4-features/payment/ui/pricingComponents.test.ts` | ✓ VERIFIED | 7 fixtures now include `current_period` (commit 20a5750); 7/7 tests pass |
| `src/4-features/payment/model/payment.test.ts` | ✓ VERIFIED | Fixture aligned with `current_period` (commit f5769a5); 11/11 tests pass |

### Key Link Verification

| From | To | Status | Details |
|------|----|--------|---------|
| check_quiz_limit trigger | get_effective_plan | ✓ WIRED | Direct function call inside trigger body |
| get_effective_plan | subscriptions | ✓ WIRED | `status='active' AND current_period_end > now()` |
| yookassa-webhook | subscriptions | ✓ WIRED | service_role upsert `onConflict: 'user_id'` |
| create-payment | api.yookassa.ru | ✓ WIRED | fetch with Basic Auth + Idempotence-Key |
| usePaymentStore.fetchUsage | get_usage RPC | ✓ WIRED | `supabase.rpc('get_usage')` |
| BillingWidget | fetchUsage | ✓ WIRED | onMounted call |
| AppHeader | /billing | ✓ WIRED | RouterLink `to="/billing"` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Whole codebase type-checks | `npx vue-tsc --noEmit` | exit 0, no errors | ✓ PASS |
| Full test suite passes | `npx vitest run` | exit 0; 14 files passed / 1 skipped; 120 tests passed / 3 todo | ✓ PASS |
| YooKassa round-trip | (requires deployed EFs + credentials) | not runnable | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PAY-01 | 05-01, 05-03 | Free limits: 3 quizzes, 10 questions/quiz, AI/month; individual links unavailable | ✓ SATISFIED | DB triggers enforce 3/10; AI gate enforces monthly limit. AI Free limit is 10/month per planning decision D-14 — intentional override of REQUIREMENTS.md PAY-01's "1/month", documented in all three plans |
| PAY-02 | 05-03 | Pricing page with Free/Pro descriptions | ✓ SATISFIED | PricingCards two-card layout, /billing route |
| PAY-03 | 05-02, 05-03 | Subscribe to Pro via YooKassa | ✓ SATISFIED (code) | create-payment EF + store flow; live round-trip is deferred human-UAT |
| PAY-04 | 05-01, 05-02 | Limits enforced at DB/EF level | ✓ SATISFIED | BEFORE INSERT triggers (SECURITY DEFINER) + EF AI gate |
| PAY-05 | 05-01, 05-02, 05-03 | Pro revoked automatically on cancel/expiry | ✓ SATISFIED | Lazy-by-date get_effective_plan; D-07 — expiry-only, no manual cancel |

All 5 phase requirement IDs accounted for. No orphaned requirements.

### Anti-Patterns Found

None. The stale-fixture warning from the initial verification is resolved.
No TBD/FIXME/XXX debt markers in phase-modified files. No stub implementations —
all data flows traced (triggers query real tables, EFs upsert real rows, store
renders RPC data).

### Human Verification Required

1. **YooKassa payment round-trip** — deploy the three Edge Functions, set secrets, register the webhook, complete a test-card payment, confirm Pro grant and webhook idempotency. Deferred by the user in plan 05-02 Task 4; recorded as outstanding human-UAT. Resolve before production billing launch.
2. **Visual review of /billing** — confirm card layout, violet theme (no orange), period toggle pricing, usage meters, redirect behavior, Pro banner, and limit-upsell toast. Plan 05-03 Task 4 was auto-approved in the --auto chain and never reviewed by a human.

### Gaps Summary

No gaps remain. The billing phase goal is functionally achieved: DB triggers
enforce freemium limits authoritatively, the YooKassa payment path and idempotent
webhook are implemented, and Pro revocation is lazy-by-date with no cron. The
sole prior gap — broken `vue-tsc` from stale test fixtures — is fixed; both
`vue-tsc --noEmit` and the full vitest suite now pass clean.

Two human-verification items remain outstanding (the deferred YooKassa live
round-trip and the auto-approved visual review). These are deferred human-UAT
items, not implementation gaps — they keep the status at `human_needed` rather
than `passed`.

---

_Verified: 2026-05-18T17:11:00Z (re-verification)_
_Verifier: Claude (gsd-verifier)_
