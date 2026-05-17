# Phase 3: AI Wizard - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 18 new / 2 modified
**Analogs found:** 18 / 20 (2 genuinely new — `extract-text.ts`, `openai.ts`)

> Phase 3 is almost entirely *assembly* of patterns the codebase already proves. The owner-EF auth path, the dual-RLS migration, the EF-invocation entity wrappers, the feature-store-drives-everything convention, the file-drop component — all exist in-repo and are cited verbatim below. The only genuinely new mechanics are server-side document text extraction and the OpenAI `waitUntil` call; for those the planner falls back to `03-AI-SPEC.md` §4/§4b.

> **FSD note:** all new frontend files map cleanly onto existing slices and respect import direction (`1-app` → `2-pages` → `3-widgets` → `4-features` → `5-entities` → `6-shared`). No feature-to-feature import is introduced.

---

## File Classification

### New files — Edge Functions / DB (`supabase/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/012_ai_jobs.sql` | migration | n/a (DDL) | `supabase/migrations/002_quizzes.sql` + `007_rls_policies.sql` + `009_phase2_schema.sql` | exact (table+enum+RLS conventions) |
| `supabase/functions/ai-generate-quiz/index.ts` | edge-function (handler) | request-response + event-driven (`waitUntil`) | `supabase/functions/create-quiz-access/index.ts` | exact (owner-auth) / role-match (background task is new) |
| `supabase/functions/ai-generate-quiz/deno.json` | config | n/a | (no in-repo `deno.json` — AI-SPEC §3 template) | no analog (see No Analog Found) |
| `supabase/functions/_shared/quiz-schema.ts` | utility (schema) | transform/validation | `supabase/functions/_shared/errors.ts` (shared-helper layout) | role-match |
| `supabase/functions/_shared/quiz-prompt.ts` | utility (prompt) | transform | `supabase/functions/_shared/errors.ts` (shared-helper layout) | role-match |
| `supabase/functions/_shared/extract-text.ts` | utility (parser) | file-I/O / transform | — | **no analog** (AI-SPEC §4) |
| `supabase/functions/_shared/openai.ts` | service (AI client) | request-response (external API) | — | **no analog** (AI-SPEC §4b) |

> **Planner decision pending (RESEARCH Pattern 2 / Assumption A2):** `ai-job-status` Edge Function is **NOT** in this map — RESEARCH recommends polling `ai_jobs` directly via PostgREST (owner SELECT RLS already scopes it). If the planner keeps the AI-SPEC's two-function layout, `ai-job-status/index.ts` would classify identically to `create-quiz-access` (owner-auth, request-response).

### New files — frontend (`src/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/5-entities/ai-job/model.ts` | model | n/a (types) | `src/5-entities/quiz-session/model.ts` | exact |
| `src/5-entities/ai-job/api.ts` | api-fetcher | request-response + CRUD (poll read) | `src/5-entities/quiz-session/api.ts` + `src/5-entities/quiz/api.ts` | exact (EF-invoke wrapper) + role-match (PostgREST read) |
| `src/4-features/ai-wizard/model/useAiWizardStore.ts` | store (Pinia) | event-driven (polling loop) | `src/4-features/quiz-taking/model/useQuizTakingStore.ts` | exact (state machine + interval + cleanup) |
| `src/4-features/ai-wizard/ui/WizardStepper.vue` | component | n/a (display) | `src/4-features/quiz-editor/ui/PublishToggle.vue` (thin store-bound component) | role-match |
| `src/4-features/ai-wizard/ui/WizardStep1.vue` | component (form step) | request-response | `src/4-features/quiz-editor/ui/QuizMetaForm.vue` | role-match |
| `src/4-features/ai-wizard/ui/WizardStep2.vue` | component (form step) | file-I/O + request-response | `src/4-features/quiz-editor/ui/CoverUpload.vue` | exact (file-drop) |
| `src/4-features/ai-wizard/ui/WizardStep3.vue` | component (form step) | request-response | `src/4-features/quiz-editor/ui/QuizMetaForm.vue` | role-match |
| `src/4-features/ai-wizard/ui/WizardStep4.vue` | component (progress) | event-driven (polled state) | `src/4-features/quiz-editor/ui/CoverUpload.vue` (loading state) | role-match |
| `src/3-widgets/AiWizardWidget.vue` | widget | n/a (composition) | `src/3-widgets/QuizTakingWidget.vue` | exact (status-switch + onMounted/onUnmounted) |
| `src/2-pages/AiWizardPage.vue` | page (assembler) | n/a | `src/2-pages/QuizEditorPage.vue` | exact (thin assembler) |

