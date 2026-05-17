# Phase 4: Statistics - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers a **statistics surface** for quiz owners. For any quiz the owner can open a dedicated statistics page showing:

1. **Summary (Free):** total attempts, completion rate (%), average score.
2. **Per-person result table (Free):** taker name, score, completion timestamp.
3. **Per-question accuracy (Pro):** % of takers who answered each question correctly. Free owners see this section blurred with an upgrade CTA.

**Requirements covered:** STATS-01, STATS-02, STATS-03 (3 requirements).

**NOT in this phase:** billing / subscription purchase / real freemium enforcement (Phase 5). Phase 4 only *reads* Pro status; it does not implement subscribing or limit enforcement. Revealing correct answers / score histograms stay v2.
</domain>

<decisions>
## Implementation Decisions

### Entry Point & Navigation
- **D-01:** Statistics lives on a **dedicated route** `/quiz/:id/stats` (owner-only, authenticated). A "Статистика" link/button is added in two places: the quiz card on `/my` (МуQuizListPage) and the quiz editor header.

### Attempt Aggregation
- **D-02:** Multiple attempts by the same taker are recorded as separate `quiz_sessions` (per Phase 2 D-04). For statistics, the unit is the **latest finished attempt per person** (per `quiz_access_id`).
  - The per-person result table shows **one row per taker** — their latest finished attempt.
  - Average score is computed over those latest-attempt scores.
- **D-03:** **Completion rate = finished sessions / started sessions.** Denominator is all started `quiz_sessions` (rows with `started_at`); numerator is sessions with a non-null `finished_at`. This surfaces takers who abandoned mid-test. (Computed over all sessions, not latest-per-person.)
- **D-04:** Per-question accuracy (STATS-03) and average score are computed from **latest finished attempts only** — consistent with the per-person table. Accuracy per question = % of latest-attempt takers who answered that question correctly.

### Pro Gate
- **D-05:** Pro status is read from the existing **`subscriptions` table** (migration 006) — a real `isPro` flag derived from the DB. Phase 5 will populate that table via YooKassa; Phase 4 just reads it. No hardcoded gate.
- **D-06:** For a Free owner the per-question accuracy section renders **blurred with an upgrade CTA** overlay. The data is not fetched / not exposed for Free owners (gate is not purely visual — Free clients do not receive the accuracy numbers).

### Data Presentation
- **D-07:** Summary metrics are shown as **cards with large numbers**. Per-question accuracy uses **horizontal progress bars** showing the % per question. The per-person results are a **comparison table**. No heavyweight chart library — bars are built with existing UI / Tailwind.
- **D-08:** Empty state — when a quiz has no attempts yet, the page shows a friendly empty state (e.g. "Пока никто не проходил тест"), not zeroed-out cards or an error.

