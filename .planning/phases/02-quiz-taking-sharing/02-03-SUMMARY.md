---
phase: 02-quiz-taking-sharing
plan: 03
subsystem: ui
tags: [supabase-edge-functions, vue3, pinia, vue-router, guest-auth, jwt, sessionStorage]

# Dependency graph
requires:
  - phase: 02-quiz-taking-sharing (plan 02-01)
    provides: verify-quiz-access Edge Function, _shared/jwt.ts (verifyGuestToken), guest token contract
  - phase: 02-quiz-taking-sharing (plan 02-02)
    provides: quiz_access rows + owner-assigned credentials, migration 009 partial unique index on quiz_sessions
provides:
  - start-quiz-session Edge Function with D-04 resume branch (returns stored session_answers) and duplicate-session guard
  - get-quiz-meta Edge Function — public pre-login quiz metadata (title, description, cover, time limit, question count)
  - quiz-session entity layer (model.ts + api.ts invoke wrappers)
  - useQuizTakingStore entry state machine (init / verifyAccess / startSession / cleanup)
  - public /q/:token and /q/:token/result routes (no auth guard)
  - guest entry UI — GuestLoginForm, QuizIntroScreen, GracefulState, QuizSharePage, QuizTakingWidget shell
  - allow_retake toggle in the editor NavigationSettings