### Modified files

| Modified File | Role | Data Flow | Change | Closest Analog (for the change) |
|---------------|------|-----------|--------|----------------------------------|
| `src/1-app/router/index.ts` | route config | n/a | add `/ai-wizard` route w/ `requiresAuth` | the existing `/editor/:id` route line (same file) |
| `src/2-pages/MyQuizListPage.vue` | page | n/a | add a 2nd "Создать с ИИ" entry button | the existing "Создать тест" `<Button>` in the same file |
| `src/3-widgets/QuizEditorHeader.vue` | widget | n/a | add an AI entry button (`outline`) | the existing "Ссылки доступа" `<Button>` in the same file |

---

## Pattern Assignments

### `supabase/migrations/012_ai_jobs.sql` (migration)

**Analogs:** `002_quizzes.sql` (table+index conventions), `003_questions_answers.sql` (enum types), `007_rls_policies.sql` (owner-only RLS), `009_phase2_schema.sql` (recent owner-read policy).

**Table + enum + index pattern** — copy the structure of `002_quizzes.sql` lines 2-20 and `003` line 1:
```sql
-- 003_questions_answers.sql:1 — enum type declared before the table
CREATE TYPE question_type AS ENUM ('single', 'multiple');
-- 002_quizzes.sql:2-19 — uuid PK, owner_id FK to profiles ON DELETE CASCADE,
-- timestamptz created_at/updated_at, RLS enabled immediately, index on FK
CREATE TABLE quizzes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  ...
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON quizzes (owner_id);
```
→ `ai_jobs` adds `ai_job_status` + `ai_job_stage` enums, a nullable `quiz_id uuid REFERENCES quizzes ON DELETE SET NULL` (D-03 — null until success), and `error text`. Full DDL is given in RESEARCH Pattern 2.

**Owner-only RLS pattern** — copy `009_phase2_schema.sql` lines 21-25 (the closest *recent* owner-SELECT policy) and the `(SELECT auth.uid())` initPlan rule from `007_rls_policies.sql` lines 2-4:
```sql
-- 009_phase2_schema.sql:21-25 — owner reads only their own rows
CREATE POLICY "owner_read_sessions"
  ON quiz_sessions FOR SELECT TO authenticated
  USING ( quiz_id IN (SELECT id FROM quizzes WHERE owner_id = (SELECT auth.uid())) );
```
→ For `ai_jobs` the predicate is simpler (direct `owner_id`): `USING ( owner_id = (SELECT auth.uid()) )`. **No anon policy** and **no authenticated INSERT/UPDATE policy** — mirror the `007` comments on `quiz_sessions`/`session_answers` (lines 67-73): *"managed by Edge Functions using service_role key"*. Always `(SELECT auth.uid())`, never bare `auth.uid()` (007:2-4).

---

### `supabase/functions/ai-generate-quiz/index.ts` (edge-function, request-response + event-driven)

**Analog:** `supabase/functions/create-quiz-access/index.ts` — the verbatim owner-authenticated EF template.

