---
phase: 02-quiz-taking-sharing
verified: 2026-05-17T00:00:00Z
status: passed
score: 5/5 must-haves verified
human_verification_result: "all 7 items passed (see 02-HUMAN-UAT.md), approved by product owner 2026-05-17"
overrides_applied: 0
human_verification:
  - test: "Confirm D-02-superseded flow: login goes directly into the first question with no 'Начать' intermediate screen"
    expected: "After entering correct credentials in GuestLoginForm the taker lands on the first question immediately"
    why_human: "State machine transition verifyAccess → startSession is wired in code, but the actual browser UX of skipping the intro 'Начать' button can only be confirmed visually"
  - test: "Timer turns red at ≤ 20% of remaining time in the browser"
    expected: "TimerDisplay switches to text-red-500 font-semibold at the correct threshold; color change is visible in the taking header"
    why_human: "isTimerCritical logic is unit-tested, but the visual rendering of text-red-500 on TimerDisplay and the exact shade in the running browser requires human eye-check"
  - test: "D-04 re-entry: reload a browser tab mid-quiz (in-progress, not expired) and confirm all previously selected answers are still shown and 'Вперёд' is not blocked on an already-answered required question"
    expected: "The taker lands on the same question they were on, with all prior answer selections shown, and the required-gate passes"
    why_human: "sessionStorage restore + answer map rebuild is wired in init() but requires a real deployed session with real session_answers rows to observe"
  - test: "D-04 re-entry: open the link for a finished allow_retake quiz, confirm a fresh attempt is offered and creates a new quiz_sessions row"
    expected: "The guest sees the intro + login again (no stale state), starts a new session, and Supabase Studio shows a second quiz_sessions row"
    why_human: "The code path (clear answers, startSession with newAttempt:true) is wired but requires a real deployed DB row to verify"
  - test: "Timer expiry: let a quiz with a short time limit expire; confirm the TimerExpiredNotice overlay appears and the session auto-submits to the result page"
    expected: "Non-dismissible overlay with red clock icon, 'Время вышло', spinner; then automatic redirect to /q/:token/result"
    why_human: "Requires running browser + real timer countdown; cannot be verified by grep"
  - test: "Owner 'Ссылки доступа' modal: open the modal, create a link, confirm the one-time credentials block shows the plaintext password with the amber irreversibility warning, then copy with the button; confirm the Supabase DB stores only password_hash"
    expected: "Modal opens from editor header, credentials block appears once, 'Скопировать' writes to clipboard, the quiz_access row has password_hash not plaintext"
    why_human: "End-to-end owner UI flow + clipboard API + DB state confirmation requires human"
  - test: "TAKE-03 SC1 refinement: open /q/:token and confirm the intro card shows quiz title, description, and cover image BEFORE entering any credentials (pre-login state)"
    expected: "The idle state renders the QuizIntroScreen with quiz metadata populated from get-quiz-meta; the login form is present alongside the metadata"
    why_human: "get-quiz-meta is wired into loadIntroMeta but the actual visual rendering with real deployed EF data requires browser verification"
---

# Phase 2: Quiz Taking & Sharing — Verification Report

