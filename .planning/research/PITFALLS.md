# Domain Pitfalls: Quiz Flow

**Domain:** Quiz/Test SaaS — Vue 3 + Supabase + OpenAI + ЮKassa
**Researched:** 2026-05-16
**Confidence:** HIGH — verified against official Supabase docs, OpenAI docs, FSD docs

---

## 1. Supabase RLS with Mixed Auth

### Pitfall 1.1 — Anonymous Users Silently Inherit Authenticated Policies

**Warning sign:** Quiz takers see empty quiz content even though quiz_access token is valid. Or: `007_rls_policies.sql` uses `auth.uid()` in every policy with no separate `TO anon` branch.

**Prevention:**
- Write two separate policy families: `TO authenticated` for owners (checking `auth.uid() = owner_id`), and `TO anon` for quiz takers (limited to published content).
- Never use `USING (auth.uid() = ...)` as the sole policy on tables quiz takers must read (`quizzes`, `questions`, `answer_options`).

**Phase:** Phase 1 (DB schema + RLS). Getting this wrong in `007_rls_policies.sql` poisons every subsequent phase.

---

### Pitfall 1.2 — RLS Evaluates `auth.uid()` Per-Row (Slow Queries)

**Warning sign:** `quiz_sessions` or `session_answers` queries become slow as data grows. Supabase Performance Advisor flags `0003_auth_rls_initplan` warning.

**Prevention:**
- Wrap every `auth.uid()` call in a subquery: `USING (owner_id = (SELECT auth.uid()))`. This triggers Postgres's `initPlan` optimization — function evaluated once per query, not per row.
- Add indexes on every column used in RLS predicates: `owner_id` on `quizzes`, `quiz_access_id` on `quiz_sessions`.

**Phase:** Phase 1 (migrations). Apply from the start.

---

### Pitfall 1.3 — Token Passed as Client Filter Without Server Enforcement

**Warning sign:** Frontend does `supabase.from('quiz_access').select().eq('token', token)` and treats returned row as proof of authorization while no RLS enforces the binding server-side.

**Prevention:**
- Password comparison must happen server-side in an Edge Function. The hash never goes to the client.
- The `password_hash` column must never be SELECTable by the `anon` role.

**Phase:** Phase 2 (quiz-taking flow). Critical before any user gets a quiz link.

---

### Pitfall 1.4 — `password_hash` and `is_correct` Readable by Anon Role

**Warning sign:** Anon SELECT grant on `quiz_access` uses `GRANT SELECT ON quiz_access TO anon` with no column list.

**Prevention:**
- Column-level grants: explicitly exclude `password_hash` from anon grants on `quiz_access`.
- Exclude `answer_options.is_correct` from anon grants — only expose after `finished_at IS NOT NULL`.

**Phase:** Phase 1 (migrations `007_rls_policies.sql`) + Phase 2 (quiz-taking).

---

## 2. OpenAI Integration Pitfalls

### Pitfall 2.1 — JSON Mode Does Not Guarantee Schema Conformance

**Warning sign:** Edge Function does `JSON.parse(content)` and immediately starts inserting rows without structural validation. Works in dev, fails ~1% of the time in production.

**Prevention:**
- Use `response_format: { type: 'json_schema', json_schema: { strict: true, schema: {...} } }` (Structured Outputs). Schema conformance becomes a hard guarantee.
- Always check `message.refusal` before parsing.
- Validate parsed object with Zod in the Edge Function. Return HTTP 422 on validation failure.

**Phase:** Phase 3 (AI wizard). Non-negotiable before launch.

---

### Pitfall 2.2 — Large Input Text Blows Token Budget and Triggers Timeout

**Warning sign:** No input truncation. Prompt template is `Here is the full text: ${userText}` with no length cap. Edge Function timeouts after 25 seconds.

**Prevention:**
- Hard-cap input at 8,000–12,000 tokens server-side (~12,000 chars). Never trust the client.
- Use `gpt-4o-mini` (16× cheaper than GPT-4o).
- Set `max_tokens` on the response — quiz JSON rarely needs more than 2,000 output tokens for 20 questions.

**Phase:** Phase 3 (AI wizard). Cost control must be designed before first real user.

---

### Pitfall 2.3 — Rate Limit 429 Crashes the Edge Function

