---
phase: 02-quiz-taking-sharing
plan: 04
subsystem: ui
tags: [vue, pinia, supabase-edge-functions, deno, timer, vitest]

# Dependency graph
requires:
  - phase: 02-03
    provides: useQuizTakingStore state refs, start-quiz-session EF, quiz-session entity, guest entry UI
provides:
  - upsert-session-answer Edge Function — immediate per-answer persistence via service_role upsert
  - useQuizTakingStore taking actions — selectAnswer, server-anchored timer, navigation with required-question gate, finishSession trigger
  - ProgressBar + TimerDisplay shared UI components
  - QuestionTaker, NavigationControls, StopConfirmDialog feature UI
  - QuizTakingHeader sticky progress + timer + stop header
  - active-state layout in QuizTakingWidget
affects: [02-05-submit-scoring-result]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-anchored countdown: timeRemainingSeconds derived from started_at + time_limit_sec on every tick and on visibilitychange — never client-decremented"
    - "Immediate answer upsert: every selection invokes upsert-session-answer with onConflict (session_id,question_id) idempotency"
    - "Defense-in-depth in service_role EF: verify guest token, then confirm session quiz_access_id matches the token payload before any write"

key-files:
  created:
    - supabase/functions/upsert-session-answer/index.ts
    - supabase/migrations/011_session_answers_unique.sql
    - src/6-shared/ui/ProgressBar.vue
    - src/6-shared/ui/TimerDisplay.vue
    - src/4-features/quiz-taking/ui/QuestionTaker.vue
    - src/4-features/quiz-taking/ui/NavigationControls.vue
    - src/4-features/quiz-taking/ui/StopConfirmDialog.vue
    - src/4-features/quiz-taking/model/quizTaking.test.ts
    - src/3-widgets/QuizTakingHeader.vue
  modified:
    - src/4-features/quiz-taking/model/useQuizTakingStore.ts
    - src/3-widgets/QuizTakingWidget.vue
    - supabase/functions/start-quiz-session/index.ts
    - supabase/functions/verify-quiz-access/index.ts

key-decisions:
  - "session_answers needed a unique index on (session_id, question_id) — migration 011 — for the upsert ON CONFLICT to work (Postgres 42P10)"
  - "start-quiz-session now returns quiz + questions (via answer_options_public) so a resumed session can fully rehydrate the quiz, not just the answers"
  - "currentQuestionIndex persisted to sessionStorage so a reload resumes the same question, not question 1"
  - "Edge Function errors serialized via real message extraction, not String(err) — String(err) on a plain object yields [object Object]"

patterns-established:
  - "Pattern: resumable quiz state — every piece of taker progress (answers, currentQuestionIndex) is persisted server-side or in sessionStorage so a browser reload fully restores the active session"
  - "Pattern: questions and nested options always .order('order_index') in every EF that returns them, so the taker order matches the editor"

requirements-completed: [TAKE-04, TAKE-05, TAKE-06, TAKE-07, TAKE-09, TAKE-10]

# Metrics
duration: ~3h (including human-verify checkpoint with 6 fix rounds)
completed: 2026-05-17
---

# Phase 2 Plan 04: Active Quiz-Taking Slice Summary

**The core taker experience: one-at-a-time question answering with immediate per-answer upsert, a server-anchored countdown timer, navigation gated by required questions, and early-stop / timer-expiry finalization triggers.**

## Performance

- **Duration:** ~3h (includes the human-verify checkpoint and 6 fix rounds)
- **Started:** 2026-05-17
- **Completed:** 2026-05-17
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify, PASSED)
- **Files modified:** 13 (9 created, 4 modified)

## Accomplishments

- `upsert-session-answer` Edge Function — every answer selection persists immediately to `session_answers` via a service_role upsert, with guest-token verification plus a session-ownership defense-in-depth check (T-02-17).
- `useQuizTakingStore` taking actions — `selectAnswer` (single-replace / multiple-toggle, optimistic local update + immediate EF invoke), server-anchored timer (`computeRemaining`, `startTimer`, `stopTimer`, `isTimerCritical`), navigation (`goForward`/`goBack`, `canGoBack`/`canGoForward`, `isLastQuestion`, `progressPercent`, `currentQuestion`), and the `finishSession()` stop/expiry trigger stub for 02-05.
- Shared `ProgressBar` and `TimerDisplay` components (primitive props, no store dependency); TimerDisplay turns red at <=20% remaining.
- Feature UI: `QuestionTaker` (radio/checkbox indicator language reused from the editor), `NavigationControls` (required-question gate, "Назад" omitted when `allow_back` is false), `StopConfirmDialog` (radix-vue dialog, D-06).
- `QuizTakingHeader` sticky header (D-05) + the active-state two-row layout in `QuizTakingWidget`.
- Checkpoint:human-verify PASSED — the human deployed the Edge Functions and re-verified the full taking flow across 6 fix rounds.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): timer / selectAnswer / canGoForward tests** - `bb4f8fe` (test)
2. **Task 1 (GREEN): upsert-session-answer EF + timer/answer/navigation store actions** - `f2fb00b` (feat)
3. **Task 2: ProgressBar, TimerDisplay shared components + quiz-taking UI** - `5d16e4f` (feat)
4. **Task 3: QuizTakingHeader + active-session layout in QuizTakingWidget** - `ad2a0b0` (feat)
5. **Checkpoint pause** - `26317f0` (chore)

