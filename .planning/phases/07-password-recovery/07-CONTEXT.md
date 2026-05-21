# Phase 7: Password Recovery — Context

**Gathered:** 2026-05-21
**Status:** Ready for planning
**Source:** Inline capture during /gsd:plan-phase 7 (decisions taken during the v1.1 milestone discussion in the same session)

<domain>
## Phase Boundary

Phase 7 ships the standard Supabase email-link password recovery flow for the owner-side app (Supabase Auth users on `auth.users`). It covers exactly three requirements:

- **AUTH-04** — request a recovery email by submitting an email on a dedicated page
- **AUTH-05** — Supabase sends the one-time recovery link via its built-in SMTP
- **AUTH-06** — set a new password on a dedicated reset page once the recovery session is established

Out of phase scope:
- Guest-side `quiz_access` credentials (own login + password hash, NOT Supabase Auth) — unchanged, not touched by this phase
- Custom SMTP / domain verification / production deliverability — deferred to a later milestone
- Password change from inside the authenticated session — separate future requirement, NOT in v1.1

</domain>

<decisions>
## Implementation Decisions

### UX Surface (LOCKED)
- Add a "Забыли пароль?" link inside the existing AuthPage sign-in tab (NOT on the sign-up tab).
- Recovery is a two-page flow, NOT modals:
  - `/forgot-password` — single email input + submit; success state shows generic message and stays on the page.
  - `/reset-password` — new-password + confirm-password inputs, submits and redirects to `/my` on success.
- Both pages are public routes (no `requiresAuth` guard).
- All copy is Russian. Match the existing AuthPage/AppHeader visual language (dark theme, gradient violet→indigo primary CTA, Inter font, `cursor-pointer` on every clickable control).

### Email Security (LOCKED)
- The `/forgot-password` form always shows the same generic success message regardless of whether the email exists in `auth.users`. We MUST NOT confirm or deny account existence. This means we never surface Supabase's `User not found` error in the UI.
- We may still log/track Supabase's error response locally for debugging, but it never reaches the user.

### Supabase Flow (LOCKED)
- Use `supabase.auth.resetPasswordForEmail(email, { redirectTo })` from the client. No Edge Function needed for v1.1 — Supabase handles email send + token issuance directly.
- `redirectTo` must be a fully-qualified URL ending in `/reset-password`. Derive it from `window.location.origin + import.meta.env.BASE_URL + 'reset-password'` so it works on both the GitHub Pages subpath (`/quiz-flow/reset-password`) and local dev (`/reset-password`).
- The `/reset-password` page listens for the `PASSWORD_RECOVERY` event from `supabase.auth.onAuthStateChange` to detect that a recovery session has been established. Render the form only when this event has fired (or when `supabase.auth.getSession()` returns a recovery-scoped session).
- New password is set with `supabase.auth.updateUser({ password: newPassword })`. Supabase returns the user; we then sign the user in (the recovery session already authenticates them) and redirect to `/my`.
- TTL of the recovery link uses Supabase's default (no custom override). Free-tier rate limit (~2 emails/hour) is acceptable for MVP.

### Failure States (LOCKED)
- Expired / already-used / tampered recovery link: when `/reset-password` loads and no `PASSWORD_RECOVERY` event fires within a short window (e.g. 1.5 s) AND `getSession()` returns no recovery session, show a Russian-language error card with a link back to `/forgot-password`. NEVER silently sign the user in with a stale or unrelated session.
- Password validation: minimum 6 characters (matches Supabase project setting); confirm-password must equal new-password. Client-side check before submitting `updateUser`.