**Warning sign:** No retry logic. The AI call is a single `await openai.chat.completions.create(...)` with no error handling wrapper.

**Prevention:**
- Distinguish error types: `rate_limit_exceeded` is retriable; `insufficient_quota` is not.
- Read `retry-after-ms` header from OpenAI on 429; wait that duration before retrying.
- Maximum 2–3 retries. Return clear error if still failing.

**Phase:** Phase 3 (AI wizard).

---

### Pitfall 2.4 — Hardcoded Model Name Breaks on Deprecation

**Warning sign:** Model name is a magic string in the function body.

**Prevention:**
- Store model name in a Supabase secret: `OPENAI_MODEL=gpt-4o-mini-2024-07-18`.
- Pin to dated snapshot versions; rotation is a single env var change.

**Phase:** Phase 3.

---

## 3. Quiz Session Management

### Pitfall 3.1 — Timer Drift When Tab Goes to Background

**Warning sign:** Timer stores only remaining seconds in component state and decrements with `setInterval`. No `visibilitychange` handler. Chrome throttles background tab timers to once per minute after 5 minutes.

**Prevention:**
- Always compute remaining time as `(started_at + time_limit_sec) - Date.now()` on every tick.
- On `visibilitychange` (tab returns to foreground): immediately recompute and update display.
- Server enforces the deadline on submit: `NOW() < started_at + interval '${time_limit_sec} seconds'`.

**Phase:** Phase 2 (quiz-taking). Most reported bug in online quiz products.

---

### Pitfall 3.2 — Page Refresh Loses All Answers

**Warning sign:** `session_answers` are only inserted on final submit. No intermediate persistence.

**Prevention:**
- Upsert each answer to `session_answers` immediately on selection (upsert by `session_id + question_id`).
- On quiz page mount: if `session_id` exists in `sessionStorage`, fetch existing `session_answers` and restore state. Resume timer from server `started_at`.
- If `finished_at` is already set, redirect to result page immediately.

**Phase:** Phase 2.

---

### Pitfall 3.3 — Duplicate Session Creation on Double-Click

**Warning sign:** "Start" button is not disabled during the async INSERT. No UNIQUE constraint prevents concurrent active sessions.

**Prevention:**
- Add a UNIQUE partial index: `CREATE UNIQUE INDEX ON quiz_sessions (quiz_access_id) WHERE finished_at IS NULL`.
- Disable the "Start" button on first click via `isStarting` ref.

**Phase:** Phase 2.

---

### Pitfall 3.4 — `answer_options.is_correct` Exposed During Quiz-Taking

**Warning sign:** Quiz-taking page reuses the same Supabase query as the editor. `is_correct` included in response.

**Prevention:**
- RLS SELECT grant for anon on `answer_options` must exclude `is_correct` (column-level grant).
- Separate SELECT path for quiz-taking: `SELECT id, question_id, body, order_index FROM answer_options`.
- Include `is_correct` only when `finished_at IS NOT NULL` on the session.

**Phase:** Phase 2.

---

## 4. FSD Architecture Drift

### Pitfall 4.1 — Business Logic Accumulates in `6-shared`

**Warning sign:** Files in `6-shared/lib/` import from `5-entities/`. The `shared` layer grows faster than `entities` or `features`.

**Prevention:**
- `6-shared` contains only: Supabase client singleton, generic UI components, TypeScript utility types, constants, and framework-agnostic utilities with no domain knowledge.
- Install Steiger (official FSD linter) or `eslint-plugin-boundaries` in CI from day one.

**Phase:** Persistent across all phases. Most dangerous in Phase 1–2 when structure is forming.

---

### Pitfall 4.2 — Feature-to-Feature Imports Create Hidden Coupling

**Warning sign:** Import paths like `import { saveQuiz } from '../../quiz-editor/model'` inside a different feature directory.

**Prevention:**
- Cross-feature communication goes through `5-entities` or Pinia actions/router events.
- Save-quiz logic belongs in `5-entities/quiz/api.ts`, not in `4-features/quiz-editor`.
- Steiger catches this automatically in CI.

**Phase:** Phase 1 (architecture setup). Establish ESLint rule before writing any feature code.

---

### Pitfall 4.3 — Pages Grow Fat with Business Logic