affects: [02-04 quiz-answering, 02-05 submit-and-result, quiz-taking, guest-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All guest session writes go through Edge Functions — no direct .from('quiz_sessions') client writes (RESEARCH Pattern 9)"
    - "sessionStorage key convention qf_guest_{token} -> JSON { guestToken, sessionId } for session resume"
    - "Public Edge Functions registered verify_jwt=false in config.toml for unauthenticated guest access"
    - "Guest session state machine in a Pinia composition store; all later-plan refs declared up front"

key-files:
  created:
    - supabase/functions/start-quiz-session/index.ts
    - supabase/functions/get-quiz-meta/index.ts
    - src/5-entities/quiz-session/model.ts
    - src/5-entities/quiz-session/api.ts
    - src/4-features/quiz-taking/model/useQuizTakingStore.ts
    - src/4-features/quiz-taking/ui/GuestLoginForm.vue
    - src/4-features/quiz-taking/ui/QuizIntroScreen.vue
    - src/4-features/quiz-taking/ui/GracefulState.vue
    - src/2-pages/QuizSharePage.vue
    - src/2-pages/QuizResultPage.vue
    - src/3-widgets/QuizTakingWidget.vue
  modified:
    - src/1-app/router/index.ts
    - src/4-features/quiz-editor/ui/NavigationSettings.vue
    - supabase/config.toml

key-decisions:
  - "D-01: intro card and login form on one screen — quiz metadata visible before login via the new get-quiz-meta EF"
  - "D-02: quiz_session and timer start on the explicit 'Начать' button, not on login"
  - "D-04: start-quiz-session resume branch returns stored session_answers; store rebuilds answers before activating so the D-07 required-question gate is not falsely tripped"
  - "D-19: /q/:token route has no auth guard and link access does not require is_published"
  - "Added get-quiz-meta as a 6th Phase 2 Edge Function (not in original plan) to source pre-login quiz metadata"

patterns-established:
  - "Edge-Function-only session writes: client never touches quiz_sessions / session_answers tables directly"
  - "Guest session resume via sessionStorage qf_guest_{token} + start-quiz-session resume branch"
  - "Public EF pattern: verify_jwt=false in config.toml, returns only non-sensitive columns"

requirements-completed: [TAKE-01, TAKE-02, TAKE-03, EXT-04]

# Metrics
duration: ~checkpoint-spanning
completed: 2026-05-17
---

# Phase 2 Plan 03: Guest Entry Slice Summary

**Public /q/:token guest entry flow — intro+login screen, start-quiz-session EF with D-04 session resume, useQuizTakingStore entry state machine, and the allow_retake editor toggle.**

## Performance

- **Duration:** Checkpoint-spanning (3 tasks, one blocking human-verify gate)
- **Completed:** 2026-05-17
- **Tasks:** 3 (all complete)
- **Files modified:** 14 created/modified across the 4 commits

## Accomplishments
- `start-quiz-session` Edge Function: verifies the guest token (401 on invalid/expired), inserts one `quiz_sessions` row on first start, and on resume returns the existing session plus its stored `session_answers` so a returning taker keeps their answers (D-04). Migration 009's partial unique index is the DB-level backstop against the double-click race.
- `quiz-session` entity layer — `QuizSession`, `SessionAnswer`, `SessionResult` interfaces and typed `supabase.functions.invoke` wrappers (`invokeVerifyAccess`, `invokeStartSession`, `invokeGetQuizMeta`); no direct table writes.
- `useQuizTakingStore` entry state machine — `init` (sessionStorage-driven resume), `verifyAccess` (credential check + intro transition), `startSession` (D-02, `isStarting`-guarded), `cleanup` placeholder; all later-plan state refs (timer, answers, result) declared now.
- Public `/q/:token` and `/q/:token/result` routes with no auth guard (D-19); `PROTECTED_ROUTES` unchanged.
- Guest UI: `GuestLoginForm`, `QuizIntroScreen` (intro card + embedded login form, D-01), `GracefulState` (reusable "Тест пока не готов" / "Ссылка недействительна" card), thin `QuizSharePage`, `QuizTakingWidget` shell that maps `sessionStatus` to the right view.
- `allow_retake` toggle ("Разрешить повторное прохождение") added to the editor `NavigationSettings` (EXT-04, D-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: start-quiz-session EF, quiz-session entity layer, public routes** - `32ea6c8` (feat)
2. **Task 2: useQuizTakingStore entry actions** - `60e7c59` (feat)
3. **Task 3: guest UI + allow_retake toggle** - `6f7f84f` (feat)
4. **Checkpoint-feedback fix: get-quiz-meta EF for pre-login intro metadata** - `aa26f0f` (fix)

**Checkpoint pause marker:** `d7553b8` (chore — STATE.md paused at the blocking human-verify gate)

## Files Created/Modified
- `supabase/functions/start-quiz-session/index.ts` - Session creation EF: token verify, resume branch returning stored answers, new-session insert
- `supabase/functions/get-quiz-meta/index.ts` - Public EF returning non-sensitive quiz metadata (title, description, cover_url, time_limit_sec, questionCount) for the pre-login intro card
- `src/5-entities/quiz-session/model.ts` - `QuizSession`, `SessionAnswer`, `SessionResult` interfaces
- `src/5-entities/quiz-session/api.ts` - Typed invoke wrappers (`invokeVerifyAccess`, `invokeStartSession`, `invokeGetQuizMeta`)
- `src/4-features/quiz-taking/model/useQuizTakingStore.ts` - Guest session state machine (entry portion)
- `src/4-features/quiz-taking/ui/GuestLoginForm.vue` - Login/password inputs + orange "Начать" button, inline credential-error toast
- `src/4-features/quiz-taking/ui/QuizIntroScreen.vue` - Centered intro card (cover/title/meta/description) with embedded login form or "Начать" button
- `src/4-features/quiz-taking/ui/GracefulState.vue` - Reusable centered icon/heading/body state card
- `src/2-pages/QuizSharePage.vue` - Thin public page mounting `QuizTakingWidget`
- `src/2-pages/QuizResultPage.vue` - Minimal placeholder (02-05 replaces) so the lazy route import keeps the build green
- `src/3-widgets/QuizTakingWidget.vue` - Widget shell mapping `sessionStatus` to intro/graceful/active views
- `src/1-app/router/index.ts` - Added `/q/:token` and `/q/:token/result` routes; `PROTECTED_ROUTES` unchanged
- `src/4-features/quiz-editor/ui/NavigationSettings.vue` - Added the `allow_retake` Switch row
- `supabase/config.toml` - Registered `get-quiz-meta` with `verify_jwt=false`

## Decisions Made
- **D-01 (one-screen intro+login):** quiz metadata and the credential form share a single screen; this required a data source for quiz metadata available *before* login (see deviation below).
- **D-02 (start on "Начать"):** the `quiz_session` and timer anchor are created by the explicit "Начать" button, not on successful login.
- **D-04 (resume keeps answers):** `start-quiz-session` resume branch returns stored `session_answers`; the store rebuilds `answers` before setting `sessionStatus='active'` so already-answered required questions do not re-block "Вперёд".
- **D-19 (public link access):** `/q/:token` has no auth guard and link access is independent of `is_published`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Checkpoint-feedback - Missing Critical] Added get-quiz-meta Edge Function for the pre-login intro card**
- **Found during:** Task 3 human-verify checkpoint
- **Issue:** The `/q/:token` intro card showed no quiz title or description in the pre-login `idle` state, violating decision D-01 ("intro and credentials on one screen"). There was no data source for quiz metadata before login — `verify-quiz-access` requires credentials, so nothing could populate the intro card until after authentication.
- **Fix:** Added a new public `get-quiz-meta` Edge Function: token → non-sensitive quiz metadata only (title, description, cover_url, time_limit_sec, questionCount — explicitly no questions, answers, `is_correct`, or `password_hash`). Registered it `verify_jwt=false` in `config.toml`, added an `invokeGetQuizMeta` api wrapper, and wired `store.init()` to populate the intro card from it.
- **Files modified:** `supabase/functions/get-quiz-meta/index.ts` (new), `supabase/config.toml`, `src/5-entities/quiz-session/api.ts`, `src/4-features/quiz-taking/model/useQuizTakingStore.ts`, `src/4-features/quiz-taking/ui/QuizIntroScreen.vue`
- **Verification:** Human re-verified the full guest entry flow after deploying the Edge Functions and typed "approved"; the intro card now shows title/description/cover pre-login.
- **Committed in:** `aa26f0f`
- **Phase impact:** This adds a 6th Edge Function to Phase 2 not in the original plan. The metadata returned is strictly non-sensitive — no question content or correctness data crosses to the anon-role client (consistent with the project's column-grant constraint).

---

**Total deviations:** 1 checkpoint-feedback fix (1 missing-critical / D-01 compliance)
**Impact on plan:** The fix was required for D-01 compliance and exposes only non-sensitive metadata. No scope creep beyond the one additional public EF.

## Issues Encountered
- The `active` `sessionStatus` currently renders a temporary placeholder in `QuizTakingWidget`. This is intentional and per the plan — the question-answering UI is delivered in plan 02-04, which replaces the placeholder.

## User Setup Required
**External service configuration was required at the checkpoint.** The human deployed the new Edge Functions before browser verification:
- `npx supabase functions deploy start-quiz-session`
- `npx supabase functions deploy get-quiz-meta` (added by the checkpoint-feedback fix)

Both are now deployed and verified working.

## Next Phase Readiness
- Guest entry slice complete: a guest can open a link, see the quiz intro pre-login, authenticate, and start a server-anchored session with D-04 resume.
- `useQuizTakingStore` already declares all timer/answer/submit refs — plan 02-04 only needs to add actions, not restructure state.
- The `active` placeholder in `QuizTakingWidget` is the explicit handoff point for plan 02-04 (question-answering UI).

---
*Phase: 02-quiz-taking-sharing*
*Completed: 2026-05-17*