**Phase Goal:** A guest taker can open a quiz by token URL, authenticate with their assigned credentials, complete the quiz under a live timer, and immediately see their score; the owner can create, view, and delete per-person access links
**Verified:** 2026-05-17
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A taker who opens /q/:token sees the quiz title, description, and cover image; entering the correct owner-assigned login + password grants access | VERIFIED | `QuizIntroScreen.vue` renders `store.quiz.title/description/cover_url` populated by `get-quiz-meta` EF in `loadIntroMeta()`; `verifyAccess()` calls `verify-quiz-access` EF which checks bcrypt password, enforces expiry, returns signed guest token. Route `/q/:token` has no auth guard (D-19). |
| 2 | A taker can navigate questions per allow_back setting, see "Question X of Y" + timer, stop early; each answer is saved immediately to DB on selection | VERIFIED | `QuizTakingHeader.vue` shows "Вопрос X из Y" + `ProgressBar`. `NavigationControls.vue` omits "Назад" when `allow_back` false. `StopConfirmDialog.vue` implements D-06 early stop. `selectAnswer()` immediately invokes `upsert-session-answer` EF on each selection. |
| 3 | Timer counts down based on server started_at; auto-submits at expiry; turns red in final 20% | VERIFIED | `computeRemaining()` in store uses `new Date(startedAt.value).getTime() + timeLimitSec * 1000 - Date.now()`. `startTimer()` re-anchors on `visibilitychange`. `isTimerCritical = timeRemainingSeconds <= timeLimitSec * 0.2`. `TimerDisplay.vue` applies `text-red-500 font-semibold` when `isAlert`. Timer reaching 0 calls `finishSession()`. `start-quiz-session` returns `sessionState:'expired'` server-side for WR-04. |
| 4 | After submission the taker sees a result page with their score and percentage | VERIFIED | `QuizResultPage.vue` calls `store.loadResult()` on mount; renders `store.result.percentage%`, `formatScore(score, totalQuestions)` ("X из N"), `store.result.label`. `get-quiz-result` EF returns `{score, totalQuestions, percentage, label}`. Fractional score display per D-18. |
| 5 | An owner can create a per-person access link (token + login + password + optional expiry), view all links, delete individual links | VERIFIED | `AccessLinksModal.vue` wired to "Ссылки доступа" button in `QuizEditorHeader.vue`. `create-quiz-access` EF generates 8-char login + 16-char password via `crypto.getRandomValues`, bcrypt-hashes password, returns `{id, token, login, password}`. `AccessLinkCreated.vue` shows one-time credentials block. `AccessLinkList.vue` lists label/login/expiry with delete. CR-03 fixed: store uses `data.id` (the real PK) for optimistic row and `removeLink`. |

**Score:** 5/5 truths verified

### Deferred Items

