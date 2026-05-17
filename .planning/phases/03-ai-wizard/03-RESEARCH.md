# Phase 3: AI Wizard - Research

**Researched:** 2026-05-17
**Domain:** Async job pipeline + 4-step wizard UI (Supabase Edge Functions, Vue 3/Pinia, FSD)
**Confidence:** HIGH (FSD layout, migration pattern, RLS, polling, editor redirect) / MEDIUM (file-upload transport, owner-JWT verification path)

## Summary

This research covers everything the planner needs that the **03-AI-SPEC.md does NOT already cover**. The AI-SPEC fully owns the OpenAI call, Structured Outputs, the strict JSON schema, PDF/DOCX extraction libraries, the `waitUntil()` pattern, prompt engineering, and the eval strategy — none of that is repeated here. This document concentrates on the *plumbing*: the `ai_jobs` migration, the FSD slice layout, client polling, the editor redirect, the two Edge Functions' auth path, plan-aware limits, and file-upload transport.

The phase is a thin async-job vertical slice on top of a mature codebase. Phase 2 already established the `supabase/functions/` directory, the `_shared/` helpers (`cors.ts`, `errors.ts`, `jwt.ts`), the owner-authenticated Edge Function pattern (`create-quiz-access` is the exact model — `supabase.auth.getUser(token)` then in-handler ownership re-check because `service_role` bypasses RLS), and the migration + dual-RLS conventions through migration `011`. The new work is: one migration (`012_ai_jobs.sql`), one new entity slice (`5-entities/ai-job`), one new feature slice (`4-features/ai-wizard` with the 4-step Pinia store + polling), one new page + route (`/ai-wizard`), two new Edge Functions (`ai-generate-quiz`, `ai-job-status`), and two entry-point buttons.

