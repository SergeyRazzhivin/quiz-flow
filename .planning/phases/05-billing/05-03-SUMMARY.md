---
phase: 05-billing
plan: 03
subsystem: billing
tags: [frontend, fsd, pinia, billing, payment, yookassa, vue]
requires:
  - get_usage() RPC (migration 015)
  - create-payment Edge Function
  - QUIZ_LIMIT_EXCEEDED / QUESTION_LIMIT_EXCEEDED / AI_LIMIT_EXCEEDED tokens
provides:
  - usePaymentStore (usage state, createPayment, handleLimitError)
  - PricingCards + ProStatusBanner components
  - BillingWidget + BillingPage
  - /billing route + AppHeader Тарифы link
affects: [AppHeader, router]
tech-stack:
  added: []
  patterns:
    - composition-API Pinia store with try/catch/finally + toast discipline
    - props-driven display components, store action as the only side effect
    - thin page → widget shell composing a feature slice (3-widgets)
    - vue-sonner action API for the upsell toast
key-files:
  created:
    - src/4-features/payment/model/usePaymentStore.ts
    - src/4-features/payment/model/payment.test.ts
    - src/4-features/payment/ui/PricingCards.vue
    - src/4-features/payment/ui/ProStatusBanner.vue
    - src/4-features/payment/ui/pricingComponents.test.ts
    - src/3-widgets/BillingWidget.vue
    - src/2-pages/BillingPage.vue
  modified:
    - src/1-app/router/index.ts
    - src/3-widgets/AppHeader.vue
decisions:
  - "D-07: no cancel-subscription concept — PAY-05 satisfied purely by expiration"
  - "D-15: two side-by-side Free/Pro cards with feature lists, current plan highlighted"
  - "D-16: monthly (490 ₽) / yearly (4 490 ₽) period toggle"
  - "D-17: Pro owners see status banner with active-until date + Продлить подписку"
  - "D-18: Тарифы header link + limit-error upsell toast with Перейти на Pro action"
metrics:
  duration: ~12m
  completed: "2026-05-18"
  tasks: "3 of 4 (Task 4 = visual human-verify, auto-approved in --auto chain)"
---

# Phase 5 Plan 03: Billing Frontend Slice Summary

The billing frontend vertical slice: a `payment` FSD feature (`usePaymentStore` + `PricingCards` + `ProStatusBanner`), the `BillingWidget` shell, the thin `BillingPage`, the `/billing` route, the AppHeader "Тарифы" link, and the freemium limit-error upsell handler.

## What Was Built

- **`src/4-features/payment/model/usePaymentStore.ts`** — composition-API Pinia store (`'payment'`). `fetchUsage()` calls `get_usage` RPC and throws on rpc error (no silent free fallback); `isProActive` computed is true only for `plan === 'pro'` with a future `period_end`; `createPayment(period)` POSTs to the `create-payment` EF with the session JWT and redirects via `window.location.href = confirmation_url`; `handleLimitError(err)` matches the three literal limit tokens and emits a `toast.error` with a `'Перейти на Pro'` action routing to `/billing`, returning `true`/`false`. Includes `$reset`.
- **`src/4-features/payment/ui/PricingCards.vue`** — Free + Pro card grid (`sm:grid-cols-2`), monthly/yearly segmented toggle with a `Скидка 24%` chip, violet→indigo gradient Pro CTA ("Подписаться" / loading "Переходим к оплате…"), Free-card usage meters wired to `get_usage` data, exact feature-list copy from 05-UI-SPEC. No orange.
- **`src/4-features/payment/ui/ProStatusBanner.vue`** — violet-tinted banner with a `Sparkles` icon, "Pro активен" + "Действует до DD.MM.YYYY" (`toLocaleDateString('ru-RU')`), and an outline "Продлить подписку" button calling `createPayment`.
- **`src/3-widgets/BillingWidget.vue`** — `min-h-[100dvh]` shell, `AppHeader`, `max-w-3xl` main, `onMounted` `fetchUsage` (Pitfall 6: refresh after YooKassa return), loading-skeleton / error / data branches, conditional `ProStatusBanner` above `PricingCards`.
- **`src/2-pages/BillingPage.vue`** — thin assembler delegating to `BillingWidget`.
- **`src/1-app/router/index.ts`** (modified) — added `/billing` route with `meta: { requiresAuth: true }`.
- **`src/3-widgets/AppHeader.vue`** (modified) — added a "Тарифы" `RouterLink` to `/billing` guarded by `v-if="authStore.user"`.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | usePaymentStore + limit-error upsell handler (TDD) | a0a74d1 | src/4-features/payment/model/usePaymentStore.ts, payment.test.ts |
| 2 | PricingCards + ProStatusBanner components (TDD) | ed4c1ac | src/4-features/payment/ui/*.vue, pricingComponents.test.ts |
| 3 | BillingWidget, BillingPage, route, AppHeader link | 9ae3702 | src/3-widgets/BillingWidget.vue, src/2-pages/BillingPage.vue, router, AppHeader |
| 4 | Visual verification of billing page + limit upsell | — | checkpoint:human-verify — auto-approved (--auto chain) |

All automated `<verify>` checks passed: Task 1 (`grep -Ec` token count = 9), Task 2 (`vue-tsc` no errors in either file; 7 behavior tests pass), Task 3 (`to="/billing"` count = 1, router `/billing` count = 1, `steiger src` reports no FSD violations). The Task 1 store has 11 unit tests, all passing.

## Deviations from Plan

None — plan executed exactly as written. The `apikey` header was included on the `create-payment` fetch alongside `Authorization` (standard Supabase Edge Function call convention); the plan's action block listed it explicitly.

## Checkpoint Resolution

Task 4 is a `checkpoint:human-verify` (visual review of the billing page, period toggle, usage meters, YooKassa redirect, ProStatusBanner, and limit-upsell toast). This execution runs as part of an `--auto` chain with `workflow.auto_advance: true`; per auto-mode checkpoint behavior, human-verify checkpoints are auto-approved. The checkpoint is not a package-legitimacy gate, so no explicit human confirmation is required. The orchestrator may surface the verification steps from the plan for the user to review at their convenience.

Requirements PAY-02 (pricing page) and the UI half of PAY-03 (subscribe flow) shipped; PAY-01/PAY-05 enforcement is now surfaced to users via the limit-error upsell toast.

## Self-Check: PASSED

- FOUND: src/4-features/payment/model/usePaymentStore.ts
- FOUND: src/4-features/payment/ui/PricingCards.vue
- FOUND: src/4-features/payment/ui/ProStatusBanner.vue
- FOUND: src/3-widgets/BillingWidget.vue
- FOUND: src/2-pages/BillingPage.vue
- All three per-task commits recorded; 18 unit/behavior tests pass; steiger clean; vue-tsc clean.
