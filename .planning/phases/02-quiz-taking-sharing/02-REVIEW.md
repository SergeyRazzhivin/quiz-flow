---
phase: 02-quiz-taking-sharing
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - src/1-app/router/index.ts
  - src/2-pages/QuizResultPage.vue
  - src/2-pages/QuizSharePage.vue
  - src/3-widgets/AccessLinksModal.vue
  - src/3-widgets/QuizEditorHeader.vue
  - src/3-widgets/QuizTakingHeader.vue
  - src/3-widgets/QuizTakingWidget.vue
  - src/4-features/quiz-editor/model/useQuizEditorStore.ts
  - src/4-features/quiz-editor/ui/NavigationSettings.vue
  - src/4-features/quiz-share/model/useQuizShareStore.ts
  - src/4-features/quiz-share/ui/AccessLinkCreated.vue
  - src/4-features/quiz-share/ui/AccessLinkForm.vue
  - src/4-features/quiz-share/ui/AccessLinkList.vue
  - src/4-features/quiz-taking/model/useQuizTakingStore.ts
  - src/4-features/quiz-taking/ui/GracefulState.vue
  - src/4-features/quiz-taking/ui/GuestLoginForm.vue
  - src/4-features/quiz-taking/ui/NavigationControls.vue
  - src/4-features/quiz-taking/ui/QuestionTaker.vue
  - src/4-features/quiz-taking/ui/QuizIntroScreen.vue
  - src/4-features/quiz-taking/ui/StopConfirmDialog.vue
  - src/4-features/quiz-taking/ui/TimerExpiredNotice.vue
  - src/5-entities/quiz-access/api.ts
  - src/5-entities/quiz-access/model.ts
  - src/5-entities/quiz-session/api.ts
  - src/5-entities/quiz-session/model.ts
  - src/6-shared/types/index.ts
  - src/6-shared/ui/ProgressBar.vue
  - src/6-shared/ui/TimerDisplay.vue
  - supabase/config.toml
  - supabase/functions/_shared/cors.ts
  - supabase/functions/_shared/jwt.ts
  - supabase/functions/_shared/scoring.ts
  - supabase/functions/create-quiz-access/index.ts
  - supabase/functions/get-quiz-meta/index.ts
  - supabase/functions/get-quiz-result/index.ts
  - supabase/functions/start-quiz-session/index.ts
  - supabase/functions/submit-quiz-answers/index.ts
  - supabase/functions/upsert-session-answer/index.ts
  - supabase/functions/verify-quiz-access/index.ts
  - supabase/migrations/009_phase2_schema.sql
  - supabase/migrations/010_quiz_access_created_at.sql
  - supabase/migrations/011_session_answers_unique.sql
findings:
  critical: 3
  warning: 8
  info: 7
  total: 18
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found

## Summary

Phase 2 (Quiz Taking & Sharing) implements the guest-auth boundary, server-anchored
timer, server-side scoring, and access-link management. The core security posture is
mostly sound: `is_correct` never appears in any guest-facing response (all guest reads
go through `answer_options_public`; only `submit-quiz-answers` reads the base table via
`service_role`), `password_hash` is hand-filtered out of every select list, scoring is
server-computed and the client-supplied score is ignored, and the timer is computed from
the server `started_at` anchor.

However, three Critical issues remain. (1) `start-quiz-session` never checks
`quiz_access.expires_at`, so a guest who logged in before the link expired can keep
starting/resuming/retaking sessions for the full 1-hour guest-token TTL after the owner's
expiry date — an authorization gap. (2) `upsert-session-answer` accepts answers for an
already-finished session and for any `questionId` UUID, with no expiry or
session-state check. (3) `useQuizShareStore.createLink` stores the access token as the
optimistic row `id`, so deleting a freshly-created link before reload calls
`deleteAccessLink` with the wrong identifier and silently deletes nothing while removing
it from the UI. Several Warnings concern expiry-date semantics, a TOCTOU window in the
"idempotent" submit path, and inconsistent error serialization.

Note on project convention: `CLAUDE.md` states `is_correct` / `password_hash` should be
protected by *column-level grants*. The migrations contain **no** `GRANT`/`REVOKE`
statements — protection relies entirely on RLS having no `anon` policy on `quiz_access`
plus the `answer_options_public` view. This works in practice (anon cannot read those
tables at all), but the stated "column-level grants" defense does not exist. Flagged as a
Warning so the discrepancy is resolved deliberately rather than silently.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `start-quiz-session` never checks `quiz_access.expires_at`

