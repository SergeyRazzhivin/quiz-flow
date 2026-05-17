---
phase: 02-quiz-taking-sharing
plan: 02
subsystem: ui
tags: [supabase, edge-functions, deno, bcryptjs, crypto, vue, pinia, radix-vue, fsd, rls]

# Dependency graph
requires:
  - phase: 02-quiz-taking-sharing
    provides: "Plan 02-01 — Edge Function foundation (_shared/cors.ts), verified bcryptjs-in-Deno runtime, quiz_access table (migration 004), config.toml convention (create-quiz-access intentionally omitted -> keeps verify_jwt=true)"
  - phase: 01-foundation
    provides: "quiz_access table (migration 004), owner_manage_quiz_access RLS policy, QuizEditorHeader.vue, radix-vue Dialog pattern (DeleteQuizDialog.vue), shared UI primitives (Input, Button)"
provides:
  - "create-quiz-access Edge Function: owner-authenticated link creation — verifies quiz ownership, generates an 8-char login + 16-char password via crypto.getRandomValues, bcrypt-hashes the password (cost 10), returns { token, login, password } with plaintext password exactly once (D-14, D-15)"
  - "quiz-access entity layer: QuizAccess model (no password_hash field) + api.ts (fetchAccessLinks / deleteAccessLink, owner-authenticated, RLS-scoped)"
  - "useQuizShareStore — quiz-share Pinia store (links, isLoading, isCreating, lastCreated; loadLinks / createLink / removeLink)"
  - "quiz-share UI: AccessLinkForm, AccessLinkCreated (one-time copyable credentials block), AccessLinkList (label/login/expiry + delete, no completion status)"
  - "AccessLinksModal widget composing the quiz-share feature, opened from a 'Ссылки доступа' button in QuizEditorHeader (D-13)"