**Checkpoint-feedback fixes (during human verification):**

6. `728e1fe` (fix) — session_answers unique index (migration 011) + real error messages in upsert-session-answer
7. `c8fbcdc` (fix) — return quiz+questions from start-quiz-session so reload resumes the active quiz
8. `d8cbf9d` (fix) — order quiz questions and options by order_index to match the editor
9. `e11b4e9` (fix) — align quiz-taking layout to the app 1280px width, center the question
10. `40ee30c` (fix) — persist and restore currentQuestionIndex so reload resumes the same question
11. `e3f0b47` (fix) — gate the "Завершить" button with the D-07 required-question check

**Plan metadata:** _(this commit)_ (docs: complete plan)

_Note: TDD Task 1 has separate test → feat commits (RED/GREEN gates satisfied)._

## Files Created/Modified

- `supabase/functions/upsert-session-answer/index.ts` - Service_role EF: verifies guest token, confirms session ownership, upserts the answer on conflict `(session_id, question_id)`
- `supabase/migrations/011_session_answers_unique.sql` - Unique index on `session_answers (session_id, question_id)` required by the upsert ON CONFLICT
- `src/6-shared/ui/ProgressBar.vue` - Orange-fill progress bar, `value` (0-100) prop
- `src/6-shared/ui/TimerDisplay.vue` - MM:SS countdown pill; red text when `isAlert`
- `src/4-features/quiz-taking/model/useQuizTakingStore.ts` - Added selectAnswer, server-anchored timer, navigation, finishSession trigger
- `src/4-features/quiz-taking/model/quizTaking.test.ts` - Vitest: computeRemaining clamping, isTimerCritical thresholds, selectAnswer single/multiple, required-gate
- `src/4-features/quiz-taking/ui/QuestionTaker.vue` - Question card with clickable radio/checkbox answer rows
- `src/4-features/quiz-taking/ui/NavigationControls.vue` - Назад/Вперёд/Завершить footer with the required-question gate
- `src/4-features/quiz-taking/ui/StopConfirmDialog.vue` - radix-vue Стоп confirmation dialog (D-06)
- `src/3-widgets/QuizTakingHeader.vue` - Sticky progress + timer + stop header (D-05)
- `src/3-widgets/QuizTakingWidget.vue` - Active-state two-row layout composing header + QuestionTaker + NavigationControls + StopConfirmDialog
- `supabase/functions/start-quiz-session/index.ts` - Now returns quiz + ordered questions (via answer_options_public) so resume rehydrates the full quiz
- `supabase/functions/verify-quiz-access/index.ts` - Questions and nested options now ordered by `order_index`

## Decisions Made

- **Migration 011 over a code workaround:** the upsert ON CONFLICT requires a real unique constraint; adding the index is the correct fix rather than reading-then-conditionally-writing.
- **Resume rehydrates the whole quiz:** rather than only restoring answers, `start-quiz-session` returns the full quiz + questions so a resumed `init()` path has everything it needs without depending on `verifyAccess` (which is skipped on resume).
- **currentQuestionIndex in sessionStorage:** keeps the taker on the same question after a reload — a small UX correctness fix consistent with the existing answer-persistence pattern.

## Deviations from Plan

### Checkpoint-feedback fixes (found during human verification)

All six were discovered while the human verified the deployed flow and are correctness/bug fixes (Rule 1), all within the plan's slice scope.

**1. [Rule 1 - Bug] Answer save failed — missing unique index**
- **Found during:** Task 3 (human-verify checkpoint)
- **Issue:** Selecting an answer returned `{"error":"[object Object]"}`. `session_answers` had no unique index on `(session_id, question_id)`, so the upsert's `ON CONFLICT` was rejected by Postgres (error 42P10). Separately, the EF serialized errors via `String(err)`, which renders a plain object as `[object Object]`.
- **Fix:** Added migration `011_session_answers_unique.sql` creating the unique index; changed `upsert-session-answer` to extract and serialize the real error message.
- **Files modified:** supabase/migrations/011_session_answers_unique.sql, supabase/functions/upsert-session-answer/index.ts
- **Verification:** Human re-tested — answer rows appear in Supabase Studio immediately on selection.
- **Committed in:** `728e1fe`