**File:** `supabase/functions/start-quiz-session/index.ts:22-146`
**Issue:** `verify-quiz-access` and `get-quiz-meta` both reject expired access links
(`access.expires_at && new Date(...) < new Date()` → 410). `start-quiz-session` does
not. It verifies only the guest token (1-hour TTL) and reads `quiz_access` indirectly
via the token's `quiz_access_id` — it never loads `expires_at`. Consequence: a guest who
logged in one minute before the owner's expiry date keeps a valid `guestToken` for a
full hour and can, during that window, start a brand-new session, resume an open session,
and (with `allow_retake`) create unlimited fresh attempts — all against an access link
the owner has already expired. The same gap lets `submit-quiz-answers` and
`get-quiz-result` operate on an expired link. Expiry is meant to be an authorization
boundary; right now it is only enforced at the login gate, not on subsequent calls.
**Fix:** In `start-quiz-session` (and ideally `submit-quiz-answers` / `get-quiz-result`),
load and check expiry before doing session work:
```ts
const { data: access } = await supabase
  .from('quiz_access')
  .select('expires_at')
  .eq('id', payload.quiz_access_id)
  .single()
if (access?.expires_at && new Date(access.expires_at) < new Date()) {
  return new Response(JSON.stringify({ error: 'Срок действия ссылки истёк' }), {
    status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
```
Alternatively, clamp the guest-token `exp` to `min(now + 1h, access.expires_at)` when
signing it in `verify-quiz-access`, so the token itself cannot outlive the link.

### CR-02: `upsert-session-answer` accepts writes to finished sessions and unvalidated `questionId`

**File:** `supabase/functions/upsert-session-answer/index.ts:35-62`
**Issue:** The function confirms the session belongs to the token's `quiz_access_id`,
but it never checks `finished_at`. A guest can call `upsert-session-answer` after
`submit-quiz-answers` has already finalized the session — the score is locked by
idempotency, but the underlying answer rows are still mutable, which corrupts the
owner's Phase-4 statistics view and contradicts the "answers sized at completion time"
promise shown in `StopConfirmDialog`. Additionally, `questionId` and `selectedOptionIds`
are written straight to `session_answers` with no validation that the question belongs
to the session's quiz, or that the option IDs belong to the question. The FK only
guarantees the `questionId` is *some* valid question; a forged request can create
`session_answers` rows referencing questions from an unrelated quiz.
**Fix:** Reject writes once the session is finished, and validate the question:
```ts
const { data: session } = await supabase
  .from('quiz_sessions')
  .select('id, quiz_access_id, quiz_id, finished_at')
  .eq('id', sessionId)
  .maybeSingle()
if (!session || session.quiz_access_id !== payload.quiz_access_id) { /* 403 */ }
if (session.finished_at !== null) { /* 409 — session already finished */ }

const { data: q } = await supabase
  .from('questions').select('id').eq('id', questionId)
  .eq('quiz_id', session.quiz_id).maybeSingle()
if (!q) { /* 400 — question not in this quiz */ }
```

### CR-03: Optimistic access link uses the token as its row `id`, breaking delete-before-reload

**File:** `src/4-features/quiz-share/model/useQuizShareStore.ts:42-50`
**Issue:** `createLink` optimistically prepends a `QuizAccess` object with
`id: data.token` (a comment even admits it is "temporary"). `removeLink(id)` passes that
value straight to `deleteAccessLink(id)`, which runs
`supabase.from('quiz_access').delete().eq('id', id)`. Because `id` and `token` are
different columns (`id` is the PK uuid, `token` is a separate uuid), the delete matches
zero rows. The catch block is not triggered (Supabase returns success with zero affected
rows), so `removeLink` proceeds to `links.value.filter(...)` and `toast.success('Ссылка
удалена.')` — the link vanishes from the UI but **still exists in the database and is
still usable by the quiz-taker**. The owner believes they revoked access; they did not.
The bug only self-heals if the modal is closed and reopened (triggering `loadLinks`).
**Fix:** Have `create-quiz-access` return the real row `id` and use it:
```ts
// create-quiz-access/index.ts — also select id
.select('id, token').single()
// store — use the real id
links.value.unshift({ id: data.id, quiz_id: quizId, token: data.token, ... })
```
Or, simpler, re-run `loadLinks(quizId)` after a successful create instead of an
optimistic unshift.

