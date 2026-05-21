---
phase: 07-password-recovery
verified: 2026-05-21T20:15:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Sign-in tab entry point"
    expected: "Open /auth → 'Войти' tab → click 'Забыли пароль?' → land on /forgot-password"
    why_human: "Requires browser navigation; tab switching + RouterLink hover/cursor states are visual"
  - test: "Generic-success on /forgot-password (registered email)"
    expected: "Submit a real registered email → see 'Если такой email зарегистрирован, мы отправили на него ссылку для сброса пароля.' generic message"
    why_human: "Requires Supabase SMTP delivery + browser UI render verification"
  - test: "Generic-success on /forgot-password (unregistered email)"
    expected: "Submit an email that does NOT exist in auth.users → same generic success copy, no error toast, no leak that the email is unknown"
    why_human: "Requires browser interaction + verification that the UI behaves identically vs. registered case"
  - test: "Stale-link error on /reset-password (direct visit, no recovery link)"
    expected: "Open /reset-password directly with no recovery link → after ~1.5 s, see the red error card 'Ссылка недействительна или истекла. Запросите новую ссылку.' with a working CTA back to /forgot-password. Form is NEVER shown."
    why_human: "Requires waiting for the 1.5 s timer in a real browser; cannot be verified via static grep"
  - test: "Full round-trip recovery (real recovery link)"
    expected: "Submit on /forgot-password with a real registered email → click the link in the recovery email → land on /reset-password with the form visible (PASSWORD_RECOVERY event fired) → set a new password → toast 'Пароль обновлён' → redirected to /my → new password works on next sign-in"
    why_human: "Requires real Supabase SMTP delivery + browser navigation + multi-session sign-in verification. Requires Supabase Dashboard URL allow-list to include https://sergeyrazzhivin.github.io/quiz-flow/** (CONTEXT.md Out-of-band Setup LOCKED — already in place since Phase 6 deploy)."
  - test: "Visual consistency with AuthPage"
    expected: "Both /forgot-password and /reset-password reuse the canonical orange-500 CTA + neutral-700 input borders, matching /auth visual language"
    why_human: "Visual verification; user explicitly reviews UI polish per memory note"
  - test: "Tab-isolation: 'Забыли пароль?' is NOT on sign-up tab"
    expected: "/auth → 'Зарегистрироваться' tab → confirm no 'Забыли пароль?' link appears (LOCKED UX decision)"
    why_human: "Visual verification; static grep on RegisterForm.vue confirms absence in source, but browser confirms tab UX"
---

# Phase 7: Password Recovery — Verification Report

**Phase Goal:** An owner who has forgotten the password can request a recovery email from a dedicated `/forgot-password` page and set a new password on `/reset-password` after clicking the one-time Supabase recovery link, all without leaking whether a given email is registered.