### Claude's Discretion
- Exact Russian copy for the stats page, empty state, and upgrade CTA.
- Per-person table sorting/filtering details (default sort, whether columns are sortable).
- Whether stats are computed via a Postgres view / RPC vs client-side aggregation over RLS-protected reads — a planning/research decision. Owner RLS on `quiz_sessions` / `session_answers` already permits the reads (migration 009).
- Visual styling within the established dark theme + orange accent design system.
- Whether to show in-progress (unfinished) attempts anywhere beyond the completion-rate denominator.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project spec & requirements
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria (SC#1–3), requirement IDs
- `.planning/REQUIREMENTS.md` — STATS-01, STATS-02, STATS-03
- `CLAUDE.md` — project guide, key constraints (FSD layers, RLS dual-policy, freemium at DB/Edge level)
- `SPEC.md` — routes, DB schema reference (project root)

### Prior phase context
- `.planning/phases/02-quiz-taking-sharing/02-CONTEXT.md` — D-04 (multiple attempts = separate sessions; aggregation deferred to Phase 4), D-16 (completion status belongs to Phase 4), D-17 (partial-credit fractional scoring)
- `.planning/phases/01-foundation-auth-and-quiz-editor/01-CONTEXT.md` — routing + guard, `settings` JSONB shape, design system
- `.planning/STATE.md` — accumulated phase status

### Architecture & pitfalls
- `.planning/research/ARCHITECTURE.md` — FSD layer mapping
- `.planning/research/PITFALLS.md` — `is_correct` column-level protection (relevant for per-question accuracy: owner may read `is_correct`, Free clients must not receive accuracy data)

### Existing schema
- `supabase/migrations/005_sessions.sql` — `quiz_sessions` (`started_at`, `finished_at`, `score`, `quiz_access_id`, `quiz_id`), `session_answers` (`selected_option_ids`)
- `supabase/migrations/009_phase2_schema.sql` — `score` is `numeric`; **owner RLS already present** on `quiz_sessions` (`owner_read_sessions`) and `session_answers` (`owner_read_session_answers`)
- `supabase/migrations/004_quiz_access.sql` — `quiz_access.label` is the taker name
- `supabase/migrations/003_questions_answers.sql` — `questions`, `answer_options` (`is_correct`)
- `supabase/migrations/006_subscriptions.sql` — `subscriptions` table — source of truth for Pro status (D-05)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/6-shared/api/supabase.ts` — Supabase client singleton
- `src/5-entities/quiz/`, `src/5-entities/question/`, `src/5-entities/answer-option/`, `src/5-entities/quiz-access/`, `src/5-entities/quiz-session/` — models + API fetchers
- `src/6-shared/ui/` — Button, Input, Dialog, Tabs, Tooltip
- `src/6-shared/lib/format.ts` — `formatDuration`; date/score formatting helpers
- `_shared/scoring.ts` (Edge Functions) — D-17 partial-credit scoring logic; per-question correctness logic may be reused/mirrored for accuracy
- dark theme + orange accent tokens in `src/1-app/styles/main.css`; vue-sonner toasts

### Established Patterns
- FSD layer discipline enforced by steiger; Composition-API Pinia stores
- Owner reads go directly through Supabase with owner RLS (authenticated role) — no Edge Function needed for owner-only data
- `2-pages` are thin assemblers (~80 lines); `3-widgets` compose feature slices
- Supabase error handling → `toast.error`; async ops in try/catch

### Integration Points
- New route `/quiz/:id/stats` in `src/1-app/router/index.ts` (behind auth guard)
- New page `src/2-pages/QuizStatsPage.vue`
- New feature slice `quiz-stats` (4-features) — Pinia store + aggregation logic
- New widget(s) in `3-widgets` composing summary cards / result table / per-question accuracy
- "Статистика" entry buttons added to `MyQuizListPage.vue` quiz cards and `QuizEditorHeader.vue`
- Pro status read from `subscriptions` — likely a new/extended entity or shared helper (`useIsPro` or similar)
- Possible new migration: a Postgres view or RPC for aggregated stats (planning decision per D-07 discretion)

</code_context>

<specifics>
## Specific Ideas

- Summary as cards with large numbers; per-question accuracy as horizontal % progress bars; per-person results as a comparison table.
- Pro section blurred with an upgrade CTA for Free owners — visual treatment consistent with future Phase 5 billing CTAs.
- Page follows the established dark theme + orange accent design system.
</specifics>

<deferred>
## Deferred Ideas

- **Score distribution histogram (EXT-05)** — v2; not in Phase 4.
- **Showing per-attempt history per taker** (drill-down beyond the latest attempt) — not requested; latest-attempt-per-person is the Phase 4 model.
- **Real freemium / subscription purchase + limit enforcement** — Phase 5 (PAY-01–05). Phase 4 only reads Pro status.
- **Exporting statistics (CSV/PDF)** — out of scope (see REQUIREMENTS.md Out of Scope).

</deferred>

---

*Phase: 04-statistics*
*Context gathered: 2026-05-17*