## Warnings

### WR-01: `expires_at` date semantics — link expires at the *start* of the chosen day

**File:** `src/4-features/quiz-share/ui/AccessLinkForm.vue:39-44`, `src/4-features/quiz-share/ui/AccessLinkList.vue:8-15`, `supabase/functions/verify-quiz-access/index.ts:69`
**Issue:** The owner picks an expiry via `<Input type="date">`, which yields a bare
`YYYY-MM-DD` string. Stored into a `timestamptz` column this becomes `00:00:00 UTC` of
that day. The expiry check `new Date(access.expires_at) < new Date()` therefore expires
the link at the *very beginning* of the selected date. Meanwhile `AccessLinkList`
displays `до DD.MM.YYYY`, which a user reads as "valid through that day (inclusive)".
A link set to expire "10.06" is dead from 00:00 on 10.06, not 23:59 — an off-by-one-day
surprise for the owner and taker. There is also a timezone skew: a Moscow-based owner
picking a date gets a UTC-midnight cutoff three hours earlier than local midnight.
**Fix:** When persisting, convert the date to end-of-day in the owner's intended
timezone, e.g. send `${expiresAt}T23:59:59` (or `T20:59:59Z` for MSK) so the link is
valid through the displayed day. Decide and document the inclusive/exclusive contract.

### WR-02: `submit-quiz-answers` "idempotency" has a TOCTOU race — not safe under concurrent submits

**File:** `supabase/functions/submit-quiz-answers/index.ts:53-130`
**Issue:** The header comment claims the function is idempotent and "handles the
timer-expiry + manual stop double-submit race." The check is read-then-write:
it reads `finished_at`/`score`, and if null proceeds to score and `UPDATE`. Two requests
that both pass the `finished_at IS NULL` read before either `UPDATE` lands will both
score the session and both write — the second overwrites the first, and scoring runs
twice. The `UPDATE` is unconditional (`.eq('id', sessionId)` only), so there is no DB-level
guard. The client-side `isSubmitting` flag mitigates the same-tab case, but the
EF cannot rely on a client flag for an idempotency guarantee, and timer-expiry across two
tabs/devices is exactly the unguarded path.
**Fix:** Make the finalizing `UPDATE` conditional so only the first writer wins, then
re-read on a zero-row result:
```ts
const { data: updated } = await supabase
  .from('quiz_sessions')
  .update({ finished_at: new Date().toISOString(), score: totalScore })
  .eq('id', sessionId)
  .is('finished_at', null)   // only finalize if still open
  .select('score')
if (!updated || updated.length === 0) {
  // lost the race — re-read the stored score and return it
}
```

### WR-03: Project-stated column-level grants for `is_correct` / `password_hash` do not exist

**File:** `supabase/migrations/003_questions_answers.sql:30-34`, `supabase/migrations/007_rls_policies.sql:53-65`
**Issue:** `CLAUDE.md` ("Critical Pitfalls") and several EF comments
(`create-quiz-access` line 5, `quiz-access/model.ts` line 4) state that `is_correct` and
`password_hash` are protected by *column-level grants*. No migration contains a `GRANT`
or `REVOKE`. Protection currently rests on: (a) no `anon` RLS policy on `answer_options`
or `quiz_access` at all, and (b) the `answer_options_public` view. That is effective —
anon cannot read those tables — but the documented defense-in-depth layer is absent, and
the `003` comment calls `answer_options_public` a "SECURITY DEFINER view" when it is a
plain `CREATE VIEW` (no `security_invoker`/`security_definer` clause). If a future
migration ever adds an `anon` SELECT policy to `answer_options` for any reason, nothing
column-level would stop `is_correct` leaking.
**Fix:** Either add the grants the docs promise
(`REVOKE SELECT ON answer_options FROM anon; GRANT SELECT (id, question_id, body,
order_index) ON answer_options TO anon;` and similar for `quiz_access`), or correct
`CLAUDE.md` and the EF comments to describe the actual RLS-only mechanism. Also fix the
misleading "SECURITY DEFINER" comment in `003`.

### WR-04: `start-quiz-session` resumes an open session whose timer has already expired