### FSD Layout (LOCKED)
- `src/2-pages/ForgotPasswordPage.vue` — thin page (≤80 lines).
- `src/2-pages/ResetPasswordPage.vue` — thin page (≤80 lines).
- `src/4-features/auth/model/useAuthStore.ts` — add `requestPasswordReset(email)` and `updatePassword(newPassword)` methods next to the existing `register` / `login` / `logout`.
- `src/4-features/auth/ui/*` — if either page grows beyond a thin assembler (form widgets, validation), extract reusable form components into the auth feature. The widget layer (`3-widgets/`) is NOT involved — recovery forms are auth-feature-private.
- `src/3-widgets/AuthWidget.vue` (or the AuthPage's sign-in form, wherever the "Войти" form currently lives) — add a "Забыли пароль?" `<RouterLink>` to `/forgot-password` under the password field.
- Routes added in `src/1-app/router/index.ts`. No router guard changes.

### Out-of-band Setup (LOCKED, but NOT a code task)
- Supabase Dashboard → Authentication → URL Configuration: `https://sergeyrazzhivin.github.io/quiz-flow/**` is already in the redirect allow-list (set during deploy step). Plans MUST verify this is still configured but MUST NOT attempt to modify it programmatically.
- Optional: customize the recovery email template (Authentication → Email Templates → "Reset password") to Russian copy. This is human-only; do NOT include in any plan.

### Claude's Discretion (UNLOCKED)
- Exact form-validation library or pattern (continue using vee-validate + Zod if it fits the existing AuthPage; otherwise minimal manual validation is fine).
- Exact wording of the Russian copy (first-draft acceptable; human will polish in UAT).
- Whether `/reset-password` uses one combined form or two stacked inputs — visual choice as long as both fields are required.
- Loading / disabled-button states styling (consistent with AuthPage, choose the cleanest implementation).
- Test coverage shape: integration tests for the store methods are expected (mocking `supabase.auth.*`); page-level tests are not required for v1.1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth surface (existing code to extend)
- `src/4-features/auth/model/useAuthStore.ts` — existing `register` / `login` / `logout` methods; the new methods follow the same shape (throw on error, no toast inside the store).
- `src/2-pages/AuthPage.vue` — existing email/password forms; new "Забыли пароль?" link goes here under the sign-in tab.
- `src/1-app/router/index.ts` — existing public routes (`/`, `/quizzes`, `/auth`, `/q/:token`, etc.); add `/forgot-password` and `/reset-password` next to them.
- `src/6-shared/api/supabase.ts` (or wherever `supabase` client is exported) — already configured with the Supabase URL/anon key from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

### Auth state and routing patterns
- `src/4-features/auth/model/useAuthStore.test.ts` — existing test pattern for the store. New methods should ship matching tests.
- `vite.config.ts` (`base` derived from `VITE_BASE`) — explains why `redirectTo` must use `window.location.origin + import.meta.env.BASE_URL`.

### UI tokens
- `tailwind.config.*` / Tailwind v4 config — gradient `from-violet-600 to-indigo-600`, `cursor-pointer` rule, dark-theme defaults already exist; reuse them.

No external Supabase docs or ADRs need to be re-fetched — the recovery flow is documented in this CONTEXT.md verbatim.

</canonical_refs>

<specifics>
## Specific Ideas

- The `/reset-password` page should be effectively unusable without a recovery session. Render only an error state (with CTA back to `/forgot-password`) when no recovery session was established within ~1.5 s of mount.
- `requestPasswordReset(email)` in the store wraps `supabase.auth.resetPasswordForEmail` and SHOULD NOT throw on "User not found" — it returns void in all cases so the UI always shows the generic success message.
- After a successful `updatePassword`, Supabase returns an authenticated session. The page should explicitly call `await authStore.init()` (or wait for `onAuthStateChange`'s `SIGNED_IN` event) to refresh `authStore.user` before navigating to `/my`.
- Russian copy first draft:
  - `/forgot-password` heading: "Восстановление пароля" — body hint: "Введите email — отправим ссылку для сброса пароля."
  - Success: "Если такой email зарегистрирован, мы отправили на него ссылку для сброса пароля."
  - `/reset-password` heading: "Новый пароль" — body hint: "Введите новый пароль и подтверждение."
  - Error (no recovery session): "Ссылка недействительна или истекла. Запросите новую ссылку."

</specifics>

<deferred>
## Deferred Ideas

- Custom SMTP provider (Resend/Sendgrid) — separate future milestone before production launch.
- Customized Russian recovery email template inside Supabase — human-only Dashboard task, can land independently.
- Password-change-while-signed-in — separate future requirement, NOT in v1.1.
- Account deletion / email change — separate future requirements, NOT in v1.1.
- Magic-link / OAuth providers — out of scope, listed in PROJECT.md Out of Scope.

</deferred>

---

*Phase: 07-password-recovery*
*Context gathered: 2026-05-21 inline during /gsd:plan-phase 7 (decisions captured from same-session v1.1 milestone discussion)*