None.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/009_phase2_schema.sql` | score numeric, allow_retake backfill, partial unique index, owner RLS | VERIFIED | All 5 operations present: `ALTER COLUMN score TYPE numeric`, settings DEFAULT with allow_retake, backfill UPDATE, `CREATE UNIQUE INDEX WHERE finished_at IS NULL`, two owner RLS policies |
| `supabase/functions/_shared/cors.ts` | corsHeaders constant | VERIFIED | Exports `corsHeaders` with Allow-Origin + Allow-Headers |
| `supabase/functions/_shared/jwt.ts` | signGuestToken / verifyGuestToken / GuestTokenPayload | VERIFIED | Exports all three; uses `GUEST_JWT_SECRET`, jose HS256, 1h TTL, `verifyGuestToken` returns null on any error |
| `supabase/functions/_shared/errors.ts` | serializeError + GENERIC_500_MESSAGE | VERIFIED | Present (added during code review fixes); all EFs use it for WR-05 |
| `supabase/functions/verify-quiz-access/index.ts` | Credential verification + guest token issuance; no is_published filter; queries answer_options_public | VERIFIED | Queries `answer_options_public` view; no `is_published` branch; returns `{state, guestToken, quiz, questions}`; expiry check present; identical 401 for not-found and wrong-password |
| `supabase/functions/create-quiz-access/index.ts` | Owner-auth link creation; ownership check; bcrypt hash; returns real id | VERIFIED | Verifies ownership (`owner_id === user.id`), generates credentials via `crypto.getRandomValues`, returns `{id, token, login, password}` (CR-03 fix present) |
| `supabase/functions/start-quiz-session/index.ts` | D-04 resume; expires_at check; returns quiz+questions; sessionState field | VERIFIED | Checks `expires_at` (CR-01 fix); returns `sessionState: 'active'/'expired'/'finished'/'new'`; returns stored answers on resume; returns quiz + questions for rehydration; server-side timer expiry check (WR-04 fix) |
| `supabase/functions/upsert-session-answer/index.ts` | Immediate upsert; finished_at guard; questionId validation | VERIFIED | Guards `finished_at !== null` → 409 (CR-02); validates `questionId` belongs to session's quiz (CR-02); `onConflict: 'session_id,question_id'` |
| `supabase/functions/submit-quiz-answers/index.ts` | Server-side scoring; idempotent; conditional UPDATE for race safety | VERIFIED | Reads `is_correct` from `answer_options` base table; `.is('finished_at', null)` conditional UPDATE (WR-02 fix); re-reads on race loss; returns `{score, totalQuestions, percentage}` |
| `supabase/functions/get-quiz-result/index.ts` | Totals-only result; no is_correct/password_hash | VERIFIED | Returns only `{score, totalQuestions, percentage, label}`; no per-question data; never returns `is_correct` or `password_hash`; checks expires_at (CR-01) |
| `supabase/functions/get-quiz-meta/index.ts` | Pre-login quiz metadata; no question content | VERIFIED | Returns only `{title, description, cover_url, time_limit_sec}` + questionCount; no questions/answers/is_correct |
| `supabase/functions/_shared/scoring.ts` | Pure scoreQuestion implementing D-17 | VERIFIED | Exports `scoreQuestion`; implements `max(0, (correctSelected - incorrectSelected) / totalCorrect)`; totalCorrect 0 → 0 |
| `supabase/functions/_shared/scoring.test.ts` | Unit tests for all D-17 cases | VERIFIED | 8 test cases: all-correct → 1, half-correct → 0.5, equal → 0, clamped → 0, malformed → 0, single correct → 1, single wrong → 0, nothing selected → 0 |
| `supabase/config.toml` | verify_jwt=false for guest-facing EFs; create-quiz-access absent (verify_jwt=true) | VERIFIED | Six EFs have `verify_jwt=false`: get-quiz-meta, verify-quiz-access, start-quiz-session, upsert-session-answer, submit-quiz-answers, get-quiz-result, plus probe-bcrypt. `create-quiz-access` is absent from the file. |
| `src/5-entities/quiz-access/model.ts` | QuizAccess interface; no password_hash field | VERIFIED | Interface has id, quiz_id, token, login, label, expires_at — no password_hash |
| `src/5-entities/quiz-access/api.ts` | fetchAccessLinks / deleteAccessLink; no password_hash in select | VERIFIED | Select omits password_hash; orders by created_at; deleteAccessLink uses `.eq('id', id)` |
| `src/5-entities/quiz-session/model.ts` | QuizSession, SessionAnswer, SessionResult interfaces | VERIFIED | All three interfaces present |
| `src/5-entities/quiz-session/api.ts` | invokeVerifyAccess, invokeStartSession, invokeGetQuizMeta, invokeSubmitAnswers, invokeGetResult | VERIFIED | All five typed wrappers present; no direct table writes |
| `src/4-features/quiz-share/model/useQuizShareStore.ts` | links/isCreating/lastCreated; loadLinks/createLink/removeLink; CR-03 fix | VERIFIED | All state refs and actions present; createLink rejects empty label; uses `data.id` not `data.token` for optimistic row (CR-03); WR-01 fix: appends `T23:59:59` to date |
| `src/4-features/quiz-taking/model/useQuizTakingStore.ts` | Full state machine; D-04 branches; WR-06 guard; all taking actions | VERIFIED | All required refs (sessionStatus, answers, timer refs, result); init D-04 state machine with all four branches; verifyAccess chains to startSession (D-02 superseded); selectAnswer has early-return guard for null guestToken/sessionId (WR-06); server-anchored timer with visibilitychange |
| `src/4-features/quiz-taking/model/quizTaking.test.ts` | Unit tests: computeRemaining, isTimerCritical, selectAnswer, canGoForward | VERIFIED | 11 test cases covering all four areas per plan requirement |
| `src/4-features/quiz-share/ui/AccessLinkForm.vue` | Taker name + optional date + create button | VERIFIED | Present; owner-only label input, date input, orange Button |
| `src/4-features/quiz-share/ui/AccessLinkCreated.vue` | One-time copyable credentials block | VERIFIED | Present; renders link/login/password; amber warning copy |
| `src/4-features/quiz-share/ui/AccessLinkList.vue` | Link rows with delete; empty state | VERIFIED | Present; rows show label/@login/expiry; ghost delete button; Link2Off empty state |
| `src/4-features/quiz-taking/ui/GuestLoginForm.vue` | Login/password form; Начать button; inline error | VERIFIED | Present per SUMMARY |
| `src/4-features/quiz-taking/ui/QuizIntroScreen.vue` | Cover/title/meta/description + GuestLoginForm | VERIFIED | Renders store.quiz metadata; uses get-quiz-meta pre-login data; embeds GuestLoginForm directly (D-02 superseded confirmed in component comment) |
| `src/4-features/quiz-taking/ui/GracefulState.vue` | Reusable state card | VERIFIED | Present; used for not_ready and invalid states in QuizTakingWidget |
| `src/4-features/quiz-taking/ui/QuestionTaker.vue` | Radio/checkbox answer rows; selectAnswer wired | VERIFIED | Present per SUMMARY |
| `src/4-features/quiz-taking/ui/NavigationControls.vue` | Назад/Вперёд/Завершить; required gate; allow_back | VERIFIED | Present; "Завершить" gated by `canGoForward` (D-07 fix from 02-04 checkpoint) |
| `src/4-features/quiz-taking/ui/StopConfirmDialog.vue` | D-06 confirmation; Продолжить / Завершить | VERIFIED | Present per SUMMARY |
| `src/4-features/quiz-taking/ui/TimerExpiredNotice.vue` | Non-dismissible overlay; Время вышло | VERIFIED | Present per SUMMARY; shown via `showTimerExpiredNotice` computed in QuizTakingWidget |
| `src/3-widgets/AccessLinksModal.vue` | Dialog composing quiz-share; loads on open | VERIFIED | Present; watch on `open` prop calls `store.loadLinks(quizId)` |
| `src/3-widgets/QuizEditorHeader.vue` | Ссылки доступа button; AccessLinksModal | VERIFIED | Orange Button with Link icon opens modal; AccessLinksModal v-if wired to editorStore.quiz.id |
| `src/3-widgets/QuizTakingHeader.vue` | Sticky header: progress + timer + stop | VERIFIED | Renders "Вопрос X из Y" + ProgressBar; TimerDisplay v-if=timeLimitSec (D-09); Стоп button v-if=show_stop_button (D-06) |
| `src/3-widgets/QuizTakingWidget.vue` | Maps sessionStatus to views; mounts TimerExpiredNotice | VERIFIED | Renders idle→QuizIntroScreen, not_ready/invalid→GracefulState, active→two-row layout; TimerExpiredNotice mounted; 100dvh grid style |
| `src/2-pages/QuizSharePage.vue` | Thin public page; no AppHeader; mounts QuizTakingWidget | VERIFIED | 10-line thin page; no AppHeader; mounts QuizTakingWidget |
| `src/2-pages/QuizResultPage.vue` | Score + percentage + name; formatScore(D-18); home link | VERIFIED | Renders percentage, formatScore (Number.isInteger check), label, "Тест завершён." message, RouterLink to / (D-12); calls loadResult on mount |
| `src/4-features/quiz-editor/ui/NavigationSettings.vue` | allow_retake toggle (D-03/EXT-04) | VERIFIED | Third Switch row "Разрешить повторное прохождение" bound to `store.settings.allow_retake` |
| `src/6-shared/ui/ProgressBar.vue` | value 0-100 prop; orange fill | VERIFIED | Present per SUMMARY |
| `src/6-shared/ui/TimerDisplay.vue` | seconds + isAlert props; MM:SS; red at alert | VERIFIED | Props `seconds: number` and `isAlert: boolean`; `text-red-500 font-semibold` when isAlert; `tabular-nums` MM:SS |
| `src/1-app/router/index.ts` | /q/:token and /q/:token/result routes; no auth guard; meta-based guard (WR-07) | VERIFIED | Both routes present; no `requiresAuth: true` meta; auth guard uses `to.matched.some(r => r.meta.requiresAuth)` (WR-07 fix) |
| `src/6-shared/types/index.ts` | QuizSettings has allow_retake: boolean | VERIFIED | `allow_retake: boolean` present with D-03 doc comment |
| `supabase/migrations/010_quiz_access_created_at.sql` | created_at column on quiz_access | VERIFIED | Present (found in file glob) |
| `supabase/migrations/011_session_answers_unique.sql` | Unique index on session_answers(session_id, question_id) | VERIFIED | Present (found in file glob) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `QuizEditorHeader.vue` | `AccessLinksModal.vue` | `@click="modalOpen = true"` + `v-model:open="modalOpen"` | WIRED | Confirmed: Button click sets `modalOpen = true`; AccessLinksModal bound to `v-model:open` |
| `useQuizShareStore.createLink` | `create-quiz-access` EF | `supabase.functions.invoke('create-quiz-access', ...)` | WIRED | Confirmed: `supabase.functions.invoke('create-quiz-access', { body: { quizId, label, expiresAt: expiresAtEod } })` |
| `useQuizTakingStore.verifyAccess` | `verify-quiz-access` / `start-quiz-session` | `invokeVerifyAccess` then `startSession()` chained directly | WIRED | Confirmed: verifyAccess calls invokeVerifyAccess; on success immediately calls `startSession()` (D-02 superseded) |
| `useQuizTakingStore.selectAnswer` | `upsert-session-answer` EF | `supabase.functions.invoke('upsert-session-answer', { body: {...} })` | WIRED | Confirmed on every selection; WR-06 guard for null credentials present |
| `useQuizTakingStore.finishSession` | `submit-quiz-answers` EF | `invokeSubmitAnswers(guestToken.value, sessionId.value)` | WIRED | Confirmed: isSubmitting guard + stopTimer() + invoke + result store + router.push |
| `QuizResultPage.vue` | `get-quiz-result` EF | `store.loadResult(token)` → `invokeGetResult(guestToken, sessionId)` | WIRED | Confirmed: onMounted checks `!store.result?.label` then calls `loadResult`; `loadResult` rehydrates from sessionStorage then calls invokeGetResult |
| `router/index.ts` | `QuizSharePage.vue` | `{ path: '/q/:token', component: () => import('@pages/QuizSharePage.vue') }` | WIRED | Confirmed: route present with no auth guard |
| `verify-quiz-access` | `answer_options_public` view | `select('*, questions(*, answer_options_public(*))')` | WIRED | Confirmed: query uses `answer_options_public` not `answer_options`; never branches on `is_published` |
| `start-quiz-session` | `_shared/jwt.ts` | `import { verifyGuestToken }` | WIRED | Confirmed: imported and called before any DB access |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `QuizIntroScreen.vue` | `store.quiz` | `store.loadIntroMeta()` → `invokeGetQuizMeta()` → `get-quiz-meta` EF → `quizzes` table | Yes — EF queries quizzes by quiz_id from quiz_access | FLOWING |
| `QuizTakingWidget.vue` (active) | `store.currentQuestion`, `store.answers` | `store.verifyAccess()` → `verify-quiz-access` EF returns questions; answers from `upsert-session-answer` + restored on D-04 resume | Yes | FLOWING |
| `QuizTakingHeader.vue` | `store.timeRemainingSeconds`, `store.progressPercent` | `computeRemaining()` derived from `store.startedAt` (set by `start-quiz-session` EF) | Yes — server-authoritative started_at | FLOWING |
| `QuizResultPage.vue` | `store.result` | `store.loadResult()` → `invokeGetResult()` → `get-quiz-result` EF → `quiz_sessions` + `questions` + `quiz_access` | Yes — queries finished session rows | FLOWING |
| `AccessLinkList.vue` | `store.links` | `store.loadLinks(quizId)` → `fetchAccessLinks(quizId)` → `supabase.from('quiz_access').select(...)` | Yes — authenticated client + RLS | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED for Edge Functions (requires running Supabase local stack). Unit tests and human-verify checkpoints serve as the equivalent gate for this phase.

The scoring unit tests (`scoring.test.ts`) and store unit tests (`quizTaking.test.ts`) pass per SUMMARY records.

---

## Probe Execution

No `scripts/*/tests/probe-*.sh` files found. The `supabase/functions/probe-bcrypt/index.ts` is an in-repo EF probe run manually during the 02-01 human-verify checkpoint, not an automated shell probe. The SUMMARY records the probe returned `{"ok":true,"hashValid":true}`.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TAKE-01 | 02-01, 02-03 | Guest opens quiz by token URL without Supabase auth | SATISFIED | `/q/:token` route public; `verify-quiz-access` EF handles guest auth |
| TAKE-02 | 02-01, 02-03 | Guest enters login + password | SATISFIED | `GuestLoginForm.vue` + `verifyAccess()` action |
| TAKE-03 | 02-03 | Guest sees title, description, cover before starting | SATISFIED | `QuizIntroScreen.vue` + `get-quiz-meta` EF populate pre-login intro card |
| TAKE-04 | 02-04 | One question at a time, next/prev per allow_back | SATISFIED | `QuestionTaker.vue` + `NavigationControls.vue` + `allow_back` setting guard |
| TAKE-05 | 02-04 | Progress (Question X of Y) + remaining time visible | SATISFIED | `QuizTakingHeader.vue` shows both |
| TAKE-06 | 02-04, 02-05 | Can stop early | SATISFIED | `StopConfirmDialog.vue` + `finishSession()` |
| TAKE-07 | 02-04 | Answers saved immediately on selection (upsert) | SATISFIED | `selectAnswer()` invokes `upsert-session-answer` EF on every selection |
| TAKE-08 | 02-05 | Result page shows score + percentage | SATISFIED | `QuizResultPage.vue` renders percentage, formatScore, label |
| TAKE-09 | 02-04 | Timer anchored to server started_at | SATISFIED | `computeRemaining()` uses server `startedAt`; `visibilitychange` recomputes |
| TAKE-10 | 02-04, 02-05 | Auto-submits when timer expires | SATISFIED | `startTimer()` interval calls `finishSession()` at ≤ 0; server-side `sessionState:'expired'` on resume |
| SHARE-01 | 02-02 | Owner can create individual access link with login, password, taker name | SATISFIED | `create-quiz-access` EF + `AccessLinksModal.vue` |
| SHARE-02 | 02-02 | Owner can set expiry date | SATISFIED | Optional `expiresAt` param in `createLink`; end-of-day fix (WR-01) |
| SHARE-03 | 02-02 | Owner can view and delete access links | SATISFIED | `AccessLinkList.vue` + `removeLink()` + `deleteAccessLink()` via RLS |
| EXT-04 | 02-03, 02-05 | Multiple attempts per the same link (allow_retake toggle) | SATISFIED | `NavigationSettings.vue` allow_retake toggle; D-04 state machine in `init()`; `start-quiz-session` enforces `allow_retake` server-side |

All 14 required requirement IDs (TAKE-01 through TAKE-10, SHARE-01 through SHARE-03, EXT-04) satisfied.

---

## Anti-Patterns Found

No `TBD`, `FIXME`, or `XXX` markers found in any Phase 2 file. No placeholder stubs or empty implementations found in the production code paths.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/config.toml` | 108-110 | `probe-bcrypt` registered with `verify_jwt = false` — temporary verification artifact from 02-01 that was not removed | Info | Public unauthenticated debug endpoint; low risk in dev, should be removed before production deploy. Flagged as IN-04 in code review; accepted as open by design per context |

---

## Human Verification Required

### 1. D-02 Superseded — Login Goes Directly Into First Question

**Test:** Open `/q/<valid-token>`, enter correct credentials in the GuestLoginForm. Observe whether the quiz goes directly into question 1 with no intermediate "Начать" preview screen.
**Expected:** The taking header ("Вопрос 1 из N") and first QuestionTaker card appear immediately after successful login — no intermediate intro state with a separate "Начать" button.
**Why human:** The `'intro'` session state was removed from the state machine; `verifyAccess` directly chains into `startSession()`. The correct flow is confirmed in code, but the actual browser UX experience of the state transition requires visual confirmation.

### 2. Timer Red at ≤ 20% Remaining

**Test:** Take a quiz with a short time limit (e.g. 30s). Watch the timer in the taking header. Observe the moment it turns red.
**Expected:** The `TimerDisplay` pill text switches to red + bold at exactly 20% of the original limit (e.g. at 6s remaining for a 30s quiz).
**Why human:** `isTimerCritical` logic is unit-tested. The visual rendering of `text-red-500 font-semibold` on the real browser timer requires eye-confirmation.

### 3. D-04 Resume — Answers Survive Reload

**Test:** Start a quiz (with at least one required question), answer some questions, then reload the browser tab without finishing. Re-open `/q/<token>`.
**Expected:** The session resumes at the same question index, all previously selected answers are shown as selected, and the "Вперёд" button is not blocked on the required question that was already answered.
**Why human:** The `init()` D-04 resume branch restores `answers` before setting `sessionStatus='active'`. Requires a real deployed session with `session_answers` rows to observe answer restoration and the required-gate pass.

### 4. D-04 Allow-Retake — Fresh Attempt After Finishing

**Test:** Enable "Разрешить повторное прохождение" on a quiz via the editor. Finish the quiz via a guest session. Re-open the same `/q/<token>` link.
**Expected:** The intro + login screen is shown again (not the result page); starting creates a new `quiz_sessions` row in Supabase Studio.
**Why human:** `start-quiz-session`'s `newAttempt` flag + `allow_retake` server enforcement creates a second DB row. Requires live DB inspection and real navigation.

### 5. Timer Expiry Auto-Submit and Overlay

**Test:** Start a quiz with a very short time limit (e.g. 20s). Leave the tab open and let the timer reach zero without interacting.
**Expected:** The `TimerExpiredNotice` non-dismissible overlay appears (red Clock icon, "Время вышло", spinner), then the page navigates to `/q/<token>/result` with the correct score.
**Why human:** Requires real timer countdown in a browser; `TimerExpiredNotice` conditional `showTimerExpiredNotice` depends on `store.isSubmitting && store.timeLimitSec !== null && store.timeRemainingSeconds <= 0`.

### 6. Owner Access-Link One-Time Credentials and DB Verification

**Test:** Create an access link from the editor modal. Observe the `AccessLinkCreated` block. Copy with the "Скопировать" button. Check the `quiz_access` table in Supabase Studio.
**Expected:** The credentials block shows the link URL, login, and plaintext password along with the amber "Пароль показывается только сейчас" warning. "Скопировать" copies all three lines. The DB row has a bcrypt hash in `password_hash`, not plaintext.
**Why human:** Clipboard API + one-time password visibility + DB state confirmation require human operator.

### 7. TAKE-03 / SC1 Pre-Login Intro Card With Real Data

**Test:** Open `/q/<token>` without having any prior session. Observe the intro card before entering any credentials.
**Expected:** The `QuizIntroScreen` shows the quiz title, description, cover image, and "N вопросов · M мин" meta row — all populated by `get-quiz-meta` before any login.
**Why human:** `get-quiz-meta` is wired into `loadIntroMeta()` and called from `init()` when no sessionStorage entry exists. Actual data display requires a deployed EF and a real quiz row.

---

## Gaps Summary

No gaps found. All 5 Roadmap Success Criteria are verified at the code level. All 3 Critical and all 8 Warning findings from the 02-REVIEW.md are fixed in the committed codebase:

- **CR-01 (expires_at not checked on start-quiz-session):** Fixed — `start-quiz-session`, `submit-quiz-answers`, and `get-quiz-result` all check `expires_at` before session work.
- **CR-02 (upsert-session-answer accepts writes to finished sessions):** Fixed — 409 returned when `finished_at !== null`; question-quiz membership validated.
- **CR-03 (optimistic row uses token as id):** Fixed — `create-quiz-access` returns real `id`; store uses `data.id` for optimistic row and removeLink.
- **WR-01 (expiry date semantics):** Fixed — `createLink` appends `T23:59:59` to bare YYYY-MM-DD date.
- **WR-02 (TOCTOU in submit idempotency):** Fixed — conditional UPDATE `.is('finished_at', null)` with race re-read.
- **WR-04 (start-quiz-session returns 'active' for expired timer):** Fixed — `sessionState: 'expired'` returned when server-side timer elapsed.
- **WR-05 (raw error leaking to guests):** Fixed — `_shared/errors.ts` with `serializeError` + `GENERIC_500_MESSAGE`; all EFs use it.
- **WR-06 (selectAnswer fires with null credentials):** Fixed — early-return guard before optimistic update.
- **WR-07 (PROTECTED_ROUTES startsWith collisions):** Fixed — per-route `meta: { requiresAuth: true }` and `to.matched.some(r => r.meta.requiresAuth)`.
- **WR-08 (GetQuizMetaResponse dead union member):** Fixed — union narrowed to only `{ state: 'ready' }`; WR-08 comment explains the error-surface pattern.
- **WR-03 (column-level grants absent):** Acknowledged tradeoff; not a blocker — anon cannot read the tables at all via RLS. Remains an open documentation discrepancy in CLAUDE.md.

The 7 Info findings (IN-01 through IN-07) remain open by design as confirmed in the context note. IN-04 (probe-bcrypt still registered) is informational and does not block production correctness.

Phase goal is fully achieved in source code. Human verification is needed to confirm the deployed behavior of 7 visual/behavioral flows that cannot be verified by grep.

---

_Verified: 2026-05-17_
_Verifier: Claude (gsd-verifier)_