**File:** `supabase/functions/start-quiz-session/index.ts:79-100`
**Issue:** When an open session exists (`finished_at IS NULL`), the function returns it
with `sessionState: 'active'` regardless of whether `started_at + time_limit_sec` has
already passed. The store (`init`, lines 321-334) recomputes remaining time and
auto-submits if expired, so the user-visible behavior is usually correct — but the EF
hands an "active" session to any caller, and a client that ignores the timer (or a
direct API call) can keep submitting answers to a session that should be closed. The
timer-expiry enforcement lives only on the client.
**Fix:** In the resume branch, if the quiz has a `time_limit_sec` and
`started_at + time_limit_sec < now`, either auto-finalize the session server-side or
return `sessionState: 'finished'` (or a dedicated `expired` state) so the server, not
the client, is the source of truth for timer expiry.

### WR-05: `verify-quiz-access` and `create-quiz-access` leak raw errors via `String(err)`

**File:** `supabase/functions/verify-quiz-access/index.ts:137-141`, `supabase/functions/create-quiz-access/index.ts:112-117`
**Issue:** These two functions return `JSON.stringify({ error: String(err) })` in the
500 handler. The other Phase-2 EFs (`start-quiz-session`, `submit-quiz-answers`,
`get-quiz-result`, `upsert-session-answer`) all use the richer Error/object serializer
specifically because `String(err)` on a Postgrest error object yields the useless
`[object Object]`. Beyond the inconsistency, returning the raw serialized error to an
unauthenticated guest can disclose internal details (table names, constraint names,
connection errors). Guest-facing 500s should return a generic message and log the
detail server-side.
**Fix:** Reuse the shared serializer for logging, but return a generic
`{ error: 'Внутренняя ошибка сервера' }` to the client. Consider extracting the
serializer into `_shared/` so all six EFs are consistent.

### WR-06: `selectAnswer` fires the upsert with no guard for missing session credentials

**File:** `src/4-features/quiz-taking/model/useQuizTakingStore.ts:449-478`
**Issue:** `selectAnswer` performs the optimistic local update and then invokes
`upsert-session-answer` with `guestToken: guestToken.value` and `sessionId:
sessionId.value`. If either is `null` (e.g. a click lands during the brief window before
`startSession` resolves, or after a token-clear), the body carries `null`, the EF
returns 403, and the user sees "Ошибка сохранения ответа" — yet the local `answers` map
was already mutated, so the UI shows the answer as saved while the DB has nothing. On a
later refresh the answer is silently lost (the exact "answer loss on refresh" pitfall the
upsert pattern is meant to prevent).
**Fix:** Early-return (and ideally roll back the optimistic update or queue a retry) when
`guestToken.value` or `sessionId.value` is null:
```ts
if (!guestToken.value || !sessionId.value) {
  toast.error('Сессия не готова. Попробуйте ещё раз.')
  return
}
```

### WR-07: `PROTECTED_ROUTES` guard uses `startsWith` — prefix collisions

**File:** `src/1-app/router/index.ts:4,22`
**Issue:** `requiresAuth` is computed as
`PROTECTED_ROUTES.some(r => to.path.startsWith(r))` with `PROTECTED_ROUTES = ['/my',
'/editor']`. Any future route whose path begins with `/my` or `/editor` (e.g.
`/myaccount`, `/editorial`) is unintentionally caught by the auth guard. Conversely the
match is purely textual, so it is fragile against route renames. It is not currently
exploitable, but it is a latent correctness trap.
**Fix:** Match against route segments or use per-route `meta: { requiresAuth: true }`
and check `to.matched.some(r => r.meta.requiresAuth)`.

### WR-08: `GetQuizMetaResponse` `{ state: 'invalid' }` branch is unreachable

**File:** `src/5-entities/quiz-session/api.ts:25-28,72-78`, `supabase/functions/get-quiz-meta/index.ts:59-72`
**Issue:** `get-quiz-meta` returns `{ state: 'invalid' }` with HTTP 404/410. But
`supabase.functions.invoke` treats any non-2xx status as an error and populates `error`,
not `data` — so `invokeGetQuizMeta` throws before it can return the `{ state: 'invalid' }`
shape. The `GetQuizMetaResponse` union's `{ state: 'invalid' }` member is therefore dead;
the `else` branch in `loadIntroMeta` (line 209) that handles `res.state !== 'ready'` is
also unreachable. Behavior is still correct because the surrounding `try/catch` maps the
throw to `sessionStatus = 'invalid'`, but the type and the branch are misleading and will
confuse future maintainers (and the same pattern hides real bugs elsewhere if a 200-with-
error-body is ever expected).
**Fix:** Either return the invalid state as HTTP 200 with `{ state: 'invalid' }` so the
discriminated union actually flows through `data`, or drop the dead union member and the
unreachable `else` branch and document that invalid tokens always surface as a thrown
error.

