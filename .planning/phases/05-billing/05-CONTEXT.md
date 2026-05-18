# Phase 5: Billing - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Owner can subscribe to Pro via YooKassa (one-time payment per period), and freemium limits are enforced at the DB/Edge Function level. Delivers: pricing page (`/billing`), YooKassa payment flow, limit enforcement, and automatic Pro expiration.

Requirements covered: PAY-01 … PAY-05.
</domain>

<decisions>
## Implementation Decisions

### YooKassa Integration (from prior checkpoint)
- **D-01:** Payment UX — redirect to YooKassa hosted page (`confirmation_url`), return to `/billing`. No embedded widget.
- **D-02:** Payment model — one-time payment per period; Pro expires; renewal is manual. No saved payment method / no recurring autopayment.
- **D-03:** Payment confirmation — `payment.succeeded` webhook only (no polling); an Edge Function grants Pro. Webhook must be idempotent (check `yookassa_payment_id` before processing).
- **D-04:** YooKassa credentials — test shop `shop_id`/`secret_key` stored in Edge Function secrets for this phase; production keys swapped in later.

### Pro Revocation / Expiration
- **D-05:** Revocation is **lazy by date** — no cron. Effective plan = `pro` only if `subscriptions.status = 'active'` AND `current_period_end > now()`. Evaluated on every enforce check.
- **D-06:** `subscriptions` is the **single source of truth** for the current plan. `profiles.plan` is not used for plan resolution (avoids desync; drop or ignore it for plan logic).
- **D-07:** No "cancel subscription" concept — one-time payment means PAY-05 is satisfied purely by **expiration**. No manual cancel button.
- **D-08:** After Pro expires with content over Free limits: existing quizzes **remain and stay editable**; individual share links (a Pro feature) **stop working**; creating **new** quizzes beyond the Free limit is blocked. No data loss.

### Limit Enforcement
- **D-09:** Primary barrier — **Postgres triggers** (`BEFORE INSERT` on `quizzes`/`questions`) that count current usage against the plan limit and reject the insert. Works even against direct client DB queries.
- **D-10:** AI generation limit enforced inside the existing `ai-generate-quiz` Edge Function (already `service_role`).
- **D-11:** AI usage counted via a new **`ai_generations` log table** (one row per generation with `created_at`); limit = COUNT within the current period. Provides history.
- **D-12:** Monthly AI limit reset window is anchored to the **subscription/registration date** (rolling 30-day window), not the calendar month.
- **D-13:** Client reads current consumption via a Postgres **view or RPC `usage`** returning `{quizzes_used, ai_used, plan, limits}` in one request — for UX hints ("2 of 3") and button gating. Client-side checks are UX only; DB/EF are authoritative.

### Free Plan AI Limit — OVERRIDES SPEC.md
- **D-14:** Free plan AI generation limit = **10 per month** (NOT 1 as stated in SPEC.md / PAY-01). Pro stays **30/month**. Downstream: SPEC.md "Freemium модель" table and REQUIREMENTS.md PAY-01 must be updated to reflect Free = 10.

### Pricing Page (`/billing`)
- **D-15:** Layout — **two side-by-side cards** (Free and Pro) with feature lists and CTA; the user's current plan is highlighted.
- **D-16:** Period choice — **monthly (490 ₽) + yearly (4 490 ₽)** toggle, two prices. (Expands PAY-03 which mentions only 490 ₽/мес; SPEC.md "Freemium модель" already lists the yearly option.)
- **D-17:** Pro user view on `/billing` — show status + "Pro active until DD.MM.YYYY" + a **"Продлить" (Renew)** button (new one-time payment; extends from `current_period_end`).
- **D-18:** Entry points — "Тарифы" link in the app header **plus** contextual prompts (toast/modal with "Перейти на Pro" CTA) when a limited action is blocked (create quiz/question, AI generation, share link).

### Claude's Discretion
- Exact `usage` view vs RPC choice, trigger SQL structure, and webhook Edge Function naming/layout left to research and planning.
- `ai_generations` table schema details (FK, indexes) left to planning.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs & requirements
- `SPEC.md` — project spec; see "Freemium модель", "subscriptions" table, `PaymentPage.vue` route. NOTE: Free AI limit there (1/мес) is overridden by D-14 (→ 10/мес).
- `.planning/ROADMAP.md` — Phase 5 goal and PAY requirement list.
- `.planning/REQUIREMENTS.md` — PAY-01 … PAY-05 (PAY-01 to be updated per D-14).
- `.planning/research/PITFALLS.md` — YooKassa webhook idempotency, plan-desync pitfalls.

### Database schema
- `supabase/migrations/001_init_profiles.sql` — `profiles`, `plan_type` enum.
- `supabase/migrations/006_subscriptions.sql` — `subscriptions` table (`status`, `yookassa_payment_id`, `current_period_end`).
- `supabase/migrations/007_rls_policies.sql` — RLS pattern to follow for new tables/policies.

### Existing Edge Functions
- `supabase/functions/ai-generate-quiz/` — extend with AI limit check (D-10).
- `supabase/functions/_shared/` — cors/jwt helpers reused by a new YooKassa webhook function.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/functions/_shared/` — shared cors/jwt helpers; reuse for the new YooKassa webhook + create-payment Edge Functions.
- `ai-generate-quiz` Edge Function — already `service_role`; the natural place for the AI monthly-limit gate.
- `subscriptions` table already exists (migration 006) — no new table needed for subscription state.

### Established Patterns
- All tables: RLS enabled with dual policy (authenticated + anon) — new `ai_generations` table and `subscriptions` RLS must follow this.
- Edge Functions use `service_role` and hand-filter sensitive columns.
- FSD: payment feature belongs in `src/4-features/payment/`; `/billing` page is a thin assembler in `src/2-pages/`.

### Integration Points
- No `src/4-features/payment/` slice exists yet — created fresh this phase.
- App header needs a "Тарифы" link (D-18).
- Quiz/question create flows + AI wizard need contextual upsell prompts on limit block (D-18).

</code_context>

<specifics>
## Specific Ideas

- Pricing page styled per project design language (promto.ai-inspired clean cards, gradient CTA `from-violet-600 to-indigo-600`).
- "Pro active until DD.MM.YYYY" status block for existing Pro users.

</specifics>

<deferred>
## Deferred Ideas

- Recurring/autopayment subscriptions with saved payment method — out of scope; this phase is one-time payments only.
- Background cron-based expiration sweep — not needed given lazy-by-date resolution (D-05).
- Production YooKassa keys / go-live — handled after this phase (test shop only now).

</deferred>

---

*Phase: 5-Billing*
*Context gathered: 2026-05-18*
