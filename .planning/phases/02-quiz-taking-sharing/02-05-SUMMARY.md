---
phase: 02-quiz-taking-sharing
plan: 05
subsystem: api

tags: [supabase-edge-functions, deno, vitest, pinia, vue, scoring, jwt]

# Dependency graph
requires:
  - phase: 02-quiz-taking-sharing (02-03)
    provides: useQuizTakingStore init/resume branches, answer restoration, start-quiz-session EF
  - phase: 02-quiz-taking-sharing (02-04)
    provides: live timer, selectAnswer/upsert, finishSession stub, QuizTakingWidget
provides:
  - Pure partial-credit scoring module (_shared/scoring.ts) implementing D-17, unit-tested
  - submit-quiz-answers Edge Function — idempotent server-side scoring + session finalization
  - get-quiz-result Edge Function — totals-only result retrieval for the result page
  - finishSession / loadResult store actions with double-submit guard
  - Complete D-04 re-entry state machine (resume / auto-submit / show-result / new-attempt)
  - TimerExpiredNotice overlay and QuizResultPage
affects: [03-ai-wizard, 04-statistics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side score computation: client never submits a score; EF reads is_correct from the answer_options base table via service_role only"
    - "Idempotent finalization: an already-finished session returns its stored score without re-scoring"
    - "Pure framework-free scoring function unit-tested with vitest, importable by Deno EFs"
    - "Cold-load store rehydration from sessionStorage for direct-URL arrival on the result page"

key-files:
  created:
    - supabase/functions/_shared/scoring.ts
    - supabase/functions/_shared/scoring.test.ts
    - supabase/functions/submit-quiz-answers/index.ts
    - supabase/functions/get-quiz-result/index.ts
    - src/4-features/quiz-taking/ui/TimerExpiredNotice.vue
    - src/2-pages/QuizResultPage.vue
  modified:
    - src/4-features/quiz-taking/model/useQuizTakingStore.ts
    - src/5-entities/quiz-session/api.ts
    - src/3-widgets/QuizTakingWidget.vue
    - supabase/functions/start-quiz-session/index.ts

key-decisions:
  - "D-17 partial-credit scoring: max(0, (correctSelected - incorrectSelected) / totalCorrect); totalCorrect 0 -> 0"
  - "D-02 SUPERSEDED: the intro/'Начать' preview screen was removed by the product owner; the quiz now starts immediately after a successful login"
  - "start-quiz-session accepts a newAttempt flag and server-enforces allow_retake, creating a fresh quiz_sessions row for retakes"

patterns-established:
  - "Server-authoritative scoring: is_correct is read only inside the EF; guest-facing responses carry only score/totalQuestions/percentage/label"
  - "Double-submit protection: store-level isSubmitting guard + EF idempotency on finished_at"
  - "Session rehydration from sessionStorage on cold result-page loads"

requirements-completed: [TAKE-06, TAKE-08, TAKE-10, EXT-04]

# Metrics
duration: ~4h (including 4-round human verification)
completed: 2026-05-17
---

# Phase 2 Plan 05: Submit / Scoring / Result Slice Summary

**Server-side partial-credit scoring (D-17) via submit-quiz-answers + get-quiz-result Edge Functions, the finishSession/loadResult store actions, the complete D-04 re-entry state machine, the TimerExpiredNotice overlay, and the QuizResultPage — closing the entire guest quiz-taking loop.**

## Performance

- **Duration:** ~4h (including a checkpoint with 4 rounds of human verification fixes)
- **Completed:** 2026-05-17
- **Tasks:** 3 (2 auto + TDD, 1 human-verify checkpoint)
- **Files modified/created:** 10

## Accomplishments

- Pure, framework-free `_shared/scoring.ts` implementing the D-17 partial-credit formula exactly, unit-tested (all-correct -> 1, half-correct -> 0.5, equal-correct/incorrect -> 0 clamped, malformed totalCorrect 0 -> 0).
- `submit-quiz-answers` Edge Function: verifies the guest token, guards against session injection, computes the score server-side from `session_answers` + the `answer_options` base table (the only place `is_correct` is read), persists `finished_at` + a `numeric` `score` (D-18), and is idempotent on an already-finished session.
- `get-quiz-result` Edge Function: returns totals only (`score`, `totalQuestions`, `percentage`, `label`) — never `is_correct`/`password_hash`, never per-question detail (D-11).
- `finishSession` (double-submit guarded) and `loadResult` store actions; the complete D-04 re-entry state machine (resume in-progress, auto-submit expired, show-result for single-attempt, new-attempt for allow_retake).
- `TimerExpiredNotice` non-dismissible overlay and the thin `QuizResultPage` showing percentage, fractional score, taker name (D-10), and the Quiz Flow home link (D-12).
- Checkpoint passed: the human deployed all Edge Functions and re-verified submission, partial-credit scoring, the result page, timer-expiry auto-submit, and every D-04 branch across several fix rounds, then typed "approved".

## Task Commits

1. **Task 1 (RED): scoreQuestion unit tests** - `2cba85a` (test)
2. **Task 1 (GREEN): scoring module + submit-quiz-answers and get-quiz-result Edge Functions** - `ebaf46c` (feat)
3. **Task 2 (RED): finishSession and loadResult tests** - `59f8ed2` (test)
4. **Task 2 (GREEN): finishSession/loadResult + complete D-04 state machine** - `5d5f7c2` (feat)
5. **Task 3: TimerExpiredNotice overlay, QuizResultPage, timer-expired wiring** - `ea894af` (feat)
6. **Checkpoint pause** - `7a784db` (chore)

**Checkpoint-feedback fixes (during human verification):**

7. **Fix: query answer_options by question_id, not the missing quiz_id** - `46c575c` (fix)
8. **Fix: rehydrate guest session from sessionStorage when the result page loads cold** - `c3057e2` (fix)
9. **Fix: start the quiz immediately after login, drop the intro "Начать" screen** - `6c375ec` (fix)
10. **Fix: create a fresh session for retakes instead of reusing the finished one** - `d66c84b` (fix)

**Plan metadata:** committed with this SUMMARY.

_Note: TDD tasks have test -> feat commit pairs._

## Files Created/Modified

- `supabase/functions/_shared/scoring.ts` - Pure D-17 partial-credit `scoreQuestion`, framework-free.
- `supabase/functions/_shared/scoring.test.ts` - vitest unit tests covering the four D-17 cases.
- `supabase/functions/submit-quiz-answers/index.ts` - Idempotent server-side scoring + session finalization.
- `supabase/functions/get-quiz-result/index.ts` - Totals-only result retrieval.
- `supabase/functions/start-quiz-session/index.ts` - Modified: `newAttempt` flag, server-enforced `allow_retake`, real error serialization in `catch`.
- `src/4-features/quiz-taking/model/useQuizTakingStore.ts` - Real `finishSession`/`loadResult`, complete D-04 machine, cold-load sessionStorage rehydration, `verifyAccess` chains into `startSession()`.
- `src/5-entities/quiz-session/api.ts` - `invokeSubmitAnswers` / `invokeGetResult` typed wrappers.
- `src/4-features/quiz-taking/ui/TimerExpiredNotice.vue` - Non-dismissible "Время вышло" overlay.
- `src/2-pages/QuizResultPage.vue` - Result page (percentage, fractional score, taker name, home link).
- `src/3-widgets/QuizTakingWidget.vue` - Mounts `TimerExpiredNotice`, shows it during timer-expiry submit.

## Decisions Made

- **D-02 SUPERSEDED (see Deviation 3):** the intermediate intro/"Начать" preview screen was removed at the product owner's request during this plan. The quiz now starts immediately after a successful login. D-01 (intro card shown alongside the login form) and D-04 retake semantics are unchanged.
- `start-quiz-session` was extended with a `newAttempt` flag, server-enforcing `allow_retake`, so a retake creates a genuinely fresh `quiz_sessions` row rather than reusing a finished one.

## Deviations from Plan

All four deviations below were discovered during the Task 3 `checkpoint:human-verify` gate and fixed across several rounds of human re-verification before the human typed "approved".

### Auto-fixed Issues

**1. [Rule 1 - Bug] submit-quiz-answers queried answer_options by a non-existent quiz_id column**
- **Found during:** Task 3 checkpoint (human verification, round 1)
- **Issue:** Submission failed with Postgres error 42703 — `submit-quiz-answers` selected `answer_options` filtered by a `quiz_id` column that does not exist on that table.
- **Fix:** Fetch the quiz's questions first, then fetch `answer_options` by `question_id`.
- **Files modified:** `supabase/functions/submit-quiz-answers/index.ts`
- **Verification:** Human re-ran a submission; scoring succeeded.
- **Committed in:** `46c575c` (fix)

**2. [Rule 1 - Bug] Reloading the result page showed {"error":"Invalid token"}**
- **Found during:** Task 3 checkpoint (human verification, round 2)
- **Issue:** On a cold result-page load `loadResult` ran against an empty store with `guestToken = null`, so `get-quiz-result` rejected the request as an invalid token.
- **Fix:** Rehydrate `guestToken` and `sessionId` from `sessionStorage` when the result page loads cold, before invoking `get-quiz-result`.
- **Files modified:** `src/4-features/quiz-taking/model/useQuizTakingStore.ts`
- **Verification:** Human reloaded the result page directly; the result rendered.
- **Committed in:** `c3057e2` (fix)

**3. [Rule 4 - Architectural / Product Decision] Removed the intro "Начать" preview screen — SUPERSEDES DECISION D-02**
- **Found during:** Task 3 checkpoint (human verification, round 3)
- **Issue:** The product owner reviewed the flow and requested removing the intermediate intro/"Начать" preview screen between login and the quiz.
- **Fix:** **This SUPERSEDES decision D-02.** The quiz now starts immediately after a successful login — `verifyAccess` chains directly into `startSession()`, and the `'intro'` session state was removed entirely. D-01 (the intro card shown together with the login form) still holds; D-04 retake semantics are preserved.
- **Files modified:** `src/4-features/quiz-taking/model/useQuizTakingStore.ts`, `src/3-widgets/QuizTakingWidget.vue`
- **Verification:** Human verified login proceeds straight into the first question; D-04 branches still behave correctly.
- **Committed in:** `6c375ec` (fix)

**4. [Rule 1 - Bug] Retaking an allow_retake quiz reused the previous finished session**
- **Found during:** Task 3 checkpoint (human verification, round 4)
- **Issue:** Retaking an `allow_retake` quiz reused the previous finished `quiz_sessions` row, so `submit-quiz-answers` idempotently returned the old score. The `start-quiz-session` `catch` block also masked real error messages.
- **Fix:** `start-quiz-session` now accepts a `newAttempt` flag and server-enforces `allow_retake`, creating a fresh `quiz_sessions` row for retakes. The `catch` block was fixed to serialize real error messages.
- **Files modified:** `supabase/functions/start-quiz-session/index.ts`, `src/4-features/quiz-taking/model/useQuizTakingStore.ts`
- **Verification:** Human finished an `allow_retake` quiz, started a new attempt, and confirmed a fresh row + fresh score.
- **Committed in:** `d66c84b` (fix)

---

**Total deviations:** 4 (3 Rule 1 bugs, 1 Rule 4 product-driven architectural change). Deviation 3 SUPERSEDES decision D-02 — see 02-CONTEXT.md for the annotation.
**Impact on plan:** All four fixes were necessary for correctness; deviation 3 was an explicit product-owner decision recorded during execution. No uncontrolled scope creep — all changes stay within the submit/scoring/result slice.

## Issues Encountered

The submit/scoring/result loop only surfaced its real defects under live Edge Function deployment + human walkthrough (the 42703 column error, cold-load token loss, retake session reuse). The checkpoint flow caught all of them across four verification rounds before approval.

## TDD Gate Compliance

Both auto tasks followed the RED -> GREEN cycle: `2cba85a` (test) -> `ebaf46c` (feat) for Task 1, `59f8ed2` (test) -> `5d5f7c2` (feat) for Task 2. No separate REFACTOR commits were needed.

## User Setup Required

`submit-quiz-answers` and `get-quiz-result` are new Edge Functions and were deployed by the human during the checkpoint (`npx supabase functions deploy submit-quiz-answers && npx supabase functions deploy get-quiz-result`). `start-quiz-session` was re-deployed after fix `d66c84b`. No further configuration required.

## Next Phase Readiness

- Phase 2 (Quiz Taking & Sharing) is now **complete** — all 5 plans done. The full guest-taking loop ships: token entry, credential auth, live-timer taking, immediate partial-credit scoring, the result page, and per-person access-link management.
- Phase 3 (AI Wizard) can begin. The Edge Function patterns (custom guest JWT, service_role isolation of sensitive columns) are established for reuse.

## Self-Check: PASSED

- All listed files exist (created/modified).
- All 10 commits verified present on master.

---
*Phase: 02-quiz-taking-sharing*
*Completed: 2026-05-17*
