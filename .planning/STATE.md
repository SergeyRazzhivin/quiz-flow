---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 06
status: verifying
stopped_at: Phase 6 UI-SPEC approved
last_updated: "2026-05-18T20:06:51.123Z"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 19
  completed_plans: 19
  percent: 100
---

# State: Quiz Flow

**Initialized:** 2026-05-16
**Current Phase:** 06
**Status:** Phase complete — ready for verification

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16)

**Core value:** Пользователь загружает текст — AI генерирует готовый тест за секунды, который можно сразу отправить тестируемым.
**Current focus:** Phase 06 — landing-page-service-overview-public-quiz-carousel-and-recen

---

## Current Position

Phase: 06 (landing-page-service-overview-public-quiz-carousel-and-recen) — EXECUTING
Plan: 2 of 2
**Phase 5 Plan 3:** COMPLETE — Billing frontend slice (usePaymentStore: get_usage fetch, isProActive, createPayment YooKassa redirect, handleLimitError upsell; PricingCards Free/Pro cards + monthly/yearly toggle; ProStatusBanner; BillingWidget shell; BillingPage; /billing route; AppHeader Тарифы link; 18 tests pass, steiger clean; PAY-02, PAY-03 UI). Task 4 (visual human-verify) auto-approved in --auto chain.
**Phase 5 Plan 2:** COMPLETE — YooKassa payment Edge Functions (create-payment owner-authed EF → confirmation_url; yookassa-webhook public IP-allowlisted idempotent Pro grant; AI monthly-limit gate in ai-generate-quiz HTTP 429; config.toml; PAY-03, PAY-04 API tier, PAY-05 grant side). Task 4 (YooKassa live payment round-trip) DEFERRED by user — carried forward as a human-UAT item (see 05-02-SUMMARY Deferred Verification); resolve before production billing launch.
**Phase 5 Plan 1:** COMPLETE — Billing DB enforcement spine (migration 015: ai_generations table, get_effective_plan() lazy-expiry resolver, enforce_quiz_limit/enforce_question_limit BEFORE INSERT triggers, get_ai_window_start/get_usage RPCs; migration applied to live DB; PAY-01, PAY-04, PAY-05)
**Phase 4 Plan 1:** COMPLETE — Statistics data layer (migration 013 get_quiz_stats + get_quiz_accuracy RPCs, format helpers, ProgressBar size prop; STATS-01–03)
**Phase 3 Plan 1:** COMPLETE — AI generation backend (migration 012 ai_jobs, four _shared AI helpers, ai-generate-quiz Edge Function; AI-05)
**Phase 3 Plan 2:** COMPLETE — AI-wizard frontend slice (ai-job entity, useAiWizardStore 4-step machine + poll loop, 4 step components/stepper/widget/page, /ai-wizard route; AI-01–04, AI-06–07)
**Phase 3 Plan 3:** COMPLETE — D-02 entry-point buttons (/my, /my empty state, editor header) + AI-SPEC §5 evals harness scaffold (AI-01)
**Phase:** 1 — Foundation, Auth & Quiz Editor — COMPLETE
**Phase:** 2 — Quiz Taking & Sharing — COMPLETE
**Phase 2 Plan 1:** COMPLETE — server foundation (migration 009, Edge Functions, verify-quiz-access)
**Phase 2 Plan 2:** COMPLETE — owner access-link slice (create-quiz-access EF, quiz-share store/UI, AccessLinksModal)
**Phase 2 Plan 3:** COMPLETE — guest entry slice (start-quiz-session EF, quiz-session entity, useQuizTakingStore, guest UI, allow_retake toggle, get-quiz-meta EF)
**Phase 2 Plan 4:** COMPLETE — active quiz-taking slice (upsert-session-answer EF, timer/answer/navigation store actions, ProgressBar/TimerDisplay, QuestionTaker/NavigationControls/StopConfirmDialog, QuizTakingHeader, migration 011)
**Phase 2 Plan 5:** COMPLETE — submit + scoring + result slice (_shared/scoring.ts D-17 partial credit, submit-quiz-answers + get-quiz-result EFs, finishSession/loadResult, D-04 re-entry machine, TimerExpiredNotice, QuizResultPage)

