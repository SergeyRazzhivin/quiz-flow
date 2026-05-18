---
phase: 05-billing
plan: 02
subsystem: billing
tags: [edge-function, yookassa, payments, webhook, freemium, ai-limit]
requires:
  - subscriptions table (UNIQUE user_id, current_period_end, yookassa_payment_id)
  - get_effective_plan() RPC
  - get_ai_window_start() RPC
  - ai_generations table
provides:
  - create-payment Edge Function
  - yookassa-webhook Edge Function
  - AI monthly-limit gate in ai-generate-quiz
affects: [ai-generate-quiz, config.toml]
tech-stack:
  added: []
  patterns:
    - owner-auth EF via supabase.auth.getUser(token), service_role client
    - public webhook EF authenticated by IP allowlist (real CIDR mask match)
    - idempotency SELECT on external payment id before state change
    - insert-then-count atomic limit gate (Pitfall 4)
key-files:
  created:
    - supabase/functions/create-payment/index.ts
    - supabase/functions/yookassa-webhook/index.ts
  modified:
    - supabase/functions/ai-generate-quiz/index.ts
    - supabase/config.toml
decisions:
  - "D-01: payment UX redirects to the YooKassa hosted confirmation_url, returns to /billing"
  - "D-02: one-time payment per period; no saved method, manual renewal"
  - "D-03: confirmation via payment.succeeded webhook only, idempotent on yookassa_payment_id"
  - "D-06: AI limit resolves plan via get_effective_plan RPC, not profiles.plan"
  - "D-14: AI monthly limit free=10, pro=30"
  - "D-16: one-time price monthly=490 RUB, yearly=4490 RUB"
metrics:
  duration: ~6m
  completed: "2026-05-18"
  tasks: "3 of 4 (Task 4 = human-UAT, deferred by user)"
---

# Phase 5 Plan 02: YooKassa Payment Edge Functions Summary

YooKassa payment integration: an owner-authed `create-payment` Edge Function that returns a hosted-page `confirmation_url`, a public IP-allowlisted `yookassa-webhook` that idempotently grants Pro on `payment.succeeded`, and the AI monthly-limit gate wired into `ai-generate-quiz` (HTTP 429 before the OpenAI call).

## What Was Built

- **`supabase/functions/create-payment/index.ts`** — owner-authenticated EF. Re-verifies the Bearer token via `supabase.auth.getUser`, validates `period` against an exact `monthly|yearly` allowlist (400 on mismatch), POSTs to `api.yookassa.ru/v3/payments` with Basic Auth + `Idempotence-Key`, amounts 490.00/4490.00 RUB (D-16). `metadata.user_id` is the verified `user.id`, never the request body (T-05-08). Returns `{ confirmation_url, payment_id }` 200; non-ok YooKassa → `PAYMENT_CREATE_FAILED` 502; unexpected → `GENERIC_500_MESSAGE` 500.
- **`supabase/functions/yookassa-webhook/index.ts`** — public service_role EF. Authenticates by IP allowlist over the seven YooKassa ranges; IPv4 ranges use a real octet→int + bitmask CIDR match (no string-prefix), IPv6 `2a02:5180::/32` uses a hextet-boundary prefix check. Untrusted IP → 200 no-op (avoids retry storms). Malformed JSON → 400. Non-`payment.succeeded` events → 200. Idempotency `SELECT ... WHERE yookassa_payment_id` via `.maybeSingle()` before any upsert (T-05-07); existing row → 200. On grant: upsert `plan='pro'`, `status='active'`, `current_period_end` at +30/+365 days, `onConflict: 'user_id'`. DB failure → 500 (YooKassa retries).
- **`supabase/functions/ai-generate-quiz/index.ts`** (modified) — AI monthly-limit gate inserted after the owner-auth block and before the `ai_jobs` insert. Resolves the effective plan via `get_effective_plan` RPC (D-06), `aiLimit` 10 free / 30 pro (D-14), rolling window via `get_ai_window_start` (fallback now-30d). Insert-then-count atomic gate (Pitfall 4): inserts an `ai_generations` row, counts the window, deletes the row and returns HTTP 429 `AI_LIMIT_EXCEEDED` if over limit. Existing file-size limit logic untouched.
- **`supabase/config.toml`** — added `[functions.yookassa-webhook] verify_jwt = false`; `create-payment` stays omitted (defaults to `verify_jwt = true`).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | create-payment EF + config.toml | 6dc0002 | supabase/functions/create-payment/index.ts, supabase/config.toml |
| 2 | yookassa-webhook EF (public, idempotent) | 41b6229 | supabase/functions/yookassa-webhook/index.ts |
| 3 | AI monthly-limit gate in ai-generate-quiz | cc7e322 | supabase/functions/ai-generate-quiz/index.ts |
| 4 | Verify YooKassa round-trip + webhook | — | DEFERRED — human-UAT, see Deferred Verification |

All three automated `<verify>` checks passed: Task 1 (`api.yookassa.ru/v3/payments` count = 1, config block present), Task 2 (token count = 8), Task 3 (token count = 7).

## Deviations from Plan

None — plan executed exactly as written. The IPv6 `2a02:5180::/32` check uses a lowercased hextet-boundary prefix match; this is a correct CIDR test for a /32 IPv6 prefix (the boundary lands exactly on the first two hextets) and not the prohibited subnet string-prefix shortcut, which the plan barred only for the IPv4 `/27`/`/25` subnets.

## Deferred Verification

Task 4 was a `gate="blocking-human"` checkpoint (real YooKassa payment round-trip). The
user chose **"Отложить проверку"** — the Edge Function code is accepted as-is and the plan
proceeds. The live round-trip test is **NOT done** and is carried forward as an outstanding
human-UAT item.

**Outstanding human-UAT item — YooKassa payment round-trip:**

1. Deploy the functions: `supabase functions deploy create-payment`,
   `supabase functions deploy yookassa-webhook`, `supabase functions deploy ai-generate-quiz`.
2. Set Edge Function secrets: `supabase secrets set YOOKASSA_SHOP_ID=... YOOKASSA_SECRET_KEY=... APP_URL=http://localhost:5173`.
3. In the YooKassa test dashboard, register the webhook URL (deployed `yookassa-webhook`
   function URL) for the `payment.succeeded` event.
4. From an authenticated session, invoke `create-payment` with `{ period: 'monthly' }` —
   confirm a `confirmation_url` is returned and the YooKassa hosted page opens.
5. Complete the test payment with a YooKassa test card; confirm redirect back to `/billing`.
6. In the Supabase SQL editor:
   `SELECT plan, status, current_period_end FROM subscriptions WHERE user_id = '<your-uuid>';`
   — expect `pro / active / ~30 days out`.
7. Re-send the same webhook payload manually — confirm no duplicate row and the plan stays
   unchanged (webhook idempotency on `yookassa_payment_id`).

**Status:** DEFERRED (not failed, not verified). Resolve before production billing launch.

## Self-Check: PASSED

- FOUND: supabase/functions/create-payment/index.ts
- FOUND: supabase/functions/yookassa-webhook/index.ts
- FOUND: commit 6dc0002
- FOUND: commit 41b6229
- FOUND: commit cc7e322
