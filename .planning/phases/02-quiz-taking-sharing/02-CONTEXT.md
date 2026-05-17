# Phase 2: Quiz Taking & Sharing - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers two surfaces:

1. **Guest quiz-taking** — a taker opens a quiz by a per-person token URL (`/q/:token`), authenticates with owner-assigned login/password, takes the quiz one question at a time under a live server-anchored timer, and immediately sees their score.
2. **Per-person access-link management** — the owner creates, views, and deletes individual access links (token + login + password + label + optional expiry) for a quiz.

**Requirements covered:** TAKE-01–10, SHARE-01–03 (13 requirements) + EXT-04 (multiple attempts — pulled from v2, see D-03).

**NOT in this phase:** AI generation (Phase 3), statistics (Phase 4), billing / freemium enforcement (Phase 5). Access links are marked "Pro" in requirements — the feature is built here; the Pro gate is enforced in Phase 5.
</domain>

<decisions>
## Implementation Decisions

### Guest Entry & Intro
- **D-01:** `/q/:token` shows the quiz intro (title, description, cover, question count, time limit) AND the login/password form together on one screen — the guest sees what the test is while entering credentials.
- **D-02:** ~~The `quiz_session` and the timer start on an explicit "Начать" button after the intro — not on successful login.~~ **SUPERSEDED (02-05):** the product owner overrode this during 02-05 execution. The intermediate intro/"Начать" preview screen was removed entirely — the quiz now starts immediately after a successful login (`verifyAccess` chains into `startSession()`; the `'intro'` session state was deleted). D-01 (intro card shown together with the login form) still holds; D-04 retake semantics are unchanged.
- **D-03:** One attempt vs multiple attempts is **owner-configurable per quiz** — a new flag in `quizzes.settings` JSONB (`allow_retake`), surfaced as a toggle in the editor's navigation/settings panel. This pulls **EXT-04** (a v2 requirement) into Phase 2 scope.
- **D-04:** Re-opening `/q/:token` behavior:
  - In-progress session, time not expired → **resume** that session (saved answers intact, timer continues from server `started_at`).
  - In-progress session, time expired while the guest was away → **auto-submit** → result.
  - Finished session + single-attempt quiz → show the existing **result** (no new attempt).
  - Finished session + multiple-attempts quiz → offer to **start a new attempt** (new `quiz_session`).
  - No session → fresh start.

### Taking Screen
- **D-05:** Sticky header on the taking screen — progress "Вопрос X из Y" + a progress bar (left), countdown timer (right).
- **D-06:** "Стоп" (early finish) → confirmation dialog → finishes the test, scoring by whatever was answered → result page.
- **D-07:** Required questions (`is_required`) block the "Вперёд" navigation until answered.
- **D-08:** Timer expiry → a short "Время вышло" notice → automatic submit → result page.
- **D-09:** The timer is conditional on `time_limit_sec`. If null (no limit set), no timer is rendered, there is no auto-submit, and the guest finishes manually.

### Result Page
- **D-10:** The result page (`/q/:token/result`) shows the score + percentage ("8 из 10 (80%)"), the taker's name (`quiz_access.label`), and a neutral message. No pass/fail threshold.
- **D-11:** The result page shows only the total — no per-question breakdown. Revealing correct answers stays v2 (QA-02).
- **D-12:** The result page includes a link to the Quiz Flow home `/` (soft service promo).

### Access Link Management
- **D-13:** The owner manages per-person access links via a **modal** opened from the quiz editor — a "Ссылки доступа" button in the editor header.
- **D-14:** The login and password for an access link are **auto-generated** by the system; the owner copies them (the owner sets only the `label`).
- **D-15:** After creating a link, the UI shows a single **copyable block** (link + login + password together, with a "Скопировать" button). The plaintext password is shown **only at creation** — only `password_hash` is stored, so it cannot be revealed again later.
- **D-16:** The link list shows label (taker name), login, expiry, and a delete action — **no completion status** (completion stats belong to Phase 4).

### Scoring
- **D-17:** **Partial credit** for multiple-answer questions. Per-question score (0–1):
  `max(0, (correct_selected − incorrect_selected) / total_correct_options)`.
  Single-answer questions are the 1-correct-option special case (correct → 1, else → 0). Quiz total = sum of per-question fractions (0…N). Percentage = total / N × 100.
- **D-18:** `quiz_sessions.score` is currently `int`; partial credit makes it fractional — a Phase 2 migration changes the column to `numeric`. The result page shows the percentage prominently plus "X.X из N".

### Publish vs Link Access
- **D-19:** Access via `/q/:token` is **independent of `is_published`**. `is_published` governs only the public `/` home-page listing. Owners can create and share access links for unpublished/draft quizzes; the guest-taking Edge Functions validate token + credentials and do NOT require `is_published = true`. Edge case: a link to a quiz with no questions shows a graceful "тест пока не готов" state, not an error.