**Warning sign:** A page component exceeds ~80 lines of `<script setup>`. It imports from `5-entities` or `6-shared` for domain operations.

**Prevention:** Pages are thin assemblers — import widgets and features, wire with props/events. Zero domain logic. All logic goes in `4-features/*/use*.ts` stores.

**Phase:** Phase 2+ (quiz-taking page, editor page).

---

## 5. Subscription / Freemium Bugs

### Pitfall 5.1 — Limits Enforced Only on the Client

**Warning sign:** Limit check logic is only in a Vue component or Pinia store. No DB trigger or RLS condition counts quizzes.

**Prevention:**
- Enforce limits in a Postgres trigger, RLS USING clause with subquery counting, or an Edge Function that proxies quiz creation.
- Client-side check is UX only — never security.

**Phase:** Phase 4 (freemium + billing). Must be in place before any real users are on Free tier.

---

### Pitfall 5.2 — ЮKassa Webhook Processed Multiple Times

**Warning sign:** Webhook handler does all work synchronously before returning 200. No idempotency check on `yookassa_payment_id`.

**Prevention:**
- Return HTTP 200 immediately.
- Before any state change: `SELECT id FROM subscriptions WHERE yookassa_payment_id = $payment_id`. If found, skip processing.
- Make all changes idempotent: `INSERT ... ON CONFLICT (yookassa_payment_id) DO UPDATE SET ...`.

**Phase:** Phase 4 (billing integration). Financial data is hard to untangle if wrong.

---

### Pitfall 5.3 — Plan Downgrade Does Not Revoke Active Access

**Warning sign:** Plan enforcement checks `profiles.plan` but the webhook only updates `subscriptions`. No mechanism syncs them.

**Prevention:**
- Postgres trigger on `subscriptions` (after UPDATE on `status`) automatically updates `profiles.plan` when status becomes `cancelled` or `expired`.
- Add a pg_cron job or daily Edge Function that expires subscriptions past `current_period_end`.

**Phase:** Phase 4 (billing).

---

### Pitfall 5.4 — AI Call Counter Bypassed by Concurrent Requests

**Warning sign:** Limit check and increment are two separate queries with no atomic transaction.

**Prevention:**
- Single atomic upsert: `INSERT INTO ai_usage (user_id, month, count) VALUES ... ON CONFLICT (user_id, month) DO UPDATE SET count = ai_usage.count + 1 WHERE ai_usage.count < $limit RETURNING count`.
- If no row returned, limit is hit.

**Phase:** Phase 3 (AI wizard) + Phase 4 (freemium enforcement).

---

## 6. Vue 3 + DnD Issues

### Pitfall 6.1 — Array Index as `:key` in Draggable List

**Warning sign:** `:key="index"` anywhere in the questions list.

**Prevention:** Always use `:key="question.id"` (the DB UUID). Hard requirement with `vue-draggable-plus`.

**Phase:** Phase 1 (quiz editor).

---

### Pitfall 6.2 — `order_index` Not Updated After Reorder

**Warning sign:** The `@end` / `@update` handler only updates local state. No upsert sent to Supabase after drag.

**Prevention:**
- In the `@end` handler: iterate reordered array, assign `order_index = index`, then batch-upsert all questions.
- Optimistic update for responsiveness; revert on error.

**Phase:** Phase 1 (quiz editor).

---

### Pitfall 6.3 — Array Reference Replacement Conflicts with SortableJS

**Warning sign:** Drag works but list randomly reverts. Console shows SortableJS null reference errors.

**Prevention:**
- Never replace the array reference during an active drag. Mutate in-place: `state.questions.splice(0, state.questions.length, ...newItems)`.
- Pinia actions that refresh questions from server must merge rather than replace.

**Phase:** Phase 1 (quiz editor).

---

### Pitfall 6.4 — `order_index` Gaps After Deletion Cause Sort Anomalies

**Warning sign:** New questions are assigned `MAX(order_index) + 1` without accounting for gaps.

**Prevention:**
- After every reorder or delete, renumber all remaining questions 0, 1, 2, ... in a single batch upsert.
- Do NOT add a UNIQUE constraint on `(quiz_id, order_index)` — it makes batch reorders painful.
- Always `ORDER BY order_index ASC, created_at ASC` to handle any remaining ties.

**Phase:** Phase 1 (quiz editor).

---