**Imports + handler shell + CORS preflight** (`create-quiz-access/index.ts` lines 10-13, 25-28):
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { GENERIC_500_MESSAGE, serializeError } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try { /* ... */ }
})
```
→ Add the new pinned imports (`openai`, `zod`, `unpdf`, `unzipit`) per AI-SPEC §3. **Do NOT import `_shared/jwt.ts`** — that is the *guest* helper (RESEARCH Pitfall 1).

**Owner-auth pattern** (`create-quiz-access/index.ts` lines 31-63) — copy verbatim:
```typescript
const authHeader = req.headers.get('Authorization')
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const token = authHeader.replace('Bearer ', '')
const { data: { user }, error: userError } = await supabase.auth.getUser(token)
if (userError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
// user.id is the owner — service_role bypasses RLS (see Pitfall 6).
```

**Error handling pattern** (`create-quiz-access/index.ts` lines 118-126) — copy verbatim:
```typescript
} catch (err) {
  console.error('ai-generate-quiz error:', serializeError(err))
  return new Response(JSON.stringify({ error: GENERIC_500_MESSAGE }), {
    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
```

**NEW — background task pattern (no in-repo analog).** Insert the `ai_jobs` row, then `EdgeRuntime.waitUntil(runGeneration(...))`, then return `202 { jobId }`. The `runGeneration` background function advances `ai_jobs.stage` and finally sets `status`/`quiz_id`. Full reference: **AI-SPEC §4 "Core Pattern"** (the `Deno.serve` + `runGeneration` code blocks). Pitfalls: never `await` the `waitUntil` promise; never omit it (AI-SPEC §4 Pitfall 4 / RESEARCH Pitfall 2).

**Persist pattern** — `persistQuiz()` inserts into `quizzes`/`questions`/`answer_options` via `service_role`. Re-index `order_index` deterministically before insert — mirror `useQuizEditorStore.ts` lines 151 & 159 (`forEach((x, i) => x.order_index = i)`). `quizzes.owner_id` MUST be set to `user.id` (RESEARCH Pitfall 6). DB column shapes are in `002`/`003` migrations.

---

### `supabase/functions/_shared/quiz-schema.ts` & `quiz-prompt.ts` (utility)

**Analog:** `supabase/functions/_shared/errors.ts` — for the *shared-helper file layout only* (a `_shared/` `.ts` exporting named consts/functions, leading comment block explaining intent and the "never leak to client" discipline).

**Content has no in-repo analog** — both files are specified verbatim in **AI-SPEC §4** (`QUIZ_JSON_SCHEMA`), **§4b** (`QuizSchema` Zod + `.refine()`), and **§4b "Prompt Engineering Discipline"** (`SYSTEM_PROMPT`, `buildUserPrompt`). The planner copies those AI-SPEC code blocks directly.

---

### `supabase/functions/_shared/extract-text.ts` (utility, file-I/O) — NO ANALOG

PDF via `unpdf`, DOCX via `unzipit`. No in-repo precedent. Reference: **AI-SPEC §4 "Tool Use"**. Enforce the plan-aware byte-size limit *before* extraction; cap recovered text at ~12k chars (AI-SPEC §4 / RESEARCH Pitfall 4).

---

### `supabase/functions/_shared/openai.ts` (service) — NO ANALOG

`generateQuiz()` wrapper with the D-11 single retry. No in-repo precedent. Reference: **AI-SPEC §4b "Retry logic (D-11)"** — the `generateQuiz()` for-loop, refusal/`finish_reason`/count checks, `serializeError` logging. Reuse `_shared/errors.ts` `serializeError` for the per-attempt `console.error`.

---

### `src/5-entities/ai-job/model.ts` (model)

**Analog:** `src/5-entities/quiz-session/model.ts` — plain `export interface` + supporting union types, leading comment, no logic.
```typescript
// quiz-session/model.ts pattern: a domain interface + a result-shape interface
export interface QuizSession { id: string; quiz_id: string; ... }
export interface SessionResult { score: number; ... }
```
→ `ai-job/model.ts` exports `AiJobStatus`/`AiJobStage` string-literal union types + the `AiJob` interface (exact shape in RESEARCH "Code Examples — `ai-job` entity model").

---

### `src/5-entities/ai-job/api.ts` (api-fetcher, request-response + CRUD)

**Analogs:** `src/5-entities/quiz-session/api.ts` (EF-invoke wrapper) + `src/5-entities/quiz/api.ts` (PostgREST read).

**EF-invocation wrapper pattern** (`quiz-session/api.ts` lines 1-7, 58-68) — copy:
```typescript
import { supabase } from '@shared/api/supabase'
// ...
export async function invokeVerifyAccess(token, login, password): Promise<VerifyAccessResponse> {
  const { data, error } = await supabase.functions.invoke('verify-quiz-access', {
    body: { token, login, password },
  })
  if (error) throw error
  return data as VerifyAccessResponse
}
```
→ `invokeGenerateQuiz(payload)` follows this exactly. `supabase.functions.invoke` auto-attaches the owner's `Authorization` header — no manual token handling (RESEARCH Pattern 1). Payload interface `GenerateQuizPayload` is in RESEARCH "Code Examples".

**PostgREST single-row read pattern** (`quiz/api.ts` lines 27-35 `fetchQuiz`) — copy for `fetchAiJob`:
```typescript
export async function fetchQuiz(id: string): Promise<Quiz> {
  const { data, error } = await supabase
    .from('quizzes').select('*').eq('id', id).single()
  if (error) throw error
  return data as unknown as Quiz
}
```
→ `fetchAiJob(jobId)` selects `id, status, stage, error, quiz_id` from `ai_jobs` — owner SELECT RLS (migration `012`) scopes the read. This is the recommended polling transport (RESEARCH Pattern 2 note).

---

### `src/4-features/ai-wizard/model/useAiWizardStore.ts` (Pinia store, event-driven)

**Analog:** `src/4-features/quiz-taking/model/useQuizTakingStore.ts` — the closest match: a composition-API store with a state machine, a `setInterval` loop, server-anchored polling, and explicit teardown.

**Store skeleton + imports** (`useQuizTakingStore.ts` lines 1-16, 27) — copy the shape:
```typescript
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { useRouter } from 'vue-router'
// FSD: 4-features imports 5-entities/6-shared only (see useQuizShareStore.ts:1-3)
import { invokeGenerateQuiz, fetchAiJob } from '@entities/ai-job/api'
import type { AiJobStage } from '@entities/ai-job/model'

export const useAiWizardStore = defineStore('ai-wizard', () => { /* ... */ })
```

**Interval lifecycle pattern** (`useQuizTakingStore.ts` lines 59, 152-193, 591-593) — copy the `let timerInterval`/`stopTimer()`/`cleanup()` discipline for the poll loop:
```typescript
let timerInterval: ReturnType<typeof setInterval> | null = null
function stopTimer(): void {
  if (timerInterval !== null) { clearInterval(timerInterval); timerInterval = null }
}
function cleanup(): void { stopTimer() }   // called from the widget's onUnmounted
```
→ `startPolling()` opens a `~2s setInterval` calling `fetchAiJob`; `stopPolling()` clears it on `completed`/`failed` AND on `cleanup()`/`retry()` (RESEARCH Pitfall 3). Full store sketch (step/form refs, `startGeneration`, `retry`) is in RESEARCH Pattern 3.

**State-machine + router-push pattern** (`useQuizTakingStore.ts` lines 25, 533-535) — the `finishSession` redirect is the model for the AI-06 redirect:
```typescript
result.value = res
sessionStatus.value = 'finished'
await router.push(`/q/${token.value}/result`)
```
→ On `status === 'completed'`: `router.push('/editor/' + job.quiz_id)`.

**Error handling pattern** (`useQuizShareStore.ts` lines 18-27, the canonical feature-store try/catch) — every async action wraps in `try/catch` → `toast.error(<Russian message>)`. The step-4 *generation* failure is in-page (D-11), not a toast — see UI-SPEC "Error state".

---

### `src/4-features/ai-wizard/ui/WizardStep2.vue` (component, file-I/O)

**Analog:** `src/4-features/quiz-editor/ui/CoverUpload.vue` — exact file-drop match (UI-SPEC explicitly says "reusing the `CoverUpload.vue` visual exactly").

**File-drop zone pattern** (`CoverUpload.vue` lines 1-28, 74-88) — copy:
```typescript
const fileInput = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
function openPicker() { fileInput.value?.click() }
function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) store.<handler>(file)
  (e.target as HTMLInputElement).value = ''
}
function onDrop(e: DragEvent) {
  e.preventDefault(); isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) store.<handler>(file)
}
```
```vue
<input ref="fileInput" type="file" accept="..." class="hidden" @change="onFileChange">
<div class="flex h-48 w-full ... rounded-lg border-2 border-dashed bg-neutral-900 transition-colors"
     :class="isDragOver ? 'border-orange-500 bg-orange-500/15' : 'border-neutral-700'"
     @click="openPicker" @dragover.prevent="isDragOver = true"
     @dragleave.prevent="isDragOver = false" @drop="onDrop">
