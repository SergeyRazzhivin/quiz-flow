---
phase: 07-password-recovery
plan: 01
subsystem: auth
tags:
  - auth
  - password-recovery
  - supabase
  - vue
  - pinia
requirements_covered:
  - AUTH-04
  - AUTH-05
  - AUTH-06
dependency_graph:
  requires:
    - "useAuthStore (existing — Phase 1)"
    - "supabase client singleton (@shared/api/supabase)"
    - "vue-router beforeEach guard (existing — Phase 1)"
  provides:
    - "requestPasswordReset(email) + updatePassword(newPassword) on useAuthStore"
    - "/forgot-password public page"
    - "/reset-password public page with PASSWORD_RECOVERY listener"
    - "'Забыли пароль?' entry-point in the sign-in tab"
  affects:
    - "src/4-features/auth/model/useAuthStore.ts (extended, additive only)"
    - "src/4-features/auth/ui/LoginForm.vue (one RouterLink added)"
    - "src/1-app/router/index.ts (two routes registered)"
tech_stack:
  added: []
  patterns:
    - "vee-validate + zod refine for confirm-password equality"
    - "supabase.auth.onAuthStateChange + 1.5 s timeout state machine for recovery-session detection"
artifacts:
  created:
    - src/2-pages/ForgotPasswordPage.vue
    - src/2-pages/ResetPasswordPage.vue
  modified:
    - src/4-features/auth/model/useAuthStore.ts
    - src/4-features/auth/model/useAuthStore.test.ts
    - src/4-features/auth/ui/LoginForm.vue
    - src/1-app/router/index.ts
decisions:
  - "redirectTo derived from window.location.origin + import.meta.env.BASE_URL + 'reset-password' so GH Pages subpath + local dev both work"
  - "requestPasswordReset swallows ALL Supabase errors (no email enumeration). Errors logged via console.warn for local debugging only"
  - "updatePassword throws on Supabase error — distinct from request flow because the user is mid-recovery-session and the error is actionable"
  - "Recovery-session state machine: 'checking' → 'ready' (PASSWORD_RECOVERY event OR existing session) | 'invalid' (no recovery session within 1500 ms)"
  - "Form is NEVER rendered unless recoveryState === 'ready' — stale/unrelated session can never silently sign user in"
  - "'Забыли пароль?' link lives in LoginForm.vue ONLY, intentionally NOT in RegisterForm.vue"
  - "Both new routes are public (no meta.requiresAuth); router.beforeEach guard unchanged"
  - "Reused canonical orange-500 / neutral-700 tokens from LoginForm — overrode CONTEXT.md's offhand 'violet→indigo' mention to keep visual consistency with the current AuthPage"
metrics:
  duration_minutes: ~10
  tasks_completed: 4
  files_created: 2
  files_modified: 4
  commits: 5
  tests_added: 5
  tests_passing: 9 (auth store, was 4)
  total_test_suite_passing: 125
completed: 2026-05-21
---

# Phase 7 Plan 01: Password Recovery Summary

Shipped the full owner-side Supabase email-link password recovery flow (AUTH-04 / AUTH-05 / AUTH-06) in a single vertical slice: two new Pinia store methods, two new public pages, one entry-point link in the existing sign-in form, two new public routes — all behind the LOCKED no-email-enumeration and stale-link-guard contracts from `07-CONTEXT.md`.

## What Shipped

### Store API (additive, no breaking changes)

`src/4-features/auth/model/useAuthStore.ts` — extended with:

- `requestPasswordReset(email: string): Promise<void>` — calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })` where `redirectTo = window.location.origin + import.meta.env.BASE_URL + 'reset-password'`. Swallows every Supabase error path (logged via `console.warn` for local debugging) so the UI always shows the same generic success message, regardless of whether the email exists in `auth.users`.
- `updatePassword(newPassword: string): Promise<void>` — calls `supabase.auth.updateUser({ password: newPassword })` and throws on any error so the calling page can surface actionable mid-recovery feedback.

Existing `init` / `login` / `register` / `logout` API unchanged.

### Tests

`src/4-features/auth/model/useAuthStore.test.ts` — 5 new cases all passing (9 total in the file, 125 total in the project suite):

1. `requestPasswordReset` calls Supabase with the correct `redirectTo`
2. `requestPasswordReset` swallows the `User not found` error
3. `requestPasswordReset` swallows other Supabase errors (rate limit / network)
4. `updatePassword` resolves on success and calls `updateUser` with the new password
5. `updatePassword` throws on Supabase error

### Pages

- `src/2-pages/ForgotPasswordPage.vue` — single email input + submit; on submit always flips to the generic-success copy `"Если такой email зарегистрирован, мы отправили на него ссылку для сброса пароля."`. NO try/catch — store swallows errors per LOCKED decision.
- `src/2-pages/ResetPasswordPage.vue` — three-state state machine (`'checking' | 'ready' | 'invalid'`) driven by `supabase.auth.onAuthStateChange` listening for `PASSWORD_RECOVERY` events plus a 1500 ms timeout. Form (password + confirm with `zod.refine` equality check) renders ONLY in the `'ready'` state. On success: `updatePassword` → `authStore.init()` → toast success → `router.push('/my')`. Subscription + timer are torn down in `onBeforeUnmount`.

### Entry point + routing

- `src/4-features/auth/ui/LoginForm.vue` — `RouterLink` to `/forgot-password` added under the password field, before the submit button. Intentionally NOT added to `RegisterForm.vue` per LOCKED UX Surface decision.
- `src/1-app/router/index.ts` — `/forgot-password` and `/reset-password` registered immediately after `/auth`, both lazy-loaded, neither with `meta.requiresAuth`. `router.beforeEach` guard untouched.

## Key Decisions Taken

- **redirectTo origin derivation** — used `window.location.origin + import.meta.env.BASE_URL + 'reset-password'` (rather than hard-coding a domain or relying on a single env var). This is the only formulation that works simultaneously on `https://sergeyrazzhivin.github.io/quiz-flow/reset-password` (GH Pages, BASE_URL=`/quiz-flow/`) and `http://localhost:3000/reset-password` (dev, BASE_URL=`/`).
- **Test assertion for redirectTo** — uses `${window.location.origin}/reset-password` instead of a hard-coded `http://localhost:3000` so the test stays portable across happy-dom versions (initial draft assumed origin was `http://localhost`, but happy-dom 20.x defaults to `:3000`).
- **`requestPasswordReset` is the only auth method that does NOT throw** — by design (LOCKED Email Security). Documented inline with a CONTEXT.md back-reference comment so future readers don't "fix" it.
- **`updatePassword` DOES throw** — distinct contract because the recovery-session user can act on the error (Supabase's "new password must differ from old" / weak-password errors are useful UX).
- **Recovery probe order** — listener subscribes first, then `getSession()` is awaited, then the 1500 ms timer starts. If the event fires before the listener attaches (unlikely race), the `getSession()` probe catches the session and flips the state to `'ready'` so the timer is harmless. This avoids the inverse race where the timer trips before the late event fires.
- **Visual tokens** — reused `bg-orange-500 / focus:ring-orange-500 / border-neutral-700` from `LoginForm.vue` verbatim. The CONTEXT.md `<decisions>` block mentions "gradient violet→indigo primary CTA" — but the actual canonical AuthPage uses orange tokens. The CONTEXT clause "match the existing AuthPage visual language" takes priority over the offhand violet→indigo mention; this is documented as an explicit override.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] redirectTo assertion in the auth-store test used `http://localhost/reset-password`**

- **Found during:** Task 1 GREEN
- **Issue:** Plan specified the expected redirectTo as `'http://localhost/reset-password'` based on the assumption that happy-dom's default origin is `http://localhost`. happy-dom 20.x actually uses `http://localhost:3000` by default, so the assertion failed even though the production formula was correct.
- **Fix:** Switched the test to derive the expected value via the live `window.location.origin`: `` `${window.location.origin}/reset-password` ``. This keeps the test focused on the behaviour (redirect URL is composed from origin + BASE_URL + path) and portable across happy-dom version bumps.
- **Files modified:** `src/4-features/auth/model/useAuthStore.test.ts`
- **Commit:** `fcfe82b`

**2. [Rule 1 — Bug] Mock factory `data: {}` shape failed vue-tsc narrowing on the union return type**