## Info

### IN-01: `corsHeaders` omits `Access-Control-Allow-Methods`

**File:** `supabase/functions/_shared/cors.ts:6-9`
**Issue:** The shared CORS headers set `Allow-Origin` and `Allow-Headers` but not
`Access-Control-Allow-Methods`. Browsers default a preflight to `GET`/`HEAD`/`POST`, so
the POST-based `functions.invoke` calls happen to work, but the preflight contract is
incomplete and any future non-POST method would silently fail CORS.
**Fix:** Add `'Access-Control-Allow-Methods': 'POST, OPTIONS'`.

### IN-02: `progressPercent` reports 100% while still on the last (unanswered) question

**File:** `src/4-features/quiz-taking/model/useQuizTakingStore.ts:102-105`
**Issue:** `progressPercent` uses `(currentQuestionIndex + 1) / length`, so the moment
the taker reaches the final question the progress bar shows 100% even though the quiz is
not submitted and the last question may be unanswered. Minor UX inaccuracy.
**Fix:** If "completed" should mean "answered," base the numerator on the count of
answered questions, or cap visible progress below 100% until submission.

### IN-03: `start-quiz-session` / `verify-quiz-access` nested select can hit the 1000-row API cap

**File:** `supabase/config.toml:14`, `supabase/functions/start-quiz-session/index.ts:46-52`
**Issue:** `max_rows = 1000` caps any view/table/proc payload. The
`quizzes.select('*, questions(*, answer_options_public(*)))` nested select pulls all
questions and all answer options in one response; a quiz with more than ~1000 combined
nested rows would be silently truncated, producing a quiz with missing questions/options
for the taker. Unlikely at current product scale but worth a guard.
**Fix:** Note the limit; if large quizzes are ever in scope, paginate or raise the cap
deliberately.

### IN-04: `probe-bcrypt` temporary debug function still registered

**File:** `supabase/config.toml:108-110`
**Issue:** `config.toml` registers `[functions.probe-bcrypt]` with `verify_jwt = false`,
described in-comment as a "temporary bcrypt runtime verification probe." A public,
unauthenticated debug endpoint should not ship to production.
**Fix:** Remove the `probe-bcrypt` function and its config block before release.

### IN-05: `init` and `loadResult` duplicate the sessionStorage parse/rehydrate logic

**File:** `src/4-features/quiz-taking/model/useQuizTakingStore.ts:235-251,540-555`
**Issue:** Both `init` and `loadResult` independently read `storageKey`, `JSON.parse` the
stored blob, and pull `guestToken`/`sessionId` with the same corrupt-storage `try/catch`.
The shapes drift (one also reads `currentQuestionIndex`). Duplicated parsing logic is a
maintenance hazard — a fix to one path can miss the other.
**Fix:** Extract a single `readStoredSession(token)` helper that returns a typed object
and is used by both.

### IN-06: `verifyGuestToken` casts payload without validating required claims

**File:** `supabase/functions/_shared/jwt.ts:32-39`
**Issue:** `verifyGuestToken` returns `payload as GuestTokenPayload` after a successful
signature/expiry check, but does not assert that `quiz_access_id` and `quiz_id` are
present and are strings. A signature is verified, so a forged payload is not a real
threat, but a malformed token signed with the correct secret (or a future signer bug)
would pass through with `undefined` claims and surface as a confusing downstream DB error
instead of a clean 401.
**Fix:** After `jwtVerify`, validate that both `quiz_access_id` and `quiz_id` are
non-empty strings; return `null` otherwise.

### IN-07: Owner storage error in `createLink` shows a generic toast that can mask the real cause

**File:** `src/4-features/quiz-share/model/useQuizShareStore.ts:52-54`
**Issue:** `createLink`'s catch swallows the actual error and always shows "Ошибка
создания ссылки." This hides distinct failure modes (network, 403 not-owner, 500). Low
severity, but it makes field debugging of the owner flow harder.
**Fix:** Log the underlying error (`console.error(err)` or a logger) before the toast,
or branch the message on the error status.

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