```
→ Changes per UI-SPEC: `accept` becomes PDF/DOCX MIME; icon `ImagePlus` → `FileUp`; copy from UI-SPEC "Step 2" table. The `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` toggle (D-04) and the clarifying-prompt textarea use `src/6-shared/ui/` components verbatim.

---

### `src/4-features/ai-wizard/ui/WizardStep4.vue` (component, event-driven)

**Analog:** `CoverUpload.vue` lines 67-72 — the loading state is the model for the stage spinner.
```vue
<div class="flex h-48 w-full flex-col items-center justify-center rounded-lg ... bg-neutral-900">
  <Loader2 class="h-8 w-8 animate-spin text-neutral-500" />
  <span class="mt-1 text-sm text-neutral-500">Загружается...</span>
</div>
```
→ Per UI-SPEC "Step 4 arrangement": `Loader2` tinted `text-orange-500`, the live stage line is `text-2xl` semibold reading `store.currentStage` → Russian copy (UI-SPEC stage table). Failure state swaps `Loader2` for `AlertTriangle` (`text-red-400`) + the two recovery buttons. No `ProgressBar.vue` (D-10).

---

### `src/4-features/ai-wizard/ui/WizardStep1.vue` & `WizardStep3.vue` (components, form steps)

**Analog:** `src/4-features/quiz-editor/ui/QuizMetaForm.vue` — title input + numeric field pattern (the editor's title field is the model for step 1, its time-limit field for step 3's count). Use `Input.vue` from `6-shared/ui` verbatim (`h-9`, orange focus ring). Step 3's difficulty 3-segment control reuses `TabsList`/`TabsTrigger` styling (UI-SPEC "Step 3 arrangement"). Field labels/helpers/validation copy: UI-SPEC "Step 1" / "Step 3" tables.

---

### `src/4-features/ai-wizard/ui/WizardStepper.vue` (component)

**Analog:** `src/4-features/quiz-editor/ui/PublishToggle.vue` — a thin store-bound display component (no in-repo stepper exists). Marker states / connector colors / labels are fully prescribed in UI-SPEC "Stepper" — implement as written. Steps are NOT clickable to jump forward.

---

### `src/3-widgets/AiWizardWidget.vue` (widget)

**Analog:** `src/3-widgets/QuizTakingWidget.vue` — exact match: a widget that owns the feature store, switches rendered content by store status, and wires `onMounted`/`onUnmounted`.

**Mount/unmount + status-switch pattern** (`QuizTakingWidget.vue` lines 2, 14-27, 62-126):
```typescript
import { onMounted, onUnmounted } from 'vue'
const store = useQuizTakingStore()
onMounted(() => { void store.init(token) })
onUnmounted(() => { store.cleanup() })   // tears down the interval — Pitfall 3
```
```vue
<QuizIntroScreen v-if="store.sessionStatus === 'idle'" />
<GracefulState v-else-if="store.sessionStatus === 'invalid'" ... />
<div v-else-if="store.sessionStatus === 'active'"> ... </div>
```
→ `AiWizardWidget` renders `WizardStepper` + the active `WizardStepN` by `store.step`; `onUnmounted` calls `store.cleanup()`. D-12 `onBeforeRouteLeave` + `beforeunload` guards live here or on the page (RESEARCH Pitfall 7).

**Layout** — UI-SPEC "Wizard shell" prescribes the `auto 1fr auto` grid at `100dvh`; `QuizTakingWidget.vue` lines 128-141 (`.taking-layout` `grid-template-rows: auto 1fr; height: 100dvh`) is the in-repo grid analog.

---

### `src/2-pages/AiWizardPage.vue` (page, assembler)

**Analog:** `src/2-pages/QuizEditorPage.vue` — a thin (~25-line) page that reads route params and mounts a widget.
```vue
<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppHeader from '@widgets/AppHeader.vue'
import QuizEditorWidget from '@widgets/QuizEditorWidget.vue'
const route = useRoute()
const quizId = route.params.id as string
</script>
```
→ `AiWizardPage.vue` mounts `AiWizardWidget`. No route param needed (D-02 — the wizard always creates a new quiz). Keep it a thin assembler (CLAUDE.md: pages ≤ ~80 lines, no domain logic).

---

### `src/1-app/router/index.ts` (modified — add route)

**Analog:** the existing `/editor/:id` line in the same file (line 20).
```typescript
{ path: '/editor/:id', component: () => import('@pages/QuizEditorPage.vue'), meta: { requiresAuth: true } },
```
→ Add: `{ path: '/ai-wizard', component: () => import('@pages/AiWizardPage.vue'), meta: { requiresAuth: true } }`. The existing `beforeEach` guard (lines 27-34) already handles `requiresAuth` + `returnUrl` — no guard change needed.

---

### `src/2-pages/MyQuizListPage.vue` (modified — add entry button)

**Analog:** the existing "Создать тест" `<Button>` in the same file (lines 61-68).
```vue
<Button v-if="quizzes.length > 0" @click="handleCreate">
  <Plus class="h-4 w-4" />
  Создать тест
