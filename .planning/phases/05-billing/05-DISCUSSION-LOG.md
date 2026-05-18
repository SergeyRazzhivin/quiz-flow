# Phase 5: Billing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 05-billing
**Areas discussed:** YooKassa Integration (resumed from checkpoint), Pro Revocation / Expiration, Limit Enforcement, Pricing Page

---

## YooKassa Integration

Completed in a prior session and restored from the discussion checkpoint.

| Question | User's choice |
|----------|---------------|
| How does the user pay? | Redirect to YooKassa hosted page (`confirmation_url`), return to `/billing` |
| Payment model? | One-time payment per period; manual renewal; no saved method |
| Confirming payment? | `payment.succeeded` webhook only |
| YooKassa keys/mode? | Test shop; secrets in Edge Function; production keys later |

---

## Pro Revocation / Expiration

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy check by date | No cron; effective plan computed from status + `current_period_end` | ✓ |
| pg_cron daily | Scheduled job flips expired subscriptions | |

| Option | Description | Selected |
|--------|-------------|----------|
| subscriptions — single source | Plan derived from `subscriptions` only | ✓ |
| profiles.plan cache + subscriptions history | Fast-read cache, desync risk | |

| Option | Description | Selected |
|--------|-------------|----------|
| Expiration only | PAY-05 satisfied by expiration; no cancel button | ✓ |
| Expiration + opt-out of renewal | Add a "don't renew" button | |

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only, no create | Existing content stays, blocked from creating new | |
| Block over limit | Hide/lock content above Free limit | |

**User's choice (last question, free text):** "Тесты остаются, можно изменять, но ссылки перестают работать, новые создавать нельзя."
**Notes:** Existing quizzes remain editable; individual share links (Pro feature) stop working; no new quizzes over the Free limit.

---

## Limit Enforcement

| Question | User's choice |
|----------|---------------|
| Where is the main barrier? | Postgres triggers (free = 10 AI generations/month) |
| Monthly AI counter? | `ai_generations` log table |
| AI reset period anchored to? | Subscription/registration date (rolling window) |
| How does client learn usage? | View/RPC `usage` |

**Notes:** User overrode the SPEC.md Free AI limit (1/мес → 10/мес), confirmed via follow-up ("10"). Pro stays 30/мес.

---

## Pricing Page

| Question | User's choice |
|----------|---------------|
| Layout for Free/Pro? | Two side-by-side cards |
| Include period choice? | Monthly + yearly |
| Pro user view on `/billing`? | Status + date + renew |
| Entry points to `/billing`? | Header link + contextual prompts on limit |

---

## Claude's Discretion

- `usage` view vs RPC implementation choice.
- Trigger SQL structure and webhook Edge Function naming/layout.
- `ai_generations` table schema details.

## Deferred Ideas

- Recurring/autopayment subscriptions with saved payment method.
- Background cron-based expiration sweep.
- Production YooKassa keys / go-live.