```
Phase 1 [▓▓▓▓▓▓▓▓▓▓] complete (4/4 plans)
Phase 2 [▓▓▓▓▓▓▓▓▓▓] complete (5/5 plans)
Phase 3 [▓▓▓▓▓▓▓▓▓▓] complete (3/3 plans)
Phase 4 [▓▓▓▓▓     ] 50% (1/2 plans)
Phase 5 [▓▓▓▓▓▓▓▓▓▓] complete (3/3 plans)
```

---

## Performance Metrics

**Plans completed:** 14 (01-01 ✓, 01-02 ✓, 01-03 ✓, 01-04 ✓, 02-01 ✓, 02-02 ✓, 02-03 ✓, 02-04 ✓, 02-05 ✓, 03-01 ✓, 03-02 ✓, 03-03 ✓, 04-01 ✓, 05-01 ✓)
**Plans created:** 12 (Phase 1: 4, Phase 2: 5, Phase 3: 3)
**Requirements shipped:** 47 / 48 (AUTH-01–03, QUIZ-01–07, EDIT-01–08, NAV-01–02, TAKE-01–10, SHARE-01–03, EXT-04, AI-01–07, STATS-01–03, PAY-01, PAY-04, PAY-05)
**Requirements planned:** 41 / 48 (Phase 1 + Phase 2 + Phase 3)
**Phases completed:** 3 / 5

---

## Accumulated Context

### Key Decisions (from research)