</Button>
```
→ Add a second `<Button>` next to it: copy "Создать с ИИ", icon `Sparkles`, `variant="default"`, `@click="router.push('/ai-wizard')"`, wrapped in `Tooltip` (UI-SPEC "Entry-point buttons"). Note `EmptyState.vue` is also rendered for the zero-quiz case — the planner decides whether the AI entry also appears there.

---

### `src/3-widgets/QuizEditorHeader.vue` (modified — add entry button)

**Analog:** the existing "Ссылки доступа" `<Button>` in the same file (lines 31-39), inside the right-side `flex items-center gap-3` group.
```vue
<div class="ml-auto flex items-center gap-3">
  <Button v-if="editorStore.quiz" variant="default" size="sm" @click="modalOpen = true">
    <Link class="h-4 w-4" />
    Ссылки доступа
  </Button>
  <PublishToggle />
</div>
```
→ Add an AI `<Button>` to this group: copy "Создать с ИИ", icon `Sparkles`, **`variant="outline"`** (UI-SPEC: keep it outline so two orange buttons don't compete), `@click="router.push('/ai-wizard')"`, wrapped in `Tooltip`. D-02: even from the editor it creates a *new* quiz — do not pass the current quiz id.

---

## Shared Patterns

### Owner-authenticated Edge Function
**Source:** `supabase/functions/create-quiz-access/index.ts` lines 31-63.
**Apply to:** `ai-generate-quiz/index.ts` (and `ai-job-status` if the planner keeps it).
```typescript
const authHeader = req.headers.get('Authorization')
if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization header' }),
  { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const { data: { user }, error: userError } =
  await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }),
  { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
```
EFs stay **out of `config.toml`** so `verify_jwt` defaults to `true` (STATE.md decision). `service_role` bypasses RLS — re-check ownership in-handler. **Never** use `_shared/jwt.ts` here (that is the guest helper — RESEARCH Pitfall 1).

### CORS preflight + headers
**Source:** `supabase/functions/_shared/cors.ts` + `create-quiz-access/index.ts` lines 26-28.
**Apply to:** every new Edge Function — `import { corsHeaders }`, handle `req.method === 'OPTIONS'` first, spread `...corsHeaders` into every `Response`.

### Generic-500 error handling (Edge Functions)
**Source:** `supabase/functions/_shared/errors.ts` + `create-quiz-access/index.ts` lines 118-126.
**Apply to:** every new Edge Function's outer `catch` — `console.error('<fn>:', serializeError(err))` server-side, return `GENERIC_500_MESSAGE` to the client. Also used per-attempt inside `_shared/openai.ts` `generateQuiz()`.

### Feature-store try/catch → toast.error
**Source:** `src/4-features/quiz-share/model/useQuizShareStore.ts` lines 18-27 (and every action in `useQuizEditorStore.ts`).
**Apply to:** every async action in `useAiWizardStore.ts`.
```typescript
try { /* ... */ }
catch { toast.error('<Russian message>') }
finally { isLoading.value = false }
```
Exception: the step-4 *generation* failure is rendered in-page with a recovery action (D-11 / UI-SPEC), not as a toast.

### EF-invocation entity wrapper
**Source:** `src/5-entities/quiz-session/api.ts` lines 58-68.
**Apply to:** `src/5-entities/ai-job/api.ts` `invokeGenerateQuiz()`.
```typescript
const { data, error } = await supabase.functions.invoke('<fn-name>', { body: payload })
if (error) throw error
return data as <ResponseType>
```
FSD: components/stores never call `supabase.functions.invoke` directly — go through the entity `api.ts` (RESEARCH Anti-Patterns).

### Interval lifecycle (setInterval + teardown)
**Source:** `src/4-features/quiz-taking/model/useQuizTakingStore.ts` lines 59, 152-161, 591-593.
**Apply to:** the `useAiWizardStore` poll loop. A module-scoped `let pollTimer`; `stopPolling()` clears it; the widget's `onUnmounted` calls `store.cleanup()` → `stopPolling()`. Clear on `completed`, on `failed`, and on `retry()` (RESEARCH Pitfall 3).

### `order_index` re-indexing on write
**Source:** `src/4-features/quiz-editor/model/useQuizEditorStore.ts` lines 151 & 159 (`forEach((q, i) => q.order_index = i)`).
**Apply to:** `persistQuiz()` in `ai-generate-quiz` — re-index `questions[]` and each `answers[]` array `0..n-1` before insert. The model's `order_index` is not a guaranteed clean sequence (AI-SPEC §4 Pitfall 6 / RESEARCH Pitfall 5).

### Owner-only dual-RLS (no anon, service_role writes)
**Source:** `supabase/migrations/007_rls_policies.sql` lines 2-4, 67-73 + `009_phase2_schema.sql` lines 21-25.
**Apply to:** `012_ai_jobs.sql` — one `owner_read_ai_jobs` SELECT policy with `(SELECT auth.uid())`; no anon policy; no authenticated write policy (all writes are `service_role` from the EF).

---

## No Analog Found

Files with no close match in the codebase (planner uses AI-SPEC / RESEARCH patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/functions/_shared/extract-text.ts` | utility | file-I/O | No PDF/DOCX parsing exists anywhere in the repo. Reference: AI-SPEC §4 "Tool Use" (`unpdf` + `unzipit`). |
| `supabase/functions/_shared/openai.ts` | service | external API request-response | No OpenAI / external-AI integration exists yet. Reference: AI-SPEC §4b "Retry logic (D-11)". |
| `supabase/functions/ai-generate-quiz/deno.json` | config | n/a | No Phase 2 Edge Function ships a per-function `deno.json` import map. Reference: AI-SPEC §3 template (planner must reconcile the version pin per RESEARCH Open Question 1). |

Partially-new mechanics within files that *do* have an analog:
- The `EdgeRuntime.waitUntil()` background task inside `ai-generate-quiz/index.ts` — the *handler shell* and *auth* are copied from `create-quiz-access`, but `waitUntil` itself has no in-repo precedent → AI-SPEC §4 "Core Pattern".
- The `WizardStepper.vue` numbered-marker UI — no stepper exists in the repo → UI-SPEC "Stepper" is fully prescriptive.

---

## Metadata

**Analog search scope:** `supabase/functions/` (8 functions + `_shared/`), `supabase/migrations/` (001-011), `src/2-pages/`, `src/3-widgets/`, `src/4-features/` (auth, quiz-editor, quiz-list, quiz-share, quiz-taking), `src/5-entities/` (quiz, question, answer-option, quiz-access, quiz-session), `src/1-app/router/`.
**Files scanned:** ~22 (read in full or targeted).
**Pattern extraction date:** 2026-05-17