**Primary recommendation:** Build it as a standard owner-authenticated async-job feature. Reuse `create-quiz-access` verbatim as the auth template for both new Edge Functions. The `ai_jobs` table follows the exact dual-RLS pattern of `007_rls_policies.sql`. After generation, the wizard redirects to the existing `/editor/:id` route — the editor's `loadQuiz()` already fetches everything; no editor changes are needed for load. Send the uploaded file as **base64 inside the JSON body** (Phase 2's EFs all use JSON bodies and `supabase.functions.invoke` defaults to JSON) — Storage round-trips add no value because D-03 says nothing is persisted until success.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 4-step wizard UI + step state | Browser / Client (`4-features/ai-wizard`) | — | Steps 1–3 live in client memory only (D-03); no DB until success |
| File reading → base64 encoding | Browser / Client | — | `FileReader` runs client-side; the *parsing* is server-side |
| PDF/DOCX text extraction | API / Edge Function | — | Constraint #4 + D-06: parsing and size validation are server-side |
| OpenAI generation call | API / Edge Function (`ai-generate-quiz`) | — | OpenAI key never on client (CLAUDE.md constraint #1) |
| `ai_jobs` row lifecycle (status/stage) | API / Edge Function (`service_role`) | Database | Background task writes; client only reads |
| Job status polling | Browser / Client | API (`ai-job-status`) | Client polls; EF reads one owned row |
| Quiz persistence (`quizzes`/`questions`/`answer_options`) | API / Edge Function (`service_role`) | Database | Generated quiz inserted server-side after valid JSON |
| Plan-aware limit *values* | Browser / Client (UX) | API / Edge Function (enforcement) | Client reads `profiles.plan` for UX; EF re-validates (constraint #4) |
| Post-generation editor load | Browser / Client (existing `quiz-editor`) | API (PostgREST + owner RLS) | Reuse `useQuizEditorStore.loadQuiz()` unchanged |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Wizard is a **dedicated full-screen route** (`/ai-wizard`), not a modal. URL survives refresh.
- **D-02:** Two entry points — a button on `/my` (next to "New quiz") and an AI button in the quiz-editor header. Both lead to `/ai-wizard`. The wizard **always creates a new quiz** — never appends to or mutates an existing one.
- **D-03:** The `quizzes` row (+ `questions`/`answer_options`) is created **only after a successful generation**. Steps 1–3 live in client memory; abandoned wizards leave no empty drafts.
- **D-04:** **One source at a time** — a Tabs toggle between "paste text" and "upload file". Not both simultaneously.
- **D-05:** A **separate clarifying-prompt field** sits next to the source on step 2 — describes what the quiz should test. **This single field also serves AI-04's "focus area"** — there is no separate focus-area field on step 3.
- **D-06:** File upload **in scope for v1** — a single PDF/DOCX file. **Size limit plan-dependent: Free 1 MB, Pro 5 MB.** Wizard reads `profiles.plan`. **Server-side size validation in the Edge Function is mandatory.**
- **D-07:** **Question count is a numeric input field.** Range plan-dependent — **Free max 10, Pro max 100.**
- **D-08:** **Difficulty has 3 levels** — лёгкий / средний / сложный — plus an **optional free-text prompt** for fine-tuning.
- **D-09:** **The AI decides each question's type** (single / multiple) — no owner-facing type selector in the wizard.
- **D-10:** Progress UI is **stage-based** — a spinner with changing Russian status messages reflecting real `ai_jobs` stages. **No fake percentage bar.**
- **D-11:** On failure the Edge Function performs **one automatic retry**. If the retry also fails, the wizard shows a Russian error + a manual **"Повторить"** button (steps 1–3 input preserved; no quiz row created).
- **D-12:** The owner **cannot leave step 4** until generation completes — navigating away triggers a warning. Not a resumable background job for v1.

### Claude's Discretion

- Exact Russian copy for all status messages, error messages, field labels, helper text.
- The exact OpenAI model and prompt engineering (decided in AI-SPEC §4: `gpt-4o-mini`, temp 0.4).
- The exact set of Edge Functions and the precise `ai_jobs` table schema.
- Client polling interval for `ai_jobs` status.
- Step-back navigation within the wizard before generation.
- PDF/DOCX text-extraction approach (decided in AI-SPEC §4: `unpdf` + `unzipit`, inside the EF).
- Visual styling within the established design system.
- Numeric-field validation messaging and exact range bounds enforcement.

### Deferred Ideas (OUT OF SCOPE)

- **Multiple files / multi-source input** — v1 is a single file or a single text block.
- **Real freemium enforcement** — the un-bypassable gate for file size, question count, and the monthly AI-generation quota belongs to **Phase 5**. Phase 3 builds plan-aware limit *values* + server-side validation; Phase 5 owns the hard gate. File-size validation must still happen server-side in Phase 3 (constraint #4) regardless.
- **Percentage progress bar** — declined in favour of honest stage-based statuses.
- **Background generation + return-later** — declined; step 4 blocks until done (D-12).
- **AI button appending questions to the current quiz** — declined; the wizard always creates a new quiz (D-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | Owner can open a 4-step wizard for AI generation | New `/ai-wizard` route + `2-pages/AiWizardPage.vue` + `4-features/ai-wizard` slice; two entry buttons (D-02). |
| AI-02 | Owner can enter a quiz title (step 1) | `WizardStep1.vue`; `useAiWizardStore.form.title` in client memory (D-03). |
| AI-03 | Owner can upload a PDF/DOCX file OR enter text/prompt as source (step 2) | `WizardStep2.vue` with `Tabs` toggle (D-04); base64 file transport; `unpdf`/`unzipit` extraction in `ai-generate-quiz` EF. |
| AI-04 | Owner can refine generation params: count, difficulty, focus area (step 3) | `WizardStep3.vue` — numeric count input (D-07) + 3-level difficulty + free-text prompt (D-08). Focus area satisfied by the step-2 clarifying-prompt field (D-05). |
| AI-05 | System generates a quiz via Edge Function → OpenAI → JSON → parsed into DB (step 4) | `ai-generate-quiz` EF: `waitUntil()` background task, `persistQuiz()` inserts `quizzes`/`questions`/`answer_options` (AI-SPEC §4). |
| AI-06 | After generation the owner is redirected into the standard editor | `useAiWizardStore` polls until `quiz_id` is set, then `router.push('/editor/' + quizId)` — editor's `loadQuiz()` is reused unchanged. |
| AI-07 | A progress indicator with clear Russian messages is shown during generation | `WizardStep4.vue` maps `ai_jobs.stage` → Russian copy (D-10); polling drives the live update. |
</phase_requirements>

## Standard Stack

No new frontend dependencies. The Edge Function adds `openai`, `unpdf`, and `unzipit` (Deno `npm:` specifiers, not `npm install`).

### Core (Edge Function — Deno `npm:` imports, pinned in `deno.json`)

| Library | Version (registry verified 2026-05-17) | Purpose | Why Standard |
|---------|----------------------------------------|---------|--------------|
| `openai` | latest `6.38.0` — **AI-SPEC pinned `4.104.0`** | OpenAI client + Structured Outputs | AI-SPEC §2 selection. **See Open Question 1 — version conflict.** |
| `@supabase/supabase-js` | `2` (matches Phase 2 EFs) | `service_role` DB client | Already used by every Phase 2 EF |
| `zod` | `3.24.x` (AI-SPEC pinned `3.24.1`) | Post-parse semantic re-validation | Same major as the frontend dep |
| `unpdf` | latest `1.6.2` — **AI-SPEC pinned `0.12.1`** | PDF → plain text, Deno-safe | AI-SPEC §4. **See Open Question 1 — version conflict.** |
| `unzipit` | latest `2.0.1` — **AI-SPEC pinned `1.4.3`** | DOCX (ZIP) unpacking | AI-SPEC §4. **See Open Question 1 — version conflict.** |

### Supporting (already in the project — reused, no install)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jose` | `5` (Phase 2 `_shared/jwt.ts` uses `npm:jose@5`) | — | **NOT needed** for AI EFs — owner JWT is verified via `supabase.auth.getUser()`, not `jose`. The guest `jwt.ts` helper is irrelevant here. |
| `vue` / `pinia` / `vue-router` | existing | Wizard UI, store, route | Standard feature-slice build |
| `vue-sonner` (`toast`) | existing | Error toasts | Established error pattern |
| `vee-validate` + `@vee-validate/zod` | existing | Step field validation | Title, count numeric bounds |
| `lucide-vue-next` | existing | Icons | `Sparkles`/`Wand2` for the AI buttons |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client polling of `ai-job-status` | Supabase Realtime subscription on `ai_jobs` | Realtime is push (no interval) but adds a websocket, RLS-on-Realtime setup, and reconnect handling. Polling is simpler, survives refresh trivially (job id is the only state), and AI-SPEC §4b explicitly recommends polling. **Use polling.** |
| base64 file in JSON body | `multipart/form-data` to the EF / upload to Storage first | `supabase.functions.invoke` sends JSON by default; multipart needs a manual `fetch` with `FormData`. Storage round-trip contradicts D-03 (nothing persisted pre-success) and adds cleanup. **Use base64-in-JSON** (see Pitfall 4 for the size note). |
| New `ai-job` entity slice | Inline the job type in the feature store | FSD: the job is a domain noun with a fetcher → it belongs in `5-entities` (CONTEXT.md integration points say so explicitly). |

**Installation (Edge Function — no `npm install`; pin in each function's `deno.json`):**
```jsonc
// supabase/functions/ai-generate-quiz/deno.json
{
  "imports": {
    "openai": "npm:openai@<PINNED>",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "zod": "npm:zod@3.24.1",
    "unpdf": "npm:unpdf@<PINNED>",
    "unzipit": "npm:unzipit@<PINNED>"
  }
}
```
```bash
supabase secrets set OPENAI_API_KEY=sk-...   # already may exist for Studio AI — verify
```

**Version verification (run 2026-05-17):** `npm view openai version` → `6.38.0`; `npm view unpdf version` → `1.6.2`; `npm view unzipit version` → `2.0.1`; `npm view jose version` → `6.2.3`. The AI-SPEC pinned older versions (`openai@4.104.0`, `unpdf@0.12.1`, `unzipit@1.4.3`). This is flagged as Open Question 1 / Assumption A1 — the planner must reconcile.

## Package Legitimacy Audit

> The Edge Function installs `openai`, `unpdf`, `unzipit`. `slopcheck` was not available in this research environment — all three are therefore tagged `[ASSUMED]` and the planner should gate the `deno.json` pin behind a verification step (confirm against official docs / npm publisher before deploy).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `openai` | npm | mature (years) | very high | github.com/openai/openai-node | unavailable | `[ASSUMED]` — official OpenAI SDK, AI-SPEC §2 selected; verify pinned version |
| `unpdf` | npm | mature | high (unjs org) | github.com/unjs/unpdf | unavailable | `[ASSUMED]` — `unjs` ecosystem; AI-SPEC §4 selected; verify pinned version |
| `unzipit` | npm | mature | moderate | github.com/greggman/unzipit | unavailable | `[ASSUMED]` — AI-SPEC §4 selected; verify pinned version |
| `@supabase/supabase-js` | npm | mature | very high | github.com/supabase/supabase-js | unavailable | `[OK]` — already in use across all Phase 2 EFs |
| `zod` | npm | mature | very high | github.com/colinhacks/zod | unavailable | `[OK]` — already a frontend project dependency |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none. Three packages are `[ASSUMED]` only because slopcheck was unavailable and the pinned versions need confirming — all three are well-known packages selected by the AI-SPEC.

## Architecture Patterns

### System Architecture Diagram

```
                          AI WIZARD — request / data flow

  ┌─────────────────────── BROWSER (4-features/ai-wizard) ───────────────────────┐
  │                                                                              │
  │  Step1 (title) → Step2 (source: text|file + clarifying prompt) → Step3        │
  │  (count, difficulty, diff-prompt)   — all held in useAiWizardStore (memory)   │
  │                                                                              │
  │  Step4: startGeneration()                                                    │
  │    │  if file → FileReader → base64                                          │
  │    ▼                                                                         │
  └────┼─────────────────────────────────────────────────────────────────────────┘
       │ POST supabase.functions.invoke('ai-generate-quiz')  (auth header auto)
       │ body: { title, sourceText|fileBase64+fileName, clarifyingPrompt,
       │         count, difficulty, difficultyPrompt }
       ▼
  ┌─── ai-generate-quiz EF (service_role) ──────────────────────────────────────┐
  │  1. supabase.auth.getUser(token)            → owner identity                 │
  │  2. read profiles.plan → apply D-06/D-07 limits (SERVER-SIDE, constraint #4)  │
  │  3. if file → extract-text.ts (unpdf|unzipit) → cap at 12k chars             │
  │  4. INSERT ai_jobs (status=pending, stage=reading, owner_id)                 │
  │  5. EdgeRuntime.waitUntil( runGeneration(jobId) )   ◀── background task       │
  │  6. return 202 { jobId }                            ◀── < 200 ms              │
  └──────┬──────────────────────────────────────────────┬───────────────────────┘
         │ (returns immediately)                        │ runGeneration (async)
         │                                              ▼
         │                            stage='generating' → OpenAI call + retry
         │                            stage='saving'     → persistQuiz()
         │                            INSERT quizzes/questions/answer_options
         │                            UPDATE ai_jobs status=completed, quiz_id=…
         │                            (on failure → status=failed, error=…)
         ▼
  ┌─── BROWSER: poll loop (every ~2 s) ─────────────────────────────────────────┐
  │  supabase.functions.invoke('ai-job-status', { jobId })                      │
  │    → { status, stage, error, quiz_id }                                      │
  │  stage  → Russian message in WizardStep4 (D-10 / AI-07)                      │
  │  status='completed' → stop poll → router.push('/editor/' + quiz_id) (AI-06)  │
  │  status='failed'    → stop poll → show error + "Повторить" (D-11)            │
  └─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
              EXISTING /editor/:id  →  useQuizEditorStore.loadQuiz(quizId)
              (no editor changes needed — fetchQuiz/fetchQuestions/fetchAnswerOptions)
```

### Recommended Project Structure

```
src/
├── 1-app/router/index.ts          # + route { path: '/ai-wizard', meta: { requiresAuth: true } }
├── 2-pages/
│   └── AiWizardPage.vue            # NEW — thin assembler, mounts the wizard widget/feature
├── 3-widgets/
│   └── AiWizardWidget.vue          # NEW (optional) — owns the store, renders the active step
├── 4-features/ai-wizard/           # NEW feature slice
│   ├── model/
│   │   └── useAiWizardStore.ts     # step (1-4), form, generation status, polling
│   └── ui/
│       ├── WizardStep1.vue         # title (AI-02)
│       ├── WizardStep2.vue         # Tabs: text | file + clarifying prompt (AI-03, D-04/D-05)
│       ├── WizardStep3.vue         # count + difficulty + diff-prompt (AI-04, D-07/D-08)
│       ├── WizardStep4.vue         # stage-based progress + error/Повторить (AI-07, D-10/D-11)
│       └── WizardStepper.vue       # optional 1-2-3-4 indicator
└── 5-entities/ai-job/              # NEW entity slice
    ├── model.ts                    # AiJob, AiJobStatus, AiJobStage types
    └── api.ts                      # invokeGenerateQuiz(), invokeAiJobStatus()

supabase/
├── migrations/
│   └── 012_ai_jobs.sql             # NEW — ai_jobs table + dual RLS
└── functions/
    ├── _shared/
    │   ├── cors.ts                 # REUSE
    │   ├── errors.ts               # REUSE (serializeError, GENERIC_500_MESSAGE)
    │   ├── quiz-schema.ts           # NEW — QUIZ_JSON_SCHEMA + QuizSchema (Zod)  [AI-SPEC §4]
    │   ├── quiz-prompt.ts           # NEW — SYSTEM_PROMPT + buildUserPrompt()    [AI-SPEC §4b]
    │   ├── extract-text.ts          # NEW — PDF/DOCX → text                      [AI-SPEC §4]
    │   └── openai.ts                # NEW — generateQuiz() with D-11 retry       [AI-SPEC §4b]
    ├── ai-generate-quiz/
    │   ├── deno.json                # NEW — pinned import map
    │   └── index.ts                 # NEW — auth → limits → insert job → waitUntil → 202
    └── ai-job-status/
        └── index.ts                 # NEW — owner polls one owned job row
```

> Note on the entity API placement: the two Edge Functions are *invoked*, not direct table reads. Phase 2 put EF-invocation wrappers in `5-entities/quiz-session/api.ts` (`invokeVerifyAccess`, etc.). Follow that exact precedent — `5-entities/ai-job/api.ts` holds `invokeGenerateQuiz()` and `invokeAiJobStatus()`. This keeps the feature store calling entity functions, not `supabase.functions.invoke` directly.

### Pattern 1: Owner-authenticated Edge Function (the auth path)

**What:** Verify an authenticated owner. The guest `_shared/jwt.ts` helper is for GUEST tokens and is **NOT used** here. The owner caller path is `supabase.auth.getUser(bearerToken)`.
**When to use:** Both `ai-generate-quiz` and `ai-job-status`.
**Example — verbatim model from the existing `create-quiz-access`:**
```typescript
// Source: supabase/functions/create-quiz-access/index.ts (Phase 2, in-repo)
const authHeader = req.headers.get('Authorization')
if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const token = authHeader.replace('Bearer ', '')
const { data: { user }, error: userError } = await supabase.auth.getUser(token)
if (userError || !user) return json({ error: 'Unauthorized' }, 401)
// user.id is the owner — service_role bypasses RLS, so re-check ownership in-handler.
```
- These EFs stay **out of `config.toml`** so `verify_jwt` defaults to `true` (Supabase pre-validates the JWT). In-handler `getUser()` is still required to obtain `user.id`. This matches the STATE.md decision: *"Owner-authenticated Edge Functions stay out of `config.toml` so `verify_jwt` defaults to true; they still re-verify ownership in-handler."*
- `ai-job-status` must verify the polled job's `owner_id === user.id` before returning it — `service_role` bypasses RLS.
- The frontend uses `supabase.functions.invoke()` (Phase 2 pattern in `5-entities/quiz-session/api.ts`), which **automatically attaches the logged-in user's `Authorization` header** — no manual token handling on the client.

### Pattern 2: The `ai_jobs` migration (`012_ai_jobs.sql`)

**What:** A status table the client polls. Next free index is **`012`** (existing migrations run `001`–`011`).
**Example — follows the `002`/`007` conventions exactly (enum types, `ENABLE ROW LEVEL SECURITY` immediately after `CREATE TABLE`, `(SELECT auth.uid())` for initPlan, indexes on RLS-predicate columns):**
```sql
-- supabase/migrations/012_ai_jobs.sql
-- AI generation job tracking. Polled by the owner from the AI wizard (Phase 3).
-- Dual-RLS pattern from 007: owner reads own rows; no anon policy at all.

CREATE TYPE ai_job_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE ai_job_stage  AS ENUM ('reading', 'generating', 'saving', 'done');

CREATE TABLE ai_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  status      ai_job_status NOT NULL DEFAULT 'pending',
  stage       ai_job_stage  NOT NULL DEFAULT 'reading',
  error       text,                       -- generic code on failure (D-11), nullable
  quiz_id     uuid REFERENCES quizzes ON DELETE SET NULL,  -- nullable until success (D-03)
  -- Optional monitoring columns (AI-SPEC §7) — safe to include now, used by Phase 5/monitoring:
  attempt_count    int,
  finish_reason    text,
  failure_reason   text,
  prompt_tokens    int,
  completion_tokens int,
  duration_ms      int,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON ai_jobs (owner_id);

-- Owner can read ONLY their own jobs (the wizard polls via PostgREST OR via the EF).
CREATE POLICY "owner_read_ai_jobs"
  ON ai_jobs FOR SELECT TO authenticated
  USING ( owner_id = (SELECT auth.uid()) );

-- NO anon policy — guests have zero access to ai_jobs.
-- NO insert/update policy for authenticated — all writes are service_role (the EFs),
-- mirroring quiz_sessions/session_answers (007 comments: "managed by Edge Functions").
```

> **Planner decision — polling transport:** Because the `owner_read_ai_jobs` SELECT policy exists, the client *could* poll `ai_jobs` directly via PostgREST (`supabase.from('ai_jobs').select(...).eq('id', jobId).single()`) instead of through the `ai-job-status` EF. Direct PostgREST polling is **simpler** (no EF cold-start per poll, the SELECT RLS already scopes to the owner) and is the recommended default. Keep `ai-job-status` as an EF **only** if a future need for response shaping arises. **Recommendation: poll `ai_jobs` directly via PostgREST; do NOT build `ai-job-status` as a separate Edge Function.** This collapses the phase to ONE new Edge Function. (CONTEXT.md leaves "the exact set of Edge Functions" to Claude's discretion — this is that decision. The AI-SPEC's `ai-job-status` function is therefore optional; flagged as Assumption A2.)

### Pattern 3: The 4-step wizard Pinia store

**What:** A composition-API store driving step state, the form, and the polling loop.
**When to use:** `4-features/ai-wizard/model/useAiWizardStore.ts`.
**Example sketch (extends the ARCHITECTURE.md `useAiWizardStore` outline with D-03..D-12 reality):**
```typescript
export const useAiWizardStore = defineStore('ai-wizard', () => {
  const step = ref<1 | 2 | 3 | 4>(1)
  const form = ref({
    title: '',
    sourceMode: 'text' as 'text' | 'file',
    sourceText: '',
    file: null as File | null,
    clarifyingPrompt: '',          // D-05 — also the AI-04 focus area
    questionCount: 10,             // D-07 — numeric input
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',  // D-08
    difficultyPrompt: '',          // D-08 — optional free text
  })
  const generationStatus = ref<'idle' | 'pending' | 'failed' | 'done'>('idle')
  const currentStage = ref<AiJobStage | null>(null)   // drives D-10 Russian copy
  const jobId = ref<string | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  // step validity gates "next" (Claude's discretion — standard wizard behaviour)
  const isStepValid = computed(() => { /* per-step rules */ })

  async function startGeneration() {
    generationStatus.value = 'pending'
    const fileBase64 = form.value.file ? await fileToBase64(form.value.file) : undefined
    const { jobId: id } = await invokeGenerateQuiz({ ...payload })
    jobId.value = id
    startPolling(id)
  }

  function startPolling(id: string) {
    pollTimer = setInterval(async () => {
      const job = await fetchAiJob(id)          // PostgREST read, owner RLS
      currentStage.value = job.stage
      if (job.status === 'completed' && job.quiz_id) {
        stopPolling(); generationStatus.value = 'done'
        router.push('/editor/' + job.quiz_id)   // AI-06
      } else if (job.status === 'failed') {
        stopPolling(); generationStatus.value = 'failed'   // D-11 → show Повторить
      }
    }, 2000)
  }
  function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null }
  // retry() — reset generationStatus to 'idle', keep form intact (D-11), call startGeneration()
})
```

### Anti-Patterns to Avoid

- **Persisting a draft quiz at step 1.** D-03 forbids it — no `quizzes` row until the generation succeeds. The wizard form lives in the store only.
- **Calling `supabase.functions.invoke` directly from a component.** FSD: components → store action → entity `api.ts`. Mirror `5-entities/quiz-session/api.ts`.
- **Using the guest `_shared/jwt.ts` helper for the AI EFs.** That helper verifies GUEST tokens signed with `GUEST_JWT_SECRET`. The AI wizard caller is an authenticated owner — use `supabase.auth.getUser()`.
- **`await`-ing the OpenAI call inside the request handler.** Blows the < 200 ms SLA. Use `EdgeRuntime.waitUntil()` (AI-SPEC §4 Pitfall 4).
- **`setInterval` poll without a stop condition.** Always `clearInterval` on `completed`/`failed` AND on store teardown / `onUnmounted` — a leaked interval keeps polling a finished job.
- **Trusting client-supplied limits.** D-06/D-07 + constraint #4: the EF re-reads `profiles.plan` and re-validates file size and question count server-side. Client checks are UX only.
- **A separate focus-area field on step 3.** D-05 explicitly says the step-2 clarifying prompt *is* the focus area. Step 3 = count + difficulty only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Owner JWT verification | Manual JWT decode/verify | `supabase.auth.getUser(token)` + `verify_jwt` default | Supabase validates signature/expiry; `getUser` resolves the user |
| PDF text extraction | Custom pdf.js wiring | `unpdf` (`extractText`) | Deno-safe serverless pdf.js build (AI-SPEC §4) |
| DOCX text extraction | Custom OOXML parser | `unzipit` + read `word/document.xml` | `mammoth` has Node Buffer deps that fail on Deno (AI-SPEC §4) |
| JSON-schema-conformant generation | Prompt + hope + `JSON.parse` | OpenAI Structured Outputs `strict: true` + Zod | Hard shape guarantee; Zod adds semantics (AI-SPEC §4b) |
| File → base64 | Manual byte loop | `FileReader.readAsDataURL` (strip the `data:` prefix) | Browser-native, correct, async |
| Async job tracking | In-memory map / globals | `ai_jobs` table polled via RLS-scoped SELECT | Survives EF cold-starts and client refresh |
| Migration index | Guessing the next number | `012` (verified: `001`–`011` exist) | Off-by-one breaks `supabase db push` ordering |

**Key insight:** Phase 3 is almost entirely *assembly* of patterns the codebase already proves — the owner-EF auth path (`create-quiz-access`), the dual-RLS migration (`007`), the EF-invocation entity wrappers (`quiz-session/api.ts`), the feature-store-drives-everything convention. The only genuinely new mechanic is the `waitUntil()` background task + poll loop, and the AI-SPEC already specifies that in full.

## Runtime State Inventory

> Phase 3 is greenfield additive — it creates new tables/slices/functions, it does not rename or migrate existing runtime state. This section is included only to confirm there is nothing to migrate.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `ai_jobs` is a brand-new table. Generated quizzes go into existing `quizzes`/`questions`/`answer_options` via normal inserts. | None |
| Live service config | None — no external service config changes. `OPENAI_API_KEY` Supabase secret may already exist (`config.toml` references it for Studio AI) — **verify it is set as a function secret, not only a Studio key.** | Verify `supabase secrets list` includes `OPENAI_API_KEY` |
| OS-registered state | None | None |
| Secrets/env vars | `OPENAI_API_KEY` — needed by `ai-generate-quiz`. Verify present. No env var renames. | `supabase secrets set OPENAI_API_KEY=…` if absent |
| Build artifacts | None — new function directories; `deno.json` import maps are created fresh. | None |

## Common Pitfalls

### Pitfall 1: The owner EF caller is NOT a guest token
**What goes wrong:** A developer reuses `_shared/jwt.ts` (`verifyGuestToken`) for the AI EFs because Phase 2 used it everywhere. It fails — the AI wizard caller is an authenticated Supabase Auth owner, not a guest holding a `GUEST_JWT_SECRET`-signed token.
**Why it happens:** Phase 2 established `jwt.ts` as "the EF auth helper". It is not — it is the *guest* helper.
**How to avoid:** Use `supabase.auth.getUser(bearerToken)` exactly as `create-quiz-access` does. The owner's JWT arrives automatically via `supabase.functions.invoke`.
**Warning signs:** `jose` imported in `ai-generate-quiz/index.ts`; `GUEST_JWT_SECRET` referenced.

### Pitfall 2: Synchronous OpenAI call times out the EF (AI-SPEC §4 Pitfall 4)
**What goes wrong:** `await openai.chat.completions.create(...)` directly in the handler — the request blocks 10–30 s, breaks the < 200 ms ROADMAP SLA, may hit the EF wall-clock limit.
**Why it happens:** It is the obvious linear way to write it.
**How to avoid:** `EdgeRuntime.waitUntil(runGeneration(jobId, ...))` then `return 202 { jobId }` immediately. Never `await` the `waitUntil` promise; never omit it.
**Warning signs:** No `EdgeRuntime.waitUntil` in `ai-generate-quiz`; HTTP response takes seconds.

### Pitfall 3: Poll loop leaks / never stops
**What goes wrong:** `setInterval` keeps firing after the job completes, or after the owner navigates away from `/ai-wizard` — wasted requests, a zombie timer.
**Why it happens:** The stop condition is only wired to `completed`/`failed` and not to component/store teardown.
**How to avoid:** `clearInterval` on `completed`, on `failed`, AND in the wizard page's `onUnmounted` (and on `retry()` before restarting). D-12 keeps the owner on step 4, but a hard refresh or browser-close still needs the timer gone.
**Warning signs:** Network tab shows `ai_jobs` polls continuing after redirect to `/editor`.

### Pitfall 4: base64 file payload inflates and trips body limits
**What goes wrong:** A 5 MB Pro file becomes ~6.7 MB as base64 in a JSON body; an Edge Function / gateway request-body cap rejects it, or memory spikes.
**Why it happens:** base64 adds ~33%. The D-06 limits (1 MB / 5 MB) are *file* sizes, not encoded-payload sizes.
**How to avoid:** Validate the *raw* `File.size` against the plan limit **on the client before encoding** (UX) AND decode + check the raw byte length **server-side** (constraint #4). Confirm Supabase's EF request-body limit comfortably exceeds 5 MB × 1.33 ≈ 6.7 MB — **flagged as Open Question 2**. If the limit is tight, fall back to a Storage upload + signed path. Cap extracted *text* at ~12k chars regardless (AI-SPEC §4).
**Warning signs:** Large-PDF uploads fail with a 413 / network error while small ones work.

### Pitfall 5: `is_correct` re-indexing on persist (AI-SPEC §4 Pitfall 6)
**What goes wrong:** `persistQuiz()` inserts `questions`/`answer_options` using the model's `order_index` values, which may not be a tidy `0..n-1`. The editor sorts by `order_index ASC` (PITFALLS.md §6.4) and renders in a jumbled order.
**Why it happens:** Structured Outputs fills `order_index` but does not guarantee a clean sequence.
**How to avoid:** In `persistQuiz`, re-index `questions[]` and each `answers[]` array deterministically (`forEach((x, i) => x.order_index = i)`) before insert — exactly what `useQuizEditorStore` does on reorder/delete.
**Warning signs:** Generated quiz opens in the editor with questions out of order or gaps.

### Pitfall 6: Generated quiz not owned by the caller
**What goes wrong:** `persistQuiz` inserts the `quizzes` row without `owner_id`, or with the wrong one — the owner is redirected to `/editor/:id` and the editor's owner-RLS `SELECT` returns nothing → "Не удалось загрузить тест".
**Why it happens:** The EF runs as `service_role` (RLS-bypassing) so a missing `owner_id` does not fail the insert — it fails *later*, on the owner's RLS-scoped read.
**How to avoid:** `persistQuiz` must set `quizzes.owner_id = user.id` (the `getUser()` result passed into `runGeneration`). Verify the redirect target loads under the owner's session.
**Warning signs:** AI-06 redirect lands on an empty/erroring editor.

### Pitfall 7: D-12 navigation guard not wired
**What goes wrong:** On step 4 the owner clicks back / closes the tab mid-generation; the job orphans (no UI is watching) with no warning.
**Why it happens:** D-12 ("cannot leave step 4 until done") needs an explicit `onBeforeRouteLeave` guard + `beforeunload` listener — it is not automatic.
**How to avoid:** In `AiWizardPage.vue`, register `onBeforeRouteLeave` returning a confirm when `generationStatus === 'pending'`, plus a `beforeunload` handler. Remove both on `done`/`failed`.
**Warning signs:** Navigating away from step 4 mid-generation is silent.

## Code Examples

### File → base64 (client, for the step-2 file upload)
```typescript
// 4-features/ai-wizard/model/ — or 6-shared/lib/file.ts
// FileReader is browser-native; strip the "data:<mime>;base64," prefix.
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

### Entity API — EF invocation wrappers (mirrors `5-entities/quiz-session/api.ts`)
```typescript
// 5-entities/ai-job/api.ts
import { supabase } from '@shared/api/supabase'
import type { AiJob } from './model'

export interface GenerateQuizPayload {
  title: string
  sourceText?: string
  fileBase64?: string
  fileName?: string
  clarifyingPrompt: string
  questionCount: number
  difficulty: 'easy' | 'medium' | 'hard'
  difficultyPrompt?: string
}

export async function invokeGenerateQuiz(p: GenerateQuizPayload): Promise<{ jobId: string }> {
  // supabase.functions.invoke auto-attaches the logged-in owner's Authorization header.
  const { data, error } = await supabase.functions.invoke('ai-generate-quiz', { body: p })
  if (error) throw error
  return data as { jobId: string }
}

// Recommended polling transport: direct PostgREST read, scoped by owner RLS (012 migration).
export async function fetchAiJob(jobId: string): Promise<AiJob> {
  const { data, error } = await supabase
    .from('ai_jobs')
    .select('id, status, stage, error, quiz_id')
    .eq('id', jobId)
    .single()
  if (error) throw error
  return data as unknown as AiJob
}
```

### `ai-job` entity model
```typescript
// 5-entities/ai-job/model.ts
export type AiJobStatus = 'pending' | 'completed' | 'failed'
export type AiJobStage  = 'reading' | 'generating' | 'saving' | 'done'

export interface AiJob {
  id: string
  status: AiJobStatus
  stage: AiJobStage
  error: string | null
  quiz_id: string | null
}
```

### Stage → Russian copy (D-10 / AI-07) — illustrative; exact copy is Claude's discretion
```typescript
const STAGE_MESSAGES: Record<AiJobStage, string> = {
  reading:    'Читаю материал…',
  generating: 'Составляю вопросы…',
  saving:     'Сохраняю тест…',
  done:       'Готово!',
}
```

### Adding the route
```typescript
// 1-app/router/index.ts — add to the routes array
{ path: '/ai-wizard', component: () => import('@pages/AiWizardPage.vue'), meta: { requiresAuth: true } },
```

### Entry-point buttons (D-02)
- **`/my` page** (`MyQuizListPage.vue`): add a second `<Button>` next to "Создать тест" → `router.push('/ai-wizard')`. Use a `Sparkles`/`Wand2` icon from `lucide-vue-next`.
- **Editor header** (`3-widgets/QuizEditorHeader.vue`): add a `<Button>` in the right-side `flex` group → `router.push('/ai-wizard')`. (Note D-02: even from the editor, the wizard creates a *new* quiz — it does not append to the currently-open one.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Synchronous AI HTTP request | `waitUntil()` background task + poll | Supabase Background Tasks GA | < 200 ms ACK; generation runs on after response (AI-SPEC §4) |
| OpenAI JSON mode | Structured Outputs `strict: true` | OpenAI 2024 | Hard schema-shape guarantee (AI-SPEC §4b) |
| `deno.land/x/` EF imports | `npm:` specifiers | Supabase EF update | Project already standardised on `npm:` (Phase 2) |

**Deprecated/outdated:**
- AI-SPEC §3 pins `openai@4.104.0`, `unpdf@0.12.1`, `unzipit@1.4.3`. Registry latest (2026-05-17) is `openai@6.38.0`, `unpdf@1.6.2`, `unzipit@2.0.1`. The `openai` v4→v6 jump may change the SDK surface (`chat.completions.create` is stable, but `response_format` typings and the `openai/helpers/zod` subpath may differ). See Open Question 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Edge Function pins `openai`/`unpdf`/`unzipit` at versions the planner reconciles with the AI-SPEC. The AI-SPEC pinned older versions than the current registry. | Standard Stack / State of the Art | MEDIUM — `openai` v4→v6 may shift the `response_format` / refusal API. The planner should confirm the AI-SPEC §4 code samples against whichever major is pinned, or accept the AI-SPEC's `@4` pin deliberately. |
| A2 | The phase ships **one** new Edge Function (`ai-generate-quiz`) and polls `ai_jobs` directly via PostgREST — `ai-job-status` is NOT built. | Pattern 2 note | LOW — both work. Direct PostgREST polling is simpler and the SELECT RLS already scopes to the owner. If the planner prefers the AI-SPEC's two-function layout, that is also valid. |
| A3 | base64-in-JSON file transport stays within Supabase's EF request-body limit for a 5 MB file (~6.7 MB encoded). | Pitfall 4 / Open Question 2 | MEDIUM — if the body limit is below ~7 MB, Pro 5 MB uploads fail and a Storage-upload fallback is needed. Verify before locking the transport. |
| A4 | `OPENAI_API_KEY` is (or will be) set as a Supabase **function** secret, not only the Studio AI key in `config.toml`. | Runtime State Inventory | LOW — easily verified with `supabase secrets list`; just a setup step. |
| A5 | The existing `/editor/:id` route + `useQuizEditorStore.loadQuiz()` need **no changes** to display an AI-generated quiz. | Architecture / AI-06 | LOW — `loadQuiz` fetches quiz + questions + options generically; a generated quiz is a normal quiz. Verified against the store source. |

## Open Questions

1. **`openai` SDK version — `@4` (AI-SPEC pin) vs `@6` (registry latest)?**
   - What we know: AI-SPEC §3 deliberately pinned `openai@4.104.0` with code samples written for v4. Registry latest is `6.38.0`.
   - What's unclear: Whether to follow the AI-SPEC's `@4` pin (consistent with its code samples) or upgrade to `@6` (newer, but AI-SPEC samples may need a once-over for `response_format` typing changes).
   - Recommendation: **Follow the AI-SPEC's `@4` pin** unless the planner explicitly re-validates the §4 code on `@6`. The AI-SPEC is the design contract; its samples assume v4. Pin the exact patch at install time. Same reasoning applies to `unpdf`/`unzipit` — prefer the AI-SPEC pins for sample consistency, or re-verify on latest.

2. **Supabase Edge Function request-body size limit vs a 5 MB base64 payload.**
   - What we know: A Pro 5 MB file is ~6.7 MB once base64-encoded in a JSON body. Phase 2 EFs only ever sent small JSON bodies.
   - What's unclear: The exact EF request-body cap for this Supabase plan/version.
   - Recommendation: Verify the limit during planning. If it comfortably exceeds ~7 MB, keep base64-in-JSON. If not, plan a Storage-upload-first fallback for the file path (client uploads to a temp Storage path, EF reads it, deletes it post-extraction). Decide before locking the step-2 transport.

3. **Does a *failed* generation consume the (Phase 5) monthly quota?**
   - What we know: CONTEXT.md Deferred Ideas explicitly flags this as a Phase 5 open question. Phase 3 does not enforce the monthly quota.
   - What's unclear: Quota accounting semantics — out of Phase 3 scope.
   - Recommendation: No Phase 3 action. The `ai_jobs` table (with `status`, `created_at`, `owner_id`) already gives Phase 5 everything it needs to count successful vs failed jobs per month. Note it for Phase 5.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI / local stack | EF deploy, `db push` | ✓ (used through Phase 2) | — | — |
| Deno runtime (Supabase-hosted) | `ai-generate-quiz` EF | ✓ (hosts all Phase 2 EFs) | Supabase-managed | — |
| OpenAI API + `OPENAI_API_KEY` | AI generation | ⚠ key must be set as a function secret | — | None — generation is the phase's core |
| `npm:` registry packages (`openai`/`unpdf`/`unzipit`) | EF deploy | ✓ (resolved at deploy) | see Open Question 1 | — |

**Missing dependencies with no fallback:**
- `OPENAI_API_KEY` as a function secret — if absent, `ai-generate-quiz` cannot call OpenAI. A setup task, not a code blocker. Verify with `supabase secrets list`.

**Missing dependencies with fallback:**
- None.

## Security Domain

> `security_enforcement` is not set in `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Owner JWT via Supabase Auth; `verify_jwt` default true + in-handler `getUser()` (Pattern 1) |
| V3 Session Management | no | No new sessions — owner session is Supabase Auth; the `ai_jobs` row is not a session |
| V4 Access Control | yes | `ai_jobs` owner-only SELECT RLS (`012`); EF re-checks `owner_id === user.id`; `service_role` writes only |
| V5 Input Validation | yes | Zod on the generated JSON (`_shared/quiz-schema.ts`); server-side file-size + count validation (D-06/D-07); reject non-PDF/DOCX MIME |
| V6 Cryptography | no | No hashing/encryption in this phase — no `bcrypt`, no `jose` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Owner reads another owner's `ai_jobs` (IDOR) | Information Disclosure | `owner_read_ai_jobs` RLS `USING (owner_id = (SELECT auth.uid()))`; EF ownership re-check before returning a job |
| Prompt injection inside an uploaded document ("игнорируй инструкции") | Tampering | System/user message-role separation — source text only ever in the user message, never concatenated into the system prompt (AI-SPEC §4b) |
| Unauthenticated quiz generation (cost abuse) | Spoofing / DoS | `verify_jwt` default true; `ai-generate-quiz` rejects missing/invalid `Authorization` |
| Oversized file → memory/DoS | DoS | Plan-aware size check on raw bytes server-side *before* extraction (D-06, constraint #4); text capped at 12k chars |
| Malformed OpenAI output → bad DB insert | Tampering | Structured Outputs `strict` + Zod re-validation gate before any insert (AI-SPEC §4b / §6) |
| OpenAI key leakage | Information Disclosure | Key is a Supabase secret read via `Deno.env.get` — never in client code or responses; generic 500 message on error (`errors.ts`) |
| Generated quiz cross-owner assignment | Tampering | `persistQuiz` sets `owner_id = user.id` from the verified caller (Pitfall 6) |

## Sources

### Primary (HIGH confidence)
- In-repo: `supabase/functions/create-quiz-access/index.ts` — owner-EF auth pattern (verbatim model)
- In-repo: `supabase/functions/_shared/{cors,errors,jwt}.ts` — reusable helpers + the guest-vs-owner distinction
- In-repo: `supabase/migrations/{002,003,007,009}.sql` — table/enum/RLS conventions; next index = `012`
- In-repo: `src/4-features/quiz-editor/model/useQuizEditorStore.ts` — `loadQuiz()` is reused for AI-06
- In-repo: `src/5-entities/quiz-session/api.ts` — `supabase.functions.invoke` wrapper precedent
- In-repo: `src/1-app/router/index.ts` — route + `requiresAuth` guard pattern
- `.planning/phases/03-ai-wizard/03-AI-SPEC.md` — OpenAI call, schema, `waitUntil`, extraction, evals (the design contract)
- `.planning/phases/03-ai-wizard/03-CONTEXT.md` — locked decisions D-01..D-12
- `.planning/STATE.md` — "owner EFs stay out of config.toml; re-verify ownership in-handler"

### Secondary (MEDIUM confidence)
- `npm view` (run 2026-05-17): `openai@6.38.0`, `unpdf@1.6.2`, `unzipit@2.0.1`, `jose@6.2.3` — current registry versions, contradicting the AI-SPEC pins (Open Question 1)
- `.planning/research/{ARCHITECTURE,PITFALLS,STACK}.md` — project-wide patterns and the async-job pitfall

### Tertiary (LOW confidence)
- Supabase EF request-body limit — not verified in this session (Open Question 2 / Assumption A3)

## Metadata

**Confidence breakdown:**
- FSD slice layout & file lists: HIGH — derived directly from existing slice structure and ARCHITECTURE.md
- `ai_jobs` migration + RLS: HIGH — exact mirror of the `007`/`009` conventions
- Owner-EF auth path: HIGH — `create-quiz-access` is a working in-repo template
- Editor redirect (AI-06): HIGH — `loadQuiz()` source verified, generated quiz is a normal quiz
- Polling design: HIGH — PostgREST + owner RLS is straightforward; interval ~2 s per AI-SPEC
- File-upload transport: MEDIUM — base64-in-JSON recommended but the EF body limit is unverified (Open Question 2)
- Package versions: MEDIUM — AI-SPEC pins conflict with current registry (Open Question 1)

**Research date:** 2026-05-17
**Valid until:** 2026-06-16 (stable stack; re-verify `openai` SDK version if the planner runs much later)