### Claude's Discretion
- Exact Russian copy for guest-facing messages, dialogs, and notices.
- Visual styling details within the established dark theme + orange accent design system.
- Internal structure of the Edge Functions and the guest-token (custom JWT) handling.
- Progress-bar visual treatment and the "timer turns red in the final 20%" exact styling (ROADMAP SC#3).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project spec & requirements
- `SPEC.md` — routes (`/q/:token`, `/q/:token/result`), DB schema (`quiz_access`, `quiz_sessions`, `session_answers`), QuizSharePage flow
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, requirement IDs
- `.planning/REQUIREMENTS.md` — TAKE-01–10, SHARE-01–03; EXT-04 (now pulled into Phase 2 per D-03)
- `CLAUDE.md` — project guide, key constraints (OpenAI never client-side, guest access via token, RLS dual-policy, freemium at DB/Edge level)

### Prior phase context
- `.planning/phases/01-foundation-auth-and-quiz-editor/01-CONTEXT.md` — Phase 1 decisions: routing + guard, `settings` JSONB shape, design system
- `.planning/STATE.md` — accumulated research decisions: guest writes via Edge Functions only, short-lived custom JWT in sessionStorage, timer from server `started_at`, answers upserted immediately, `is_correct`/`password_hash` never reach anon

### Architecture & pitfalls
- `.planning/research/ARCHITECTURE.md` — FSD layer mapping, Edge Function responsibilities
- `.planning/research/PITFALLS.md` — timer drift, answer loss on refresh, `is_correct`/`password_hash` column-level protection, DnD

### Existing schema
- `supabase/migrations/004_quiz_access.sql` — `quiz_access` table
- `supabase/migrations/005_sessions.sql` — `quiz_sessions`, `session_answers` tables
- `supabase/migrations/003_questions_answers.sql` — `answer_options_public` view (anon-safe, excludes `is_correct`)
- `supabase/migrations/007_rls_policies.sql` — RLS dual-policy; no anon policy on `quiz_access` (token validation is Edge Function only)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/6-shared/api/supabase.ts` — Supabase client singleton
- `src/5-entities/quiz/`, `src/5-entities/question/`, `src/5-entities/answer-option/` — models + API fetchers
- `src/6-shared/ui/` — Button, Input, Dialog, Tabs, Tooltip; `Switch.vue` (PrimeVue ToggleSwitch wrapper)
- `src/6-shared/lib/format.ts` — `formatDuration` (seconds → "10 мин")
- `src/4-features/quiz-editor/ui/AnswerOptionEditor.vue` — radio (single) / checkbox (multiple) visual to reuse on the taking screen
- vue-sonner toasts, dark theme + orange accent tokens in `src/1-app/styles/main.css`

### Established Patterns
- FSD layer discipline enforced by steiger; Composition-API Pinia stores
- Supabase error handling → `toast.error`; all async ops in try/catch
- RLS dual-policy; **guest writes go through Edge Functions with the service_role key — never direct anon writes**
- `quiz_access` / `quiz_sessions` / `session_answers` tables already exist (migrations 004, 005)

### Integration Points
- **New `supabase/functions/` directory** — first Edge Functions in the project (e.g. verify-quiz-access, start-quiz-session, submit-quiz-answers, get-quiz-result — exact set is a planning decision)
- New public routes `/q/:token` and `/q/:token/result` in `src/1-app/router/index.ts`
- New feature slices: `quiz-taking` (guest flow) and `quiz-share` (owner link management)
- New entity slices for `quiz-access`, `quiz-session`, `session-answer`
- The editor's `NavigationSettings.vue` gains the `allow_retake` toggle (D-03)
- A Phase 2 migration: alter `quiz_sessions.score` to `numeric` (D-18); add the `allow_retake` default to `quizzes.settings`; grants/RLS for guest-facing access
</code_context>

<specifics>
## Specific Ideas

- The taking screen and result page follow the Phase 1 dark theme + orange accent design system.
- Answer selection on the taking screen reuses the editor's radio (single) / checkbox (multiple) visual language.
- Timer "turns red in the final 20% of remaining time" — explicit ROADMAP success criterion #3.
</specifics>

<deferred>
## Deferred Ideas

- **Per-question breakdown / showing correct answers on the result page** — v2 (QA-02).
- **Pass/fail threshold on the result page** — considered during discussion, declined; stays out of scope.
- **Completion status in the access-link list** — belongs to Phase 4 (statistics).
- **Multiple-attempt aggregation** (which attempt counts as "the" result) — Phase 4 statistics concern; Phase 2 just records each attempt as a separate `quiz_session`.
- **Pro-gating of access links** (SHARE-01/02/03 are marked "Pro") — freemium enforcement is Phase 5; Phase 2 builds the feature ungated.

</deferred>

---

*Phase: 02-quiz-taking-sharing*
*Context gathered: 2026-05-17*
