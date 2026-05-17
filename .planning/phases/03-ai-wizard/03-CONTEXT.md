# Phase 3: AI Wizard - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the **AI Wizard** — a 4-step flow that lets an authenticated owner generate a complete quiz from a text source or uploaded file:

1. **Step 1** — quiz title
2. **Step 2** — source material (paste text OR upload a file) + a clarifying prompt describing what the quiz should test
3. **Step 3** — generation parameters (question count, difficulty)
4. **Step 4** — async generation: an Edge Function inserts an `ai_jobs` row, calls OpenAI in `waitUntil()`, the client polls until the job completes, then the owner is redirected into the standard quiz editor with the generated quiz pre-populated.

**Requirements covered:** AI-01–07 (7 requirements).

**NOT in this phase:** statistics (Phase 4); real freemium enforcement (Phase 5). Plan-dependent limits (file size, question count, monthly AI-generation quota) are *designed* here but the hard, un-bypassable gate is Phase 5 — same pattern as Phase 2 building access links ungated. File-size validation must still happen server-side in the Edge Function (project constraint #4) regardless of the Phase 5 quota gate.
</domain>

<decisions>
## Implementation Decisions

### Wizard Surface & Entry
- **D-01:** The wizard is a **dedicated full-screen route** (e.g. `/ai-wizard`), not a modal. The 4 steps and the long generation step are not constrained by a modal; the URL survives refresh.
- **D-02:** Two entry points, both leading to the same route: a button on `/my` (next to the regular "New quiz") and an AI button in the quiz-editor header (per SPEC). Regardless of entry point, the wizard **always creates a new quiz** — it never appends to or mutates an existing quiz.
- **D-03:** The `quizzes` row (and its `questions` / `answer_options`) is created **only after a successful generation**. Steps 1–3 live in client memory; the Edge Function persists the quiz when OpenAI returns valid JSON. Abandoned wizards leave no empty drafts in `/my`.

### Step 2 — Source Material
- **D-04:** **One source at a time** — a toggle (tabs) between "paste text" and "upload file". Not both simultaneously.
- **D-05:** A **separate clarifying-prompt field** sits next to the source. It describes what the quiz should test (e.g. for a book — "knowledge of characters and events"). **This single field also serves as AI-04's "focus area"** — there is no separate focus-area field on step 3. (Deliberate deviation from AI-04's literal wording: the requirement's intent — owner controls what is tested — is satisfied by this step-2 field.)
- **D-06:** File upload is **in scope for v1**: a single PDF/DOCX file. **Size limit is plan-dependent — Free: 1 MB, Pro: 5 MB.** The limit value is chosen here; the wizard reads `profiles.plan` (column exists since migration 001) to apply it. Server-side size validation in the Edge Function is mandatory.

### Step 3 — Generation Parameters
- **D-07:** **Question count is a numeric input field.** Range is plan-dependent — **Free: max 10, Pro: max 100.** (Free's 10-question cap matches PAY-01.)
- **D-08:** **Difficulty has 3 levels** — лёгкий / средний / сложный — plus an **optional free-text prompt** for fine-tuning how difficulty should be regulated.
- **D-09:** **The AI decides each question's type** (single / multiple) — there is no owner-facing type selector in the wizard. The owner edits any question's type freely afterwards in the standard editor.
- Step 3 therefore contains only **question count + difficulty** (focus area moved to step 2 per D-05).

### Step 4 — Progress & Failure
- **D-10:** Progress UI is **stage-based** — a spinner with changing Russian status messages reflecting real `ai_jobs` stages (e.g. "Читаю материал…" → "Составляю вопросы…" → "Сохраняю…"). **No fake percentage bar** — OpenAI gives no real progress signal.
- **D-11:** On failure (OpenAI error, invalid JSON, timeout) the Edge Function performs **one automatic retry**. If the retry also fails, the wizard shows a clear Russian error message with a manual **"Повторить"** button (steps 1–3 input is preserved; no quiz row is created).
- **D-12:** The owner **cannot leave step 4** until generation completes — navigating away triggers a warning. Generation is not designed as a resumable background job for v1.

### Claude's Discretion
- Exact Russian copy for all status messages, error messages, field labels, and helper text.
- The exact OpenAI model and prompt engineering (researcher/planner decide).
- The exact set of Edge Functions and the precise `ai_jobs` table schema (status/stage enum, error column, nullable `quiz_id`, `owner_id`, etc.).
- Client polling interval for `ai_jobs` status.
- Step-back navigation within the wizard before generation (standard wizard behaviour: steps 1–3 editable; "next" disabled until a step is valid).
- PDF/DOCX text-extraction approach (where parsing runs, which library).
- Visual styling within the established design system.
- Numeric-field validation messaging and exact range bounds enforcement.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project spec & requirements
- `SPEC.md` — AI-wizard 4-step description, the **JSON schema returned by AI** (title/description/time_limit_sec/questions[]/answers[]), freemium table (Free vs Pro: AI 1/mo vs 30/mo), DB schema for all tables
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria (`ai_jobs` row + `waitUntil()` + client polling, request returns < 200 ms), requirement IDs
- `.planning/REQUIREMENTS.md` — AI-01–07; freemium limits PAY-01 (Free: 1 AI generation/month, 10 questions/quiz)
- `CLAUDE.md` — key constraints: OpenAI **never** called from client (only via Edge Functions); freemium limits enforced at DB/Edge Function level; FSD import rules

### Architecture & pitfalls
- `.planning/research/ARCHITECTURE.md` — FSD layer mapping, Edge Function responsibilities, Pinia store patterns
- `.planning/research/PITFALLS.md` — project-wide pitfalls
- `.planning/research/STACK.md` — library versions and rationale

### Prior phase context
- `.planning/phases/02-quiz-taking-sharing/02-CONTEXT.md` — first Edge Functions established here; patterns for `_shared` helpers and the `supabase/functions/` layout
- `.planning/phases/01-foundation-auth-and-quiz-editor/01-CONTEXT.md` — quiz editor decisions, design system, shadcn-vue component foundation
- `.planning/STATE.md` — accumulated cross-phase decisions

### Existing schema & code
- `supabase/migrations/001_init_profiles.sql` — `profiles` table incl. `plan` enum (`free` | `pro`) — read for plan-aware limits
- `supabase/migrations/002_quizzes.sql` — `quizzes` table (target of generated output)
- `supabase/migrations/003_questions_answers.sql` — `questions`, `answer_options` tables (target of generated output)
- `supabase/migrations/007_rls_policies.sql` — RLS dual-policy pattern
- `supabase/functions/_shared/` — existing Edge Function helpers (`cors.ts`, `errors.ts`, `jwt.ts`) — reuse pattern; note the AI wizard caller is an **authenticated owner** (Supabase Auth JWT), not a guest token

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/functions/_shared/cors.ts`, `errors.ts` — CORS + error-response helpers, reusable directly
- `supabase/functions/_shared/jwt.ts` — guest-token JWT helper; the AI-wizard Edge Functions instead verify the owner's Supabase Auth JWT (different path, but the helper layout is the model)
- `src/6-shared/ui/` — `Button`, `Dialog`, `Input`, `Tabs` + `TabsList`/`TabsTrigger`/`TabsContent` (ready for the step-2 text⇄file toggle), `Tooltip` — generic UI kit
- `src/4-features/quiz-list/ui/EmptyState.vue` — empty-state pattern reference
- `src/5-entities/quiz`, `src/5-entities/question`, `src/5-entities/answer-option` — domain models + API fetchers; reused when the editor loads the generated quiz
- `src/4-features/quiz-editor/` — the standard editor the wizard redirects into after generation (`QuizMetaForm`, `QuestionEditor`, `AnswerOptionEditor`, etc.)

### Established Patterns
- FSD layer discipline enforced by steiger; Composition-API Pinia stores
- Supabase error handling → `toast.error`; all async ops in try/catch
- Edge Functions live in `supabase/functions/`, use `service_role`, share `_shared/` helpers
- Routing: `src/1-app/router/index.ts` — new routes use `meta: { requiresAuth: true }` + `beforeEach` guard with `returnUrl`

### Integration Points
- **New route** `/ai-wizard` in `src/1-app/router/index.ts` with `meta: { requiresAuth: true }`
- **New feature slice** `src/4-features/ai-wizard/` — Pinia store driving the 4 steps + polling
- **New entity slice** for `ai-jobs` (status/stage model + fetcher)
- **New migration** (next free index `012_*.sql`) — `ai_jobs` table (status, stage, error, nullable `quiz_id`, `owner_id`) + RLS so an owner reads only their own jobs
- **New Edge Function(s)** in `supabase/functions/` — e.g. one to create the job + run OpenAI in `waitUntil()`, one to poll job status; exact set is a planning decision
- **AI button** added to the quiz-editor header (existing `quiz-editor` feature) and a button on `/my` (`MyQuizListPage` / `quiz-list` feature)
- **OpenAI API key** configured as a Supabase secret (never shipped to the client)
- PDF/DOCX text extraction runs inside the Edge Function

</code_context>

<specifics>
## Specific Ideas

- The step-2 clarifying prompt is meant to capture intent like "for a book — test knowledge of characters and events" — owner describes what the quiz should focus on, in their own words.
- Status messages on step 4 must be in Russian and reflect real processing stages (AI-07), never leave the owner on a blank screen (ROADMAP SC#2).
- The wizard follows the established design system used across Phases 1–2.

</specifics>

<deferred>
## Deferred Ideas

- **Multiple files / multi-source input** — v1 is a single file or a single text block. Multi-file is a future enhancement.
- **Real freemium enforcement** — the un-bypassable gate for file size (Free 1 MB / Pro 5 MB), question count (Free ≤10 / Pro ≤100), and the monthly AI-generation quota (Free 1/mo) belongs to Phase 5. Phase 3 builds plan-aware limit values and server-side validation; Phase 5 owns the hard gate. (Open question for Phase 5: a *failed* generation should probably not consume the monthly quota.)
- **Percentage progress bar** — considered for step 4, declined in favour of honest stage-based statuses (no real OpenAI progress signal).
- **Background generation + return-later** — considered, declined; step 4 blocks until done in v1 (D-12).
- **AI button appending questions to the current quiz** — considered, declined; the wizard always creates a new quiz (D-02).

</deferred>

---

*Phase: 03-ai-wizard*
*Context gathered: 2026-05-17*