affects: [02-03, 02-04, 02-05, phase-4-statistics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner-authenticated Edge Function: omit the function from config.toml so verify_jwt defaults to true; the EF still re-verifies quiz ownership (owner_id === user.id) because the service_role client bypasses RLS"
    - "Cryptographically secure credential generation via crypto.getRandomValues over a safe alphabet — never Math.random"
    - "quiz-share is a self-contained FSD vertical slice (entity -> feature store/UI -> widget); UI components import only from @entities/@shared (no feature-to-feature imports)"

key-files:
  created:
    - supabase/functions/create-quiz-access/index.ts
    - supabase/migrations/010_quiz_access_created_at.sql
    - src/5-entities/quiz-access/model.ts
    - src/5-entities/quiz-access/api.ts
    - src/4-features/quiz-share/model/useQuizShareStore.ts
    - src/4-features/quiz-share/ui/AccessLinkForm.vue
    - src/4-features/quiz-share/ui/AccessLinkCreated.vue
    - src/4-features/quiz-share/ui/AccessLinkList.vue
    - src/3-widgets/AccessLinksModal.vue
  modified:
    - src/3-widgets/QuizEditorHeader.vue

key-decisions:
  - "create-quiz-access keeps verify_jwt=true by being intentionally absent from config.toml; ownership is still re-checked inside the EF because service_role bypasses RLS"
  - "login (8 chars) and password (16 chars) auto-generated server-side via crypto.getRandomValues; the owner sets only the label (D-14)"
  - "Plaintext password is returned exactly once at creation and never stored — only a bcrypt hash (cost 10) persists (D-15); delete/list go through the authenticated client + RLS, no EF needed (RESEARCH Assumption A4)"

patterns-established:
  - "Owner-authenticated Edge Function pattern: config.toml omission -> verify_jwt=true, plus an explicit in-handler ownership check guarding the service_role client"
  - "One-time credentials block (AccessLinkCreated.vue): shown once when store.lastCreated is set, with an amber irreversibility warning and copy-all-to-clipboard"
  - "Self-contained FSD vertical slice: entity api/model -> feature store + UI -> composing widget, opened from an existing header"

requirements-completed: [SHARE-01, SHARE-02, SHARE-03]

# Metrics
duration: ~1 day (spanned a blocking human-verify checkpoint)
completed: 2026-05-17
---

# Phase 2 Plan 02: Owner Access-Link Slice Summary

**The complete owner-facing access-link slice — a `create-quiz-access` Edge Function (ownership-checked, crypto-generated credentials, bcrypt-hashed password, plaintext returned once), the quiz-access entity layer, `useQuizShareStore`, three quiz-share UI components, and an `AccessLinksModal` opened from a new editor-header button.**

## Performance

- **Duration:** ~1 day wall clock (Tasks 1-2 autonomous, then a blocking human-verify checkpoint for deploy + browser test)
- **Tasks:** 3 (2 auto/TDD + 1 checkpoint:human-verify)
- **Files modified:** 10 (9 created, 1 modified)
- **Completed:** 2026-05-17

## Accomplishments

- **`create-quiz-access` Edge Function** built and deployed: handles OPTIONS via `corsHeaders`, parses `{ quizId, label, expiresAt }`, resolves the caller via `supabase.auth.getUser`, verifies `quiz.owner_id === user.id` (returns HTTP 403 on mismatch — mitigates threat T-02-07), generates an 8-char login + 16-char password with `crypto.getRandomValues` (mitigates T-02-10), bcrypt-hashes the password at cost 10, inserts one `quiz_access` row, and returns `{ token, login, password }` with the plaintext password exactly once (D-14, D-15). The function is intentionally absent from `config.toml`, so `verify_jwt` defaults to `true`.
- **quiz-access entity layer**: `model.ts` defines the `QuizAccess` interface with **no `password_hash` field** (mitigates T-02-09); `api.ts` exports `fetchAccessLinks` (select list omits `password_hash`) and `deleteAccessLink`, both via the authenticated client scoped by the existing `owner_manage_quiz_access` RLS policy (mitigates T-02-08).
- **`useQuizShareStore`** — a `defineStore('quiz-share')` composition store with `links`, `isLoading`, `isCreating`, `lastCreated` and the `loadLinks` / `createLink` / `removeLink` actions; `createLink` rejects an empty label with a toast and never invokes the Edge Function; every async action is wrapped in try/catch + `toast.error`.
- **Three quiz-share UI components** per UI-SPEC section 7, dark theme, exact Copywriting-Contract copy: `AccessLinkForm.vue` (name + optional date inputs, orange create button with Loader2 state), `AccessLinkCreated.vue` (one-time copyable credentials block with the amber irreversibility warning), `AccessLinkList.vue` (label / `@login` / expiry rows with ghost delete and a Link2Off empty state — no completion status, D-16).
- **`AccessLinksModal` widget** composing the three quiz-share components inside a radix-vue `Dialog`, loading links on open; wired to a new orange **"Ссылки доступа"** button in `QuizEditorHeader.vue` placed before `PublishToggle` (D-13).
- **Checkpoint passed:** the human deployed `create-quiz-access` and verified end-to-end — the modal opens from the editor, link creation shows the one-time credentials block, and copy / list / delete all work.

## Task Commits

1. **Task 1: Build create-quiz-access Edge Function and quiz-access entity layer** — `bc0afd3` (feat)
2. **Task 2: Build useQuizShareStore and quiz-share UI components** — `d437f3d` (feat)
3. **Task 3: Wire AccessLinksModal widget and editor-header button + checkpoint:human-verify** — `a46d77a` (feat); checkpoint passed (human typed "approved")

**Checkpoint pause state:** `64f85fd` (chore — STATE.md paused at the Task 3 deploy gate)
**Checkpoint-feedback fixes:** `b4d2c3b` (fix — wrap long URL), `2a76112` (fix — migration 010 `created_at`)
**Plan metadata:** this docs commit (SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md).

## Files Created/Modified

- `supabase/functions/create-quiz-access/index.ts` — owner-authenticated link creation: ownership check, crypto-generated credentials, bcrypt hash, `{ token, login, password }` response
- `supabase/migrations/010_quiz_access_created_at.sql` — adds `quiz_access.created_at timestamptz NOT NULL DEFAULT now()` (see Deviation 2)
- `src/5-entities/quiz-access/model.ts` — `QuizAccess` interface (no `password_hash` field)
- `src/5-entities/quiz-access/api.ts` — `fetchAccessLinks` / `deleteAccessLink`, owner-authenticated, RLS-scoped
- `src/4-features/quiz-share/model/useQuizShareStore.ts` — quiz-share Pinia store (links/isLoading/isCreating/lastCreated; loadLinks/createLink/removeLink)
- `src/4-features/quiz-share/ui/AccessLinkForm.vue` — taker-name + optional-expiry create form
- `src/4-features/quiz-share/ui/AccessLinkCreated.vue` — one-time copyable credentials block with the amber irreversibility warning
- `src/4-features/quiz-share/ui/AccessLinkList.vue` — link rows (label / `@login` / expiry + delete), Link2Off empty state
- `src/3-widgets/AccessLinksModal.vue` — Dialog composing the quiz-share feature, loads links on open
- `src/3-widgets/QuizEditorHeader.vue` — added the orange "Ссылки доступа" button toggling `AccessLinksModal`

## Decisions Made

- **`create-quiz-access` keeps `verify_jwt=true`** by being intentionally omitted from `config.toml` (the convention established in 02-01). Because the service_role client bypasses RLS, the EF still re-verifies quiz ownership (`owner_id === user.id`) before inserting.
- **Credentials are auto-generated server-side** — an 8-char login and a 16-char password from `crypto.getRandomValues` over a safe alphabet; the owner supplies only the `label` (D-14). bcryptjs (verified in 02-01) hashes the password at cost 10.
- **Plaintext password is shown exactly once** at creation and never stored (D-15) — only the bcrypt hash persists. List and delete go through the authenticated client + `owner_manage_quiz_access` RLS, so no Edge Function is needed for those paths (RESEARCH Assumption A4).

## Deviations from Plan

### Checkpoint-Feedback Fixes (applied during the Task 3 human-verify checkpoint)

**1. [Rule 1 - Bug] Wrap the long access-link URL in the credentials block**
- **Found during:** Task 3 (checkpoint:human-verify — browser verification)
- **Issue:** The `<pre>` element rendering the credentials in `AccessLinkCreated.vue` did not wrap, so a long `/q/<token>` URL produced horizontal overflow that stretched the modal off-layout.
- **Fix:** Added `whitespace-pre-wrap break-all` to the `<pre>` so the URL wraps within the credentials block.
- **Files modified:** `src/4-features/quiz-share/ui/AccessLinkCreated.vue`
- **Verification:** Human re-verified the credentials block renders within the modal width.
- **Committed in:** `b4d2c3b` (out-of-band fix on master before this resume)

**2. [Rule 3 - Blocking] Add the missing `quiz_access.created_at` column (migration 010)**
- **Found during:** Task 3 (checkpoint:human-verify — link-list verification)
- **Issue:** `fetchAccessLinks` in `src/5-entities/quiz-access/api.ts` orders results by `created_at` desc, but the `quiz_access` table (migration 004) was never created with a `created_at` column — the list query failed with Postgres error 42703 (`undefined_column`).
- **Fix:** Added `supabase/migrations/010_quiz_access_created_at.sql` introducing `created_at timestamptz NOT NULL DEFAULT now()` on `quiz_access`. The human applied it via `supabase db push`.
- **Files modified:** `supabase/migrations/010_quiz_access_created_at.sql` (created)
- **Verification:** Human re-verified the access-link list loads and orders newest-first after the migration was pushed.
- **Committed in:** `2a76112` (out-of-band fix on master before this resume)

---

**Total deviations:** 2 (1 bug fix, 1 blocking-issue fix) — both surfaced and resolved during the human-verify checkpoint.
**Impact on plan:** Both fixes were necessary for correctness. The wrap fix is a CSS-only visual correction; migration 010 closes a schema gap the plan's `fetchAccessLinks` ordering implicitly depended on. No design changes, no scope creep.

## Issues Encountered

- The `quiz_access` schema (migration 004) predated the `created_at`-ordered list query; surfaced only at runtime during the checkpoint and resolved via migration 010 (see Deviation 2).

## User Setup Required

External Supabase configuration was performed during the Task 3 checkpoint:
- `create-quiz-access` Edge Function deployed via `npx supabase functions deploy create-quiz-access`.
- Migration 010 (`quiz_access.created_at`) pushed to the remote database via `supabase db push`.

No further user setup is outstanding for this plan.

## Next Phase Readiness

- The owner access-link slice is complete and verified: owners can create, view, and delete per-person access links from the editor modal (SHARE-01, SHARE-02, SHARE-03).
- The slice produces real `quiz_access` rows with bcrypt-hashed passwords — the guest-taking slices (02-03 onward) now have credentials to authenticate against via `verify-quiz-access`.
- `quiz_access` now has a `created_at` column; any later query against the table can rely on it.

## Self-Check: PASSED

- `supabase/functions/create-quiz-access/index.ts` — FOUND
- `supabase/migrations/010_quiz_access_created_at.sql` — FOUND
- `src/5-entities/quiz-access/model.ts` — FOUND
- `src/5-entities/quiz-access/api.ts` — FOUND
- `src/4-features/quiz-share/model/useQuizShareStore.ts` — FOUND
- `src/4-features/quiz-share/ui/AccessLinkForm.vue` — FOUND
- `src/4-features/quiz-share/ui/AccessLinkCreated.vue` — FOUND
- `src/4-features/quiz-share/ui/AccessLinkList.vue` — FOUND
- `src/3-widgets/AccessLinksModal.vue` — FOUND
- `src/3-widgets/QuizEditorHeader.vue` — FOUND
- Commits `bc0afd3`, `d437f3d`, `a46d77a`, `b4d2c3b`, `2a76112` — FOUND in git log

---
*Phase: 02-quiz-taking-sharing*
*Completed: 2026-05-17*