**2. [Rule 1 - Bug] Reload broke the quiz ("Вопрос 1 из 0")**
- **Found during:** Task 3 (human-verify checkpoint)
- **Issue:** On a browser reload of an active session, `init()`'s resume path never reloaded `quiz`/`questions` — only `verifyAccess` set them, and `verifyAccess` is skipped on resume — so the header showed "Вопрос 1 из 0".
- **Fix:** `start-quiz-session` now returns `quiz` + `questions` (via `answer_options_public`, with no `is_correct`); `init()` repopulates them on the resume path.
- **Files modified:** supabase/functions/start-quiz-session/index.ts, src/4-features/quiz-taking/model/useQuizTakingStore.ts
- **Verification:** Human reloaded mid-quiz — counter and question content restore correctly.
- **Committed in:** `c8fbcdc`

**3. [Rule 1 - Bug] Question order did not match the editor**
- **Found during:** Task 3 (human-verify checkpoint)
- **Issue:** Questions and answer options were returned in arbitrary DB order, not the `order_index` order the owner set in the editor.
- **Fix:** Both `start-quiz-session` and `verify-quiz-access` now `.order('order_index')` for questions and nested answer options.
- **Files modified:** supabase/functions/start-quiz-session/index.ts, supabase/functions/verify-quiz-access/index.ts
- **Verification:** Human confirmed the taker question order matches the editor.
- **Committed in:** `d8cbf9d`

**4. [Rule 1 - Bug] Quiz-taking layout width inconsistent with the app**
- **Found during:** Task 3 (human-verify checkpoint)
- **Issue:** The quiz-taking layout used `max-w-2xl`, narrower than the app's standard 1280px content width.
- **Fix:** Changed to the app-standard `max-w-7xl` (1280px) with the question centered in a `max-w-3xl` reading column.
- **Files modified:** src/3-widgets/QuizTakingWidget.vue, src/3-widgets/QuizTakingHeader.vue
- **Verification:** Human confirmed the layout aligns with the rest of the app.
- **Committed in:** `e11b4e9`

**5. [Rule 1 - Bug] Reload jumped to the first question**
- **Found during:** Task 3 (human-verify checkpoint)
- **Issue:** After a reload, the taker landed on question 1 instead of the question they were on, because `currentQuestionIndex` was never persisted.
- **Fix:** `currentQuestionIndex` is now persisted to sessionStorage and restored on resume.
- **Files modified:** src/4-features/quiz-taking/model/useQuizTakingStore.ts
- **Verification:** Human reloaded mid-quiz — resumes the same question.
- **Committed in:** `40ee30c`

**6. [Rule 1 - Bug] "Завершить" button missing the required-question gate**
- **Found during:** Task 3 (human-verify checkpoint)
- **Issue:** The "Завершить" button on a required, unanswered last question had no required-gate — the taker could finish without answering it.
- **Fix:** "Завершить" is now gated by `canGoForward` (the D-07 required-question check).
- **Files modified:** src/4-features/quiz-taking/ui/NavigationControls.vue
- **Verification:** Human confirmed "Завершить" is disabled on a required unanswered last question.
- **Committed in:** `e3f0b47`

---

**Total deviations:** 6 auto-fixed (6 Rule 1 — bugs surfaced at the human-verify checkpoint)
**Impact on plan:** All six were correctness fixes within the plan's slice scope, surfaced only because the checkpoint exercised the deployed flow against real data. No scope creep; no architectural changes. Migration 011 was a necessary schema addition for the planned upsert behavior.

## Issues Encountered

- The human-verify checkpoint required deploying two Edge Functions (`upsert-session-answer`, plus re-deploying `start-quiz-session` and `verify-quiz-access` after fixes) and running migration 011. The 6 fix rounds were resolved iteratively before the human typed "approved".

## User Setup Required

None — `02-USER-SETUP.md` covers the Edge Function deployment context. The `upsert-session-answer` Edge Function and migration 011 were deployed by the human during the checkpoint.

## TDD Gate Compliance

RED gate (`test(02-04)` — `bb4f8fe`) and GREEN gate (`feat(02-04)` — `f2fb00b`) commits both present and in order. No REFACTOR commit was needed.

## Next Phase Readiness

- The active quiz-taking experience is complete: answering, immediate persistence, server-anchored timer, navigation, and the early-stop / timer-expiry triggers.
- `finishSession()` is currently a stub that stops the timer — **02-05 owns the real submit + scoring + result page** and will replace its body. The stop dialog and timer-expiry paths are already wired into it.
- Plan 02-05 is the final plan of Phase 2.

## Self-Check: PASSED

All 11 task/fix commits verified present in git history; all key created files verified on disk.

---
*Phase: 02-quiz-taking-sharing*
*Completed: 2026-05-17*