## 7. Security Vulnerabilities

### Pitfall 7.1 — Token UUID Generated Insecurely

**Warning sign:** Migration for `quiz_access` uses anything other than `gen_random_uuid()` as the default.

**Prevention:** Enforce in migration: `token uuid DEFAULT gen_random_uuid() NOT NULL UNIQUE`. UUID v4 provides 122 bits of entropy.

**Phase:** Phase 1 (migration `004_quiz_access.sql`).

---

### Pitfall 7.2 — `password_hash` Stored as Plain Text

**Warning sign:** The stored value doesn't start with `$2b$` (bcrypt). The create-link form sends password directly to Supabase without hashing.

**Prevention:**
- Hash in the Edge Function (not on the client) using bcrypt with cost factor 10–12.
- Verification: taker sends password to Edge Function → EF fetches hash → constant-time comparison → never returns hash to client.

**Phase:** Phase 2 (quiz-taking) and Phase 1 (quiz share creation).

---

### Pitfall 7.3 — Tables Created Without RLS Enabled

**Warning sign:** Supabase Dashboard Performance Advisor shows `0013_rls_disabled_in_public` warnings.

**Prevention:**
- `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY` must be the first statement after every `CREATE TABLE`.
- Run in CI: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity` — fail if any rows returned.

**Phase:** All phases. Especially dangerous in Phase 4 (subscriptions table).

---

### Pitfall 7.4 — Quiz Cover Images Overwritten by Filename Collision

**Warning sign:** Upload path is `bucket/{filename}` without user or quiz namespacing.

**Prevention:**
- Namespace all uploads: `covers/{owner_id}/{quiz_id}/{uuid}.{ext}`.
- Storage RLS INSERT policy verifies path prefix matches `auth.uid()`.

**Phase:** Phase 1 (quiz editor — cover upload).

---

## 8. Performance Traps

### Pitfall 8.1 — Synchronous AI Edge Function Times Out

**Warning sign:** Client waits for full OpenAI call in one HTTP request. No streaming or polling. 25-second wall clock limit is regularly hit.

**Prevention:**
- Async pattern: Edge Function immediately inserts an `ai_jobs` row with `status = 'pending'` and returns job ID in under 200ms. OpenAI call runs in `EdgeRuntime.waitUntil()`.
- Client polls or subscribes via Supabase Realtime for status changes.

**Phase:** Phase 3 (AI wizard).

---

### Pitfall 8.2 — N+1 Queries on Statistics Page

**Warning sign:** Statistics store action has nested loops with nested `await supabase.from(...)` calls.

**Prevention:**
- Single Supabase query with nested select: `supabase.from('quiz_sessions').select('*, session_answers(*), quiz_access(label)').eq('quiz_id', quizId)`.
- Add index on `quiz_sessions.quiz_id`.

**Phase:** Phase 5 (statistics).

---

## Phase Warning Summary

| Phase | Most Likely Pitfall | Mitigation |
|-------|---------------------|------------|
| 1 — DB + Editor | RLS policy collision (anon/auth) | Separate policy families by role with `TO` clause |
| 1 — DB + Editor | Array index as DnD key; order_index not persisted | Entity UUID as key; batch upsert on drop |
| 1 — DB + Editor | Filename collision on cover upload | Namespace by `{owner_id}/{quiz_id}/` |
| 2 — Quiz-taking | setInterval drift on background tab | Compute remaining time from server `started_at` |
| 2 — Quiz-taking | Answer loss on page reload | Upsert each answer immediately; restore from DB |
| 2 — Quiz-taking | `is_correct` leaked; `password_hash` readable | Column-level grants on anon role |
| 3 — AI wizard | Malformed JSON response | Structured Outputs + Zod validation |
| 3 — AI wizard | Unbounded token input | Hard-cap input; use gpt-4o-mini |
| 3 — AI wizard | Synchronous timeout | Async job pattern with polling |
| 4 — Billing | Duplicate webhook processing | Idempotency check on `yookassa_payment_id` |
| 4 — Billing | Client-side limit bypass | DB-level enforcement via trigger or policy |
| 4 — Billing | Plan not revoked after cancellation | Postgres trigger syncs `profiles.plan` |
| All phases | Business logic in `shared`; feature-to-feature imports | Steiger linter in CI from day one |