- Guest writes go through Edge Functions only (verify-quiz-access, start-quiz-session, submit-quiz-answers, get-quiz-result, generate-quiz) — service_role key never reaches the client
- Guest token is a short-lived custom JWT (1 hour) stored in sessionStorage; closing the tab reverts to session-expired state
- AI generation uses async job pattern: Edge Function returns job_id in <200 ms, processes OpenAI in waitUntil(), client polls via Supabase Realtime or polling
- Timer must compute (started_at + time_limit_sec) - Date.now() on every tick and recalculate on visibilitychange to handle background tab throttling
- Answers upserted to session_answers immediately on selection — never only at final submit
- YooKassa webhook: verify sender IP allowlist, re-fetch payment from YooKassa API before applying state change, use ON CONFLICT DO UPDATE with idempotency key
- FSD linter (steiger) runs in CI from day one to prevent layer violations
- steiger fsd/typo-in-layer-name disabled for numeric FSD prefix dirs (1-app…6-shared) — Open Question 1 resolved
- shadcn-vue CLI broken on Node 20 (vue-metamorph/magic-string ESM bug); components hand-crafted with radix-vue + CVA instead
- bcryptjs VERIFIED in the Supabase Deno runtime (probe-bcrypt returned hashValid:true) — no PBKDF2 fallback needed for guest password hashing
- Supabase Edge Function names cannot start with `_` — probe function renamed `_probe-bcrypt` → `probe-bcrypt`
- Guest token signed with a dedicated `GUEST_JWT_SECRET` (not `SUPABASE_JWT_SECRET`), jose HS256, 1h TTL
- Owner-authenticated Edge Functions stay out of `config.toml` so `verify_jwt` defaults to true; they still re-verify quiz ownership in-handler because the service_role client bypasses RLS
- Access-link credentials (8-char login, 16-char password) auto-generated server-side via `crypto.getRandomValues`; plaintext password shown exactly once at creation, only a bcrypt cost-10 hash persists (D-14, D-15)
- `quiz_access` table needed a `created_at` column (migration 010) — migration 004 omitted it, breaking the `created_at`-ordered link list
- D-01 (intro+login on one screen) needed pre-login quiz metadata — added a 6th Phase 2 Edge Function `get-quiz-meta` (public, `verify_jwt=false`, returns only non-sensitive title/description/cover/time-limit/question-count)
- start-quiz-session resume branch returns stored `session_answers` so a resumed taker keeps answers and the D-07 required-question gate is not falsely tripped (D-04)
- session_answers needed a unique index on (session_id, question_id) — migration 011 — for the answer upsert ON CONFLICT to work (Postgres 42P10)
- start-quiz-session returns the full quiz + ordered questions (answer_options_public) so a browser reload fully rehydrates the active session; currentQuestionIndex is persisted to sessionStorage so reload resumes the same question
- Timer is server-anchored: timeRemainingSeconds recomputed from started_at + time_limit_sec every tick and on visibilitychange; isTimerCritical at <=20%; finishSession() stub stops the timer (02-05 owns the real submit)
- D-17 partial-credit scoring computed server-side in submit-quiz-answers: max(0, (correctSelected - incorrectSelected) / totalCorrect); the client never submits a score; is_correct is read only inside the EF from the answer_options base table via service_role
- submit-quiz-answers is idempotent on an already-finished session (returns the stored score without re-scoring) — backstops the timer-expiry vs manual-stop double-submit race
- D-02 SUPERSEDED (02-05): the product owner removed the intro/"Начать" preview screen; the quiz now starts immediately after a successful login (verifyAccess chains into startSession; the 'intro' session state was deleted). D-01 still holds
- start-quiz-session accepts a newAttempt flag and server-enforces allow_retake, creating a fresh quiz_sessions row for retakes (idempotent submit otherwise returned the stale score)
- Result page rehydrates guestToken/sessionId from sessionStorage on a cold direct-URL load before invoking get-quiz-result
- AI wizard collapses to ONE new Edge Function: `ai-job-status` is NOT created — the client polls `ai_jobs` directly via owner-SELECT RLS (RESEARCH Assumption A2 / Pattern 2); deliberate deviation from AI-SPEC §3
- ai-generate-quiz uses the fast-ACK pattern: auth → plan limits → insert ai_jobs(pending) → EdgeRuntime.waitUntil(runGeneration) → 202 {jobId} in <200 ms; OpenAI call + persist run in the background, never awaited
- D-03: the quizzes row is created only after a successful generation — a failed job (after the D-11 single retry) sets ai_jobs.status='failed' and creates no quizzes row
- Plan-aware limits enforced server-side in ai-generate-quiz: file size (D-06 Free 1 MB / Pro 5 MB) and question count (D-07 Free ≤10 / Pro ≤100), HTTP 400 on overage (threats T-03-05 / T-03-06)
- OpenAI pinned to v4 SDK (openai@4.104.0) — AI-SPEC §4b code is v4-only; hand-written QUIZ_JSON_SCHEMA strict + Zod QuizSchema.parse re-validation gate before any DB insert (no openai/helpers/zod)
- PDF/DOCX text extraction runs inside the Edge Function: unpdf (serverless pdf.js, Deno-safe) for PDF, unzipit for DOCX (read word/document.xml, strip tags); recovered text capped at 12000 chars
- ai_jobs writes are service_role-only — owner-only SELECT RLS, no anon policy, no authenticated INSERT/UPDATE policy (threat T-03-02)
- AiWizardPage intentionally omits AppHeader — the 03-UI-SPEC prescribes the wizard's own full-viewport (100dvh) shell as the authoritative visual contract
- The wizard store runs resetWizard() on every /ai-wizard entry so a second visit opens a fresh step 1 (D-02 — the wizard always creates a new quiz, never mutates an existing one)
- fetchAiJob widens the supabase client to an untyped shape for the ai_jobs read — ai_jobs is absent from the stale generated database.types.ts (migration 012 shipped without a type regen)
- D-02 AI-wizard entry points: three `Создать с ИИ` buttons (on /my, the /my empty state, editor header); the editor-header button is outline/sm and passes no quiz id so the wizard always creates a fresh quiz
- Stats aggregation via SECURITY DEFINER RPCs (get_quiz_stats, get_quiz_accuracy): each first-statement ownership check raises 'unauthorized' for non-owners; GRANT EXECUTE TO authenticated only — no anon grant
- D-03: completion rate inputs (totalAttempts/finishedCount) span ALL sessions; D-04: avgScore/accuracy_percent from DISTINCT ON (quiz_access_id) latest-finished per taker only
- answer_options.is_correct read inside RPC body only — never a key in any returned JSONB payload
- totalQuestions included in get_quiz_stats payload to avoid second query from UI (RESEARCH open question #1)
- promptfoo is CI-only — intentionally NOT a devDependency; its native dep better-sqlite3 needs a Python build toolchain absent locally, so adding it would break `npm install` for the team. The D4-D6 Promptfoo LLM-judge gate runs in CI; package.json keeps only the `eval` script
- AI-SPEC §5 evals harness scaffolded with an empty dataset — the 15-case reference dataset + Russian judge prompts are filled incrementally (flywheel), so the D1-D3 Vitest suite ships green with it.todo placeholders

### Open Questions

- Follow-up (03-02): regenerate database.types.ts (`npx supabase gen types`) so ai_jobs is typed, then drop the untyped-client widening in fetchAiJob
- Follow-up (03-03): populate evals/dataset/ with the 15-case AI-SPEC §5 reference dataset and evals/judge-prompts/ with the Russian-language LLM-judge prompts so the D1-D6 eval gates have data to assert against
- File parsing strategy for AI wizard RESOLVED (03-01): unpdf for PDF, unzipit for DOCX — both run inside the Edge Function
- EF request-body limit for a Pro 5 MB base64 file (~6.7 MB encoded) — deferred to phase verification / human UAT; base64-in-JSON is the chosen transport, Storage-upload remains the documented contingency if a live test shows a 413 (RESEARCH Open Question 2 / Assumption A3)
- Follow-up (05-02): YooKassa payment round-trip test DEFERRED by user — deploy create-payment/yookassa-webhook/ai-generate-quiz, set YOOKASSA secrets, register the payment.succeeded webhook, pay with a test card, confirm Pro grant + webhook idempotency; resolve before production billing launch (see 05-02-SUMMARY Deferred Verification)
- shuffle_answers RESOLVED: added to quizzes.settings JSONB default in migration 002
- Supabase Storage RLS for cover images RESOLVED: covers/{owner_id}/{quiz_id}/{uuid}.{ext} path in migration 007 comment
- 05-01: DB-level freemium enforcement live (migration 015) — get_effective_plan() resolves plan lazily by date with no cron (D-05); BEFORE INSERT triggers enforce_quiz_limit/enforce_question_limit block the 4th quiz / 11th question for Free owners even against direct client DB queries (D-09), raising literal QUIZ_LIMIT_EXCEEDED / QUESTION_LIMIT_EXCEEDED tokens the frontend matches
- 05-01: get_usage() RPC returns {plan, quizzes_used, quizzes_limit, ai_used, ai_limit, period_end} in one call (D-13); AI usage counted via ai_generations log table on a rolling 30-day window anchored to subscription/registration date (D-12); Free AI limit 10/mo, Pro 30/mo (D-14)
- 05-01: subscriptions is the single source of truth for plan resolution — profiles.plan not consulted (D-06); migration 015 added subscriptions.created_at and a UNIQUE(user_id) constraint

### Blockers

None.

### Incidents

- `handle_new_user()` trigger required `SET search_path = public` (Supabase SECURITY DEFINER restriction) — fixed in a49925e
- Supabase dashboard shows new `sb_publishable_*` key format — must use JWT `eyJ…` anon key in `.env`

---

## Session Continuity

**Last session:** 2026-05-18T20:06:51.114Z
**Resume file:** None
**Stopped at:** Phase 6 UI-SPEC approved
**Next action:** Verify Phase 5 (/gsd:verify-work 5)

---

## Phase History

### Phase 1 — Foundation, Auth & Quiz Editor (complete 2026-05-17)

- 4 plans, 20 requirements shipped (AUTH, QUIZ, EDIT, NAV)
- Walking Skeleton → quiz lists → editor shell → question editor
- Mid-phase UI overhaul: dark theme + orange accent, PrimeVue ToggleSwitch
- Notable incidents: handle_new_user search_path, vue-sonner CSS, storage policies (migration 008), router-guard refresh race

### Phase 2 — Quiz Taking & Sharing (complete 2026-05-17)

- 5 plans, 14 requirements shipped (TAKE-01–10, SHARE-01–03, EXT-04)
- Server foundation → owner access links → guest entry → active taking → submit/scoring/result
- 7 guest-facing Edge Functions (verify-quiz-access, create-quiz-access, start-quiz-session, get-quiz-meta, upsert-session-answer, submit-quiz-answers, get-quiz-result); custom guest JWT; server-anchored timer; D-17 partial-credit scoring
- D-02 superseded mid-phase (02-05): intro/"Начать" screen removed, quiz starts immediately after login
- Notable 02-05 checkpoint fixes: answer_options queried by question_id (42703), cold-load sessionStorage rehydration, fresh quiz_sessions row for retakes