- **Found during:** Phase verification typecheck
- **Issue:** The error-path mocks used `data: {}, error: notFoundError` cast through `Awaited<ReturnType<...>>`. The Supabase v2 union return type `{ data: {}; error: null } | { data: null; error: AuthError }` does not accept `{ data: {}; error: AuthError }` even via a cast (TS2352 "neither type sufficiently overlaps").
- **Fix:** Changed the error-branch mocks to the canonical `{ data: null, error: ... }` shape and dropped the redundant `as Awaited<...>` cast.
- **Files modified:** `src/4-features/auth/model/useAuthStore.test.ts`
- **Commit:** `a8b4a05` (drive-by alongside ForgotPasswordPage)

**3. [Rule 1 — Bug] `try` keyword appeared in a code comment, violating the done check**

- **Found during:** Task 2 done-criteria scan
- **Issue:** The ForgotPasswordPage comment `"no try/catch"` matched the literal grep check `grep -c "try" === 0`.
- **Fix:** Rephrased the comment to `"no error branch"` so the intent is preserved without containing the literal token. The actual `try/catch` block remains absent (LOCKED contract intact).
- **Files modified:** `src/2-pages/ForgotPasswordPage.vue`
- **Commit:** `a8b4a05`

### Soft Deviations (documented for transparency)

- **`ForgotPasswordPage.vue` is 83 lines, plan specified ≤80** — the must_haves block actually says `min_lines: 30` and the ≤80 was the soft FSD guideline for "thin page assembler". The page is at its minimal template-driven floor; no logic compression possible without losing readability. The visual states (form + sub-copy + back-link in `v-if`, success copy + back-link in `v-else`) are mandatory.

## Authentication Gates

None — the plan operates entirely on the existing Supabase client configuration. The Supabase Dashboard URL-allow-list for `https://sergeyrazzhivin.github.io/quiz-flow/**` is a CONTEXT.md "Out-of-band Setup LOCKED" item that was already in place prior to this plan (set during the Phase 6 deploy step).

## Verification Status

- ✅ `npx vitest run` — 125 tests passing across 14 files (1 skipped, 3 todo). 5 new cases in `useAuthStore.test.ts`.
- ✅ `npx vue-tsc --noEmit` — no errors.
- ✅ `npx steiger src` — no FSD layer violations.
- ✅ `npm run build` — production build succeeds in 4.13 s. Lazy chunks `ForgotPasswordPage-*.js` (2.50 kB / 1.34 kB gzip) and `ResetPasswordPage-*.js` (3.79 kB / 1.78 kB gzip) emitted.

## Human UAT Items (deferred to `/gsd:verify-work`)

Browser-only checks that the executor cannot run:

1. `/auth` → "Войти" tab → click "Забыли пароль?" → land on `/forgot-password`.
2. `/forgot-password` → submit any email → see generic Russian success copy regardless of whether the email is registered.
3. `/reset-password` opened directly (no recovery link) → after ~1.5 s the error card with "Ссылка недействительна или истекла" + "Запросить новую ссылку" CTA appears. The form is NEVER shown.
4. Full round-trip with a real registered email: submit on `/forgot-password` → click the link in the recovery email → land on `/reset-password` with the form visible → set a new password → redirected to `/my` → confirm the new password works on subsequent sign-in.
5. (Visual) Both new pages reuse the canonical orange-500 CTA and neutral-700 input borders, matching `/auth`.
6. (Tab-isolation) `/auth` → "Зарегистрироваться" tab → confirm "Забыли пароль?" is NOT present here.

## Self-Check: PASSED

All 6 artifacts present on disk. All 5 commits visible in `git log`:

- `b89f1cb` `test(07): add failing tests for requestPasswordReset + updatePassword`
- `fcfe82b` `feat(07): implement requestPasswordReset + updatePassword on useAuthStore`
- `a8b4a05` `feat(07): add /forgot-password page with generic-success-only UX`
- `b812e87` `feat(07): add /reset-password page with PASSWORD_RECOVERY listener + stale-link guard`
- `7ac3320` `feat(07): wire 'Забыли пароль?' link in LoginForm + register recovery routes`