**Verified:** 2026-05-21T20:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "Забыли пароль?" link → /forgot-password → resetPasswordForEmail with redirectTo derived from `window.location.origin + import.meta.env.BASE_URL + 'reset-password'` | VERIFIED | `LoginForm.vue:69-74` renders `<RouterLink to="/forgot-password">Забыли пароль?</RouterLink>`. `ForgotPasswordPage.vue:22` calls `authStore.requestPasswordReset(values.email)`. `useAuthStore.ts:45` computes `const redirectTo = window.location.origin + import.meta.env.BASE_URL + 'reset-password'` and `:46` passes it to `supabase.auth.resetPasswordForEmail(email, { redirectTo })`. `router/index.ts:18` registers `/forgot-password` as a public route. |
| 2 | Generic success message regardless of whether the email exists (no email enumeration) | VERIFIED | `useAuthStore.ts:49-51` swallows ALL Supabase errors via `if (error) { console.warn(...) }` with no throw. `ForgotPasswordPage.vue:21-24` has NO try/catch — always flips `isSubmitted.value = true` after the await. Template `:71-73` always shows `"Если такой email зарегистрирован, мы отправили на него ссылку для сброса пароля."` regardless of branch. Test `useAuthStore.test.ts:142-166` covers both "User not found" and rate-limit error paths — both resolve undefined, never throw. |
| 3 | PASSWORD_RECOVERY event → updateUser → user signed in | VERIFIED | `ResetPasswordPage.vue:24-32` registers `supabase.auth.onAuthStateChange((event, session) => { if (event === 'PASSWORD_RECOVERY' && session) recoveryState.value = 'ready' })`. `:70-80` `onSubmit` calls `authStore.updatePassword(values.password)` then `authStore.init()` to refresh user, then `router.push('/my')`. `useAuthStore.ts:54-57` `updatePassword` calls `supabase.auth.updateUser({ password })` and throws on error. Test `useAuthStore.test.ts:168-196` covers both success and error path. |
| 4 | Expired/reused/tampered link → Russian error state with CTA back to /forgot-password, never silently signs in with stale session | VERIFIED | `ResetPasswordPage.vue:11-13` defines `RecoveryState = 'checking' \| 'ready' \| 'invalid'`. `:41-45` sets a 1500 ms timeout that flips to `'invalid'` if the PASSWORD_RECOVERY event never fired. `:95-105` template renders the red error card `"Ссылка недействительна или истекла. Запросите новую ссылку."` with a `RouterLink to="/forgot-password"` when state === `'invalid'`. The form `v-else` block (`:107`) only renders when `recoveryState === 'ready'`, so a stale unrelated session can never silently render the form. Note: the recoveryState `'ready'` branch is entered EITHER by the `PASSWORD_RECOVERY` event (clean recovery) OR by `getSession()` returning any session (`:37-39`); see Gaps Summary note on edge case. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/4-features/auth/model/useAuthStore.ts` | Exports `requestPasswordReset` + `updatePassword` next to existing methods | VERIFIED | Both functions present at L42-52 and L54-57. Returned-object exports at L59: `{ user, isLoading, init, login, register, logout, requestPasswordReset, updatePassword }`. Existing API unchanged. |
| `src/4-features/auth/model/useAuthStore.test.ts` | 5 new vitest cases (3 for requestPasswordReset, 2 for updatePassword) | VERIFIED | Test cases at L123-196 cover redirectTo derivation, "User not found" swallow, other-error swallow, updatePassword success, updatePassword error throw. Mock factory at L7-29 includes `resetPasswordForEmail` + `updateUser` mocks alongside existing ones. All 9 tests in file pass (4 existing + 5 new). |
| `src/2-pages/ForgotPasswordPage.vue` | Public page, single email input, generic success | VERIFIED | 83 lines; calls `authStore.requestPasswordReset`; no try/catch; generic success copy present; reuses `bg-orange-500` / `border-neutral-700` tokens from LoginForm. (Lines slightly over plan's ≤80 soft guideline — documented as soft deviation in SUMMARY; min_lines=30 must-have satisfied.) |
| `src/2-pages/ResetPasswordPage.vue` | Public page, PASSWORD_RECOVERY listener + 1.5 s timeout + error card | VERIFIED | 154 lines; PASSWORD_RECOVERY listener at L24-32; 1500 ms timeout at L41-45; subscription cleanup in onBeforeUnmount at L48-51; form rendered only when `recoveryState === 'ready'`; error card with Russian copy + CTA to /forgot-password. |
| `src/4-features/auth/ui/LoginForm.vue` | "Забыли пароль?" RouterLink under password field | VERIFIED | RouterLink at L68-75 placed between password input and submit button. `cursor-pointer` present per project rule. |
| `src/1-app/router/index.ts` | /forgot-password and /reset-password public routes | VERIFIED | Both routes registered at L18-19, no `meta.requiresAuth`, immediately after `/auth`. `beforeEach` guard at L34-41 unchanged. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `useAuthStore.ts` | `supabase.auth.resetPasswordForEmail` | direct call in `requestPasswordReset` | WIRED | L46 |
| `useAuthStore.ts` | `supabase.auth.updateUser` | direct call in `updatePassword` | WIRED | L55 |
| `ResetPasswordPage.vue` | `supabase.auth.onAuthStateChange` | PASSWORD_RECOVERY event listener in onMounted | WIRED | L24-32 |
| `ForgotPasswordPage.vue` | `useAuthStore.requestPasswordReset` | store call with BASE_URL-derived redirectTo | WIRED | Page L22 calls store; store L45 derives `redirectTo` from `window.location.origin + import.meta.env.BASE_URL + 'reset-password'` |
| `LoginForm.vue` | /forgot-password route | RouterLink under password input | WIRED | L69-74 |
| `router/index.ts` | ForgotPasswordPage.vue + ResetPasswordPage.vue | lazy-loaded route entries without meta.requiresAuth | WIRED | L18-19 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ForgotPasswordPage.vue` | `isSubmitted` | local ref toggled after `authStore.requestPasswordReset()` await | Yes — toggles deterministically on submit, no hardcoded empties | FLOWING |
| `ResetPasswordPage.vue` | `recoveryState` | Driven by `supabase.auth.onAuthStateChange` event + `getSession()` probe + 1500 ms timeout | Yes — three-branch state machine fed by real Supabase auth events | FLOWING |
| `ResetPasswordPage.vue` | submit handler `values.password` | vee-validate form bound to template inputs | Yes — wired via `defineField` to `v-model` on both inputs | FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-04 | 07-01-PLAN.md | Пользователь может запросить восстановление пароля, введя свой email на отдельной странице | SATISFIED | `/forgot-password` page exists, accepts email, calls `requestPasswordReset` |
| AUTH-05 | 07-01-PLAN.md | Пользователь получает email с одноразовой ссылкой восстановления (через встроенный Supabase SMTP, TTL по дефолту Supabase) | SATISFIED | `supabase.auth.resetPasswordForEmail` invoked with proper `redirectTo`; SMTP delivery delegated to Supabase per LOCKED decision. Round-trip requires browser UAT (#5 in human_verification). |
| AUTH-06 | 07-01-PLAN.md | Пользователь может установить новый пароль на странице сброса после клика по ссылке из письма | SATISFIED | `/reset-password` page with `updatePassword` + recovery-session gating; redirects to `/my` on success. |

No orphaned requirements — REQUIREMENTS.md maps exactly AUTH-04/05/06 to Phase 7, all three are declared in the plan's `requirements` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

Scanned all 6 modified files for `TODO|FIXME|XXX|TBD|PLACEHOLDER|.skip(|it.todo|placeholder|coming soon|not yet implemented|return null|return \{\}|return \[\]|=> \{\}|hardcoded empties`. No matches found in any file.

### LOCKED Decisions Audit (from 07-CONTEXT.md)

| # | LOCKED Decision | Status | Evidence |
|---|----------------|--------|----------|
| 1 | Generic success on /forgot-password (no email enumeration) | VERIFIED | Store swallows all errors (`useAuthStore.ts:49-51`); page has no try/catch (`ForgotPasswordPage.vue:21-24`); 2 swallow-tests pass (test L142-166) |
| 2 | `redirectTo` formula: origin + BASE_URL + 'reset-password' | VERIFIED | `useAuthStore.ts:45` matches exactly; test L123-140 asserts the composition |
| 3 | PASSWORD_RECOVERY listener + 1.5 s timeout on /reset-password | VERIFIED | `ResetPasswordPage.vue:24-32` listener; L41-45 timeout with 1500 ms |
| 4 | Never-silent-sign-in gating on /reset-password | VERIFIED | Form rendered only inside `v-else` after `recoveryState === 'ready'` check (`ResetPasswordPage.vue:107`); error branch is mutually exclusive (L95-105) |
| 5 | "Забыли пароль?" link on sign-in tab ONLY (not sign-up) | VERIFIED | `LoginForm.vue:69-74` has the link; `RegisterForm.vue` has 0 matches for "forgot-password" or "Забыли" (grep confirmed) |
| 6 | Public routes (no requiresAuth) | VERIFIED | `router/index.ts:18-19` neither route declares `meta: { requiresAuth: true }`; the `beforeEach` guard at L34-41 only protects routes where `meta.requiresAuth === true` |
| 7 | FSD layout: store in 4-features/auth, pages in 2-pages, no widget-layer | VERIFIED | All artifacts in their correct layers; steiger reports "No problems found"; no `3-widgets` files involved |

### Automated Verification Output

- `npx vitest run` — **125 passed**, 3 todo, 1 file skipped (evals). `src/4-features/auth/model/useAuthStore.test.ts` reports **9 tests passing** (was 4 before this phase). One expected `console.warn` from the rate-limit swallow test, which proves the error logging path runs without throwing.
- `npx vue-tsc --noEmit` — **no type errors** (clean exit).
- `npx steiger src` — **No problems found** (no FSD layer violations).
- Commits: All 5 commits documented in SUMMARY are present in `git log` (b89f1cb, fcfe82b, a8b4a05, b812e87, 7ac3320), plus the SUMMARY doc commit `eeee8e2`.

### Behavioral Spot-Checks

SKIPPED — the password-recovery flow is browser- and Supabase-SMTP-driven; spot-checks cannot run without a live browser session and an actual recovery email. All behaviors are captured under Human Verification Required.

### Probe Execution

SKIPPED — no `scripts/*/tests/probe-*.sh` defined for this Vite/Vue project, and the PLAN does not declare any probe paths. Project uses `vitest` for automated verification (covered above).

### Human Verification Required

7 items routed for browser UAT (see frontmatter `human_verification`):

1. **Sign-in tab entry point** — Click "Забыли пароль?" from /auth → land on /forgot-password.
2. **Generic-success on /forgot-password (registered email)** — Submit a real registered email; observe generic copy.
3. **Generic-success on /forgot-password (unregistered email)** — Submit an unregistered email; observe identical generic copy (no leak).
4. **Stale-link error on /reset-password** — Direct visit; wait 1.5 s; see error card and CTA back to /forgot-password. Form must NEVER appear.
5. **Full round-trip recovery** — Email → link click → /reset-password → set new password → /my → next sign-in works.
6. **Visual consistency** — Both pages use canonical orange-500 / neutral-700 tokens matching /auth.
7. **Tab-isolation** — Sign-up tab does NOT show "Забыли пароль?".

### Gaps Summary

No blocking gaps. All four ROADMAP success criteria, all three requirements (AUTH-04/05/06), all six required artifacts, all six key links, and all seven LOCKED CONTEXT.md decisions are verified at the code level. The full automated test suite (125 tests) passes, vue-tsc reports zero type errors, and steiger reports zero FSD violations.

**Minor observation (non-blocking):** `ResetPasswordPage.vue:37-39` flips `recoveryState` to `'ready'` when `getSession()` returns any session, not strictly only a recovery-scoped session. In practice this is the documented LOCKED probe behavior from 07-CONTEXT.md (`<specifics>`: "the recovery event fired before mount"), and the SUMMARY documents the race-resolution rationale. A pre-existing authenticated owner who navigates directly to /reset-password will see the form rather than the error card. The Supabase recovery model means `updatePassword` would change THIS user's password in that scenario, which is consistent with the LOCKED behavior (`<specifics>` line: "the recovery session already authenticates them"). Not a gap, but worth covering in UAT #5 if the tester also tries the page while already signed in.

The phase ships the full owner-side Supabase email-link password recovery flow with no leaks, proper stale-link handling, and matching visual tokens. Status is `human_needed` exclusively because the round-trip flow can only be exercised through a real browser + real Supabase SMTP delivery.

---

_Verified: 2026-05-21T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
