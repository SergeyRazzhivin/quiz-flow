---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 3
status: planning
stopped_at: Phase 3 context gathered
last_updated: "2026-05-17T15:33:30.245Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
  percent: 40
---

# State: Quiz Flow

**Initialized:** 2026-05-16
**Current Phase:** 3
**Status:** Ready to plan

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16)

**Core value:** Пользователь загружает текст — AI генерирует готовый тест за секунды, который можно сразу отправить тестируемым.
**Current focus:** Phase 3 — ai wizard

---

## Current Position

Phase: 02 (quiz-taking-sharing) — COMPLETE
Plan: Not started
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
Phase 3 [          ] 0%
Phase 4 [          ] 0%
Phase 5 [          ] 0%
```

---

## Performance Metrics

**Plans completed:** 9 (01-01 ✓, 01-02 ✓, 01-03 ✓, 01-04 ✓, 02-01 ✓, 02-02 ✓, 02-03 ✓, 02-04 ✓, 02-05 ✓)
**Plans created:** 9 (Phase 1: 4, Phase 2: 5)
**Requirements shipped:** 34 / 48 (AUTH-01–03, QUIZ-01–07, EDIT-01–08, NAV-01–02, TAKE-01–10, SHARE-01–03, EXT-04)
**Requirements planned:** 34 / 48 (Phase 1 + Phase 2)
**Phases completed:** 2 / 5

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

### Open Questions

- File parsing strategy for AI wizard (PDF/DOCX in Deno Edge Function) — LOW confidence, decision required before Phase 3 planning
- shuffle_answers RESOLVED: added to quizzes.settings JSONB default in migration 002
- Supabase Storage RLS for cover images RESOLVED: covers/{owner_id}/{quiz_id}/{uuid}.{ext} path in migration 007 comment

### Blockers

None.

### Incidents

- `handle_new_user()` trigger required `SET search_path = public` (Supabase SECURITY DEFINER restriction) — fixed in a49925e
- Supabase dashboard shows new `sb_publishable_*` key format — must use JWT `eyJ…` anon key in `.env`

---

## Session Continuity

**Last session:** 2026-05-17T15:33:30.238Z
**Resume file:** .planning/phases/03-ai-wizard/03-CONTEXT.md
**Stopped at:** Phase 3 context gathered
**Next action:** Run /gsd:verify-work 2, then /gsd:plan-phase 3 (AI Wizard)

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
