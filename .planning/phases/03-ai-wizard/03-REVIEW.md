---
phase: 03-ai-wizard
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - supabase/migrations/012_ai_jobs.sql
  - supabase/functions/_shared/quiz-schema.ts
  - supabase/functions/_shared/quiz-prompt.ts
  - supabase/functions/_shared/extract-text.ts
  - supabase/functions/_shared/openai.ts
  - supabase/functions/ai-generate-quiz/index.ts
  - supabase/functions/ai-generate-quiz/deno.json
  - src/5-entities/ai-job/model.ts
  - src/5-entities/ai-job/api.ts
  - src/6-shared/lib/file.ts
  - src/6-shared/lib/format.ts
  - src/4-features/ai-wizard/model/useAiWizardStore.ts
  - src/4-features/ai-wizard/ui/WizardStep1.vue
  - src/4-features/ai-wizard/ui/WizardStep2.vue
  - src/4-features/ai-wizard/ui/WizardStep3.vue
  - src/4-features/ai-wizard/ui/WizardStep4.vue
  - src/4-features/ai-wizard/ui/WizardStepper.vue
  - src/3-widgets/AiWizardWidget.vue
  - src/2-pages/AiWizardPage.vue
  - src/1-app/router/index.ts
  - src/2-pages/MyQuizListPage.vue
  - src/3-widgets/QuizEditorHeader.vue
  - src/4-features/quiz-list/ui/EmptyState.vue
  - evals/quiz-schema.eval.test.ts
  - evals/promptfooconfig.yaml
findings:
  critical: 2
  warning: 9
  info: 6
  total: 17
  critical_open: 0
  warning_open: 0
  info_open: 0
status: resolved
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Reviewed the AI Wizard slice: the `ai-generate-quiz` Edge Function pipeline (auth, plan
limits, text extraction, OpenAI call, persistence), the `ai_jobs` migration, the Pinia
wizard store with its poll loop, the 4-step wizard UI, and the eval harness.

The security-sensitive parts mostly hold up: OpenAI is only called server-side, RLS on
`ai_jobs` restricts SELECT to the owner, `owner_id` is taken from the verified JWT, and
prompt-injection is mitigated by role separation plus an explicit "ignore instructions"
rule. However there are two correctness defects that will surface in production: a
**difficulty enum mismatch** that makes the difficulty slider a no-op, and a **memory /
size limit gap** on base64 file uploads that lets a Free user bypass the 1 MB cap.
Several robustness gaps (orphaned jobs, no answer-array length cap, count-input edge
cases) round out the warnings.

No structural pre-pass (`<structural_findings>`) was provided, so all findings below are
narrative.

## Resolution (2026-05-17)

All 17 findings (2 Critical, 9 Warning, 6 Info) have been fixed and committed.

| Finding | Commit |
|---------|--------|
| CR-01 | `801e6cd` |
| CR-02 | `cd73bd1` |
| WR-01 | `3ee6471` |
| WR-02 / WR-03 | `0e1bf13`, `adcb8e5` |
| WR-04 | `051450e` |
| WR-05 | `ec3e191` |
| WR-06 | `0904b1c` |
| WR-07 | `ca8b9f1` |
| WR-08 | `50496c4` |
| WR-09 | `6ad6f2f` |
| IN-01 | `b465cd1` |
| IN-02 | `5ec7249` |
| IN-03 | `500c7ba` |
| IN-04 | `cfccba9` |
| IN-05 | `f1476f6` |
| IN-06 | `30eb6ad` |

Post-fix verification: `vitest` 102 passed, `vue-tsc` clean, `steiger` clean, `npm run build` clean.
Note: the Edge Function fixes (CR-01/CR-02/WR-04/WR-05/WR-06/WR-07) require
`npx supabase functions deploy ai-generate-quiz` to take effect in production.

## Critical Issues

### CR-01: Difficulty enum mismatch — slider is a silent no-op

**File:** `src/5-entities/ai-job/api.ts:19`, `supabase/functions/_shared/quiz-prompt.ts:24-28`, `supabase/functions/ai-generate-quiz/index.ts:289`
**Issue:** The client sends `difficulty` as `'easy' | 'medium' | 'hard'` (`GenerateQuizPayload`
in `api.ts`, and `useAiWizardStore` `Difficulty` type). The Edge Function passes that
string straight through to `buildUserPrompt`, which looks it up in `DIFFICULTY_INSTRUCTIONS`
keyed by the Russian strings `'лёгкий' | 'средний' | 'сложный'`. The lookup
`DIFFICULTY_INSTRUCTIONS[p.difficulty]` therefore **always misses** and falls back to
`?? p.difficulty`, so the prompt line becomes literally `Уровень сложности: medium — medium`.
The cognitive-level instruction (the whole point of D-08) never reaches the model. The
difficulty control silently does nothing. This is a functional-requirement failure, not a
cosmetic one — AI-SPEC §4b explicitly requires "the slider must demonstrably move the
cognitive register."
**Fix:** Normalize on one side. Map the English enum to Russian in the EF before calling
`buildUserPrompt`, e.g.:
```ts
const DIFFICULTY_RU: Record<string, string> = {
  easy: 'лёгкий', medium: 'средний', hard: 'сложный',
}
// ...in runGeneration / handler:
difficulty: DIFFICULTY_RU[String(difficulty)] ?? 'средний',
```
or rekey `DIFFICULTY_INSTRUCTIONS` to `easy/medium/hard`. Add a fixture to the eval set
that asserts the difficulty instruction text actually appears in the built prompt.

### CR-02: Plan file-size limit is bypassable — limit checked on file bytes, not the base64 payload that is actually transmitted and held in memory

**File:** `supabase/functions/_shared/extract-text.ts:88-100`, `supabase/functions/ai-generate-quiz/index.ts:240-262`
**Issue:** The D-06 size guard runs on `bytes.byteLength` *after* `base64ToBytes` decodes
the payload. But the request body the EF receives and buffers via `await req.json()` is the
**base64 string**, which is ~33% larger than the decoded file. A Free user can therefore
submit a request whose JSON body is ~1.33 MB+ (decoded 1 MB) — and there is no guard on the
raw request size at all. A malicious client can paste an arbitrary-length `fileBase64`
string: `req.json()` will buffer the entire thing into memory *before* any size check
runs, and `base64ToBytes` then builds a second full-size `Uint8Array` from it. There is no
upper bound on the request body, so this is an unauthenticated-shaped (well, authenticated
but cheap) memory-pressure / cost vector against the Edge Function, and it defeats the
intent of constraint #4 ("Freemium limits enforced at Edge Function level"). The same gap
applies to `sourceText` — an owner can paste a 50 MB string and the EF will buffer it; only
`extractDocumentText` caps text, and `sourceText` bypasses extraction entirely (line 263:
`source = sourceText` with no length check).
**Fix:** Guard the base64 string length *before* decoding, and cap raw `sourceText`:
```ts
// reject obviously oversized payloads before atob()
const maxB64 = Math.ceil(limits.maxFileBytes * 1.37) // base64 overhead + padding
if (typeof fileBase64 === 'string' && fileBase64.length > maxB64) {
  return json({ error: 'FILE_TOO_LARGE' }, 400)
}
// cap pasted source text too
if (source.length > MAX_SOURCE_CHARS) source = source.slice(0, MAX_SOURCE_CHARS)
```
Ideally also enforce a hard `Content-Length` ceiling at the top of the handler before
`req.json()`.

## Warnings

### WR-01: Orphaned `ai_jobs` row when `req.json()` body is well-formed but generation input is invalid downstream

**File:** `supabase/functions/ai-generate-quiz/index.ts:269-296`
**Issue:** The `ai_jobs` row is inserted (status `pending`, stage `reading`) and then
`runGeneration` is handed to `EdgeRuntime.waitUntil`. If the Edge Function instance is
evicted/recycled before the background task finishes (Edge runtime can kill the isolate),
the job is stuck at `pending`/`reading` forever. The owner's poll loop in `useAiWizardStore`
(`startPolling`) only stops on `completed` or `failed` — a permanently-`pending` job means
the wizard spins indefinitely with "Изучаю материал…" and no failure UI, no timeout. There
is no `created_at`-based staleness sweep or client-side poll timeout.
**Fix:** Add a client-side poll deadline (e.g. fail the wizard after ~90s of polling with no
terminal status), and/or a DB-side cron that marks `pending` jobs older than N minutes as
`failed`. At minimum the store's `startPolling` should track elapsed time and transition to
`failed` past a hard cap.

### WR-02: Question-count input accepts non-integer / negative values that desync UI validation from EF validation

**File:** `src/4-features/ai-wizard/ui/WizardStep3.vue:23-26`, `src/4-features/ai-wizard/model/useAiWizardStore.ts:94`
**Issue:** `onCountInput` does `Number.isFinite(n) ? Math.trunc(n) : 0`. Entering a blank or
non-numeric value sets `questionCount` to `0`; `isStepValid` (case 3) then returns false,
which is fine. But a value like `0` or a negative trunc passes `Math.trunc` and is stored.
The store's `isStepValid` checks `>= 1`, but the EF (`index.ts:225`) re-checks
`Number.isInteger(count) && count >= 1`. The real risk: `<input type="number">` allows the
user to type `1e3` or paste `10.5`; `Math.trunc(10.5)` → `10` silently, and `1e3` → `1000`
which exceeds the Free cap and is only caught server-side as a 400 — but `startGeneration`'s
catch (`useAiWizardStore.ts:130-134`) swallows *all* errors into a generic `failed` state
with no message, so the user sees "Не удалось сгенерировать тест" with zero indication that
the real cause is "too many questions for your plan." UX-correctable 400s are indistinguishable
from genuine AI failures.
**Fix:** Surface the EF's 400 `error` string. In `startGeneration`'s catch, inspect the
error payload; for `QUESTION_COUNT_EXCEEDED` / `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE`
show a specific, correctable message (and ideally return the user to step 2/3) instead of
the generic AI-failure card.

### WR-03: All errors in `startGeneration` collapse to a generic failure with no diagnostics

**File:** `src/4-features/ai-wizard/model/useAiWizardStore.ts:130-134`
**Issue:** `catch { generationStatus.value = 'failed' }` discards the error entirely — no
`console.error`, no error code retained. A network failure, an auth expiry, an over-plan
400, and a genuine OpenAI failure all render the same dead-end card. This makes production
incidents undebuggable from the client side and (per WR-02) hides user-correctable problems.
**Fix:** At minimum `console.error(err)` for diagnostics; retain the error so step 4 can
branch its message. Pair with WR-02.

### WR-04: `extractDocxText` strips tags with a regex that is fragile against XML comments / CDATA

**File:** `supabase/functions/_shared/extract-text.ts:60-70`
**Issue:** Tag stripping is `replace(/<[^>]+>/g, '')`. A DOCX `word/document.xml` containing
an XML comment (`<!-- ... -->`) or a `<![CDATA[ ... ]]>` section, or any literal `>` inside
an attribute value, will be mis-handled — `<[^>]+>` stops at the first `>`, so a `>` inside
an attribute leaves a dangling fragment, and comment bodies leak into the extracted text.
Also `&amp;` is replaced *after* the other entities, but `&lt;`→`<` could in principle
re-introduce a `<` that a later pass no longer strips (order is actually safe here since
tag-strip runs first, but the entity-decode set is incomplete — numeric entities `&#1090;`
common in Cyrillic DOCX are not decoded and will appear literally in the prompt).
**Fix:** Decode numeric/hex HTML entities (`&#\d+;`, `&#x[0-9a-f]+;`) as well, and strip
`<!--...-->` and `<![CDATA[...]]>` explicitly before the generic tag strip. A small
dedicated XML-text extractor is more robust than chained `replace` calls.

### WR-05: Zod schema allows 2-answer questions but the prompt and JSON schema disagree on the answer-count contract

**File:** `supabase/functions/_shared/quiz-schema.ts:67`, `supabase/functions/_shared/quiz-prompt.ts:17`
**Issue:** `QuestionSchema.answers` is `z.array(AnswerSchema).min(2).max(8)`. The system
prompt instructs "Каждый вопрос имеет 3–5 вариантов ответа." The `QUIZ_JSON_SCHEMA` puts no
`minItems`/`maxItems` on `answers` at all. Three different answer-count contracts across
three layers. A model that returns a 2-option question passes Zod but violates the stated
prompt rule; a 6–8 option question passes Zod but violates the prompt. The eval gate
(`quiz-schema.eval.test.ts`) only checks D1-D3, so this drift is never caught.
**Fix:** Pick one contract (prompt says 3–5). Set `QuestionSchema.answers` to `.min(3).max(5)`
and add `minItems: 3, maxItems: 5` to `QUIZ_JSON_SCHEMA.questions.items.properties.answers`
so the model is constrained at decode time. Keep all three layers in sync.

### WR-06: `time_limit_sec` from the model is persisted unbounded — a malicious/garbage value reaches the quizzes row

**File:** `supabase/functions/_shared/quiz-schema.ts:82`, `supabase/functions/ai-generate-quiz/index.ts:64`
**Issue:** `QuizSchema` validates `time_limit_sec` as `z.number().int().positive().nullable()`
— no upper bound. The model could emit `time_limit_sec: 999999999` and it would be persisted
verbatim into `quizzes.time_limit_sec`. While the prompt doesn't ask for a time limit, the
strict JSON schema *requires* the field, so the model will emit *something*. An absurd value
will surface later in the quiz-taker timer (Phase 2 timer drift logic) as a multi-year
countdown.
**Fix:** Cap it: `z.number().int().positive().max(86_400).nullable()` (or whatever the
editor's own limit is), and consider defaulting AI-generated quizzes to `null` (no limit)
regardless of model output, since the wizard never asks the owner for a time limit.

### WR-07: `persistQuiz` writes across three tables with no transaction — a partial failure leaves an inconsistent quiz

**File:** `supabase/functions/ai-generate-quiz/index.ts:53-111`
**Issue:** `persistQuiz` does three separate PostgREST inserts: `quizzes`, then `questions`,
then `answer_options`. If the `answer_options` insert fails (line 107-108), the function
throws — `runGeneration`'s catch marks the job `failed` — but the `quizzes` row and its
`questions` rows are already committed. The user gets a `failed` job, yet an orphan,
answerless quiz now exists in their `/my` list. D-03 explicitly says "the quizzes row is
created ONLY after a successful generation"; a partial persist violates that invariant.
**Fix:** Wrap the three inserts in a Postgres function (RPC) so they commit atomically, or
on any persist error explicitly delete the just-created `quizzes` row (cascade removes
questions/answers) before re-throwing.

### WR-08: `fetchAiJob` defeats type safety with a hand-rolled cast chain instead of a typed client

**File:** `src/5-entities/ai-job/api.ts:46-60`
**Issue:** The `supabase as unknown as { from: ... }` cast manually re-declares a sliver of
the PostgREST builder interface. This is `as unknown as` (the most dangerous cast) and the
re-declared shape will silently rot if the Supabase SDK builder signature changes — there is
no compile-time link to reality. `data` is then cast `as AiJob` with no runtime validation,
so a schema drift (e.g. `stage` enum gains a value) is undetected. The comment says
`ai_jobs` "is not yet in `database.types.ts`" — the correct fix is to regenerate the types.
**Fix:** Regenerate `database.types.ts` to include `ai_jobs` (migration 012 exists), then
use the normally-typed client. If a stopgap is truly needed, narrow with a single
`@ts-expect-error` on the `.from('ai_jobs')` call rather than re-declaring the whole builder,
and validate the returned row with a small Zod schema before `as AiJob`.

### WR-09: Poll loop can overlap requests — `setInterval` does not wait for the previous async tick

**File:** `src/4-features/ai-wizard/model/useAiWizardStore.ts:139-154`
**Issue:** `startPolling` uses `setInterval` with an `async` callback. If a `fetchAiJob`
call takes longer than `POLL_INTERVAL_MS` (2s) — plausible on a slow connection — a second
poll fires before the first resolves, and they can race. A late-resolving stale poll can
also overwrite `currentStage` *after* the job already completed (if `stopPolling` ran
between the fetch dispatch and its resolution), briefly reverting the UI stage. Minor, but
it is a real ordering bug.
**Fix:** Use a self-scheduling `setTimeout` recursion that schedules the next tick only
after the current `fetchAiJob` resolves, and guard against applying results after
`stopPolling` (check a generation token / that `pollTimer` still corresponds to this run).

## Info

### IN-01: `loadPlan()` fire-and-forget at store construction races the first render

**File:** `src/4-features/ai-wizard/model/useAiWizardStore.ts:76`
**Issue:** `void loadPlan()` runs un-awaited when the store is first instantiated. Until it
resolves, `plan` is `'free'`, so a Pro user briefly sees Free limits (max 10 questions, 1 MB)
in steps 2-3. If they are fast, `isStepValid` can reject a legitimate Pro-sized input. The
server still enforces correctly, so this is UX-only, but it is a visible flicker/race.
**Fix:** Expose a `planLoaded` ref and gate the limit-dependent hints, or call `loadPlan`
from the widget's `onMounted` and show a brief loading state for step 3.

### IN-02: `generateQuiz` retry treats *every* failure as retryable, including non-transient ones

**File:** `supabase/functions/_shared/openai.ts:53-113`
**Issue:** The 2-attempt loop retries on any thrown error — including a `refusal` (the model
declined; a retry will almost certainly refuse again) and a Zod `count mismatch` (often a
systematic prompt problem). Retrying a refusal wastes an OpenAI call and ~10s of latency for
a near-certain second failure. The 401/auth or quota errors are also retried pointlessly.
**Fix:** Only retry transient classes (truncation `finish_reason: length`, JSON parse
errors, network/5xx). Treat `refusal` as terminal — fail fast.

### IN-03: `formatBytes` rounding can display a size that contradicts the plan limit

**File:** `src/6-shared/lib/format.ts:17-23`
**Issue:** `formatBytes` uses `toFixed(0)` for values ≥10. A 1 MB-1 byte file (still over a
1,048,576-byte... actually under) — more concretely, a file of 1,048,000 bytes formats as
"1023 КБ" while a 1.04 MB file formats as "1 МБ". Combined with WizardStep2's error message
`Файл больше ${formatBytes(store.planMaxFileBytes)}` → "Файл больше 1 МБ", a user can see a
file labelled "1 МБ" rejected for being "больше 1 МБ", which reads as a contradiction.
**Fix:** Show one decimal place near the boundary, or phrase the limit message with the
exact limit and the actual file size both shown.

### IN-04: `promptfooconfig.yaml` duplicates the system prompt — guaranteed to drift

**File:** `evals/promptfooconfig.yaml:23-39`
**Issue:** The system prompt is copy-pasted from `quiz-prompt.ts` into the YAML (the file
even acknowledges this: "if quiz-prompt.ts changes, re-run this gate and sync"). The pasted
copy is *already* slightly different from the source — the YAML version omits the line
"Если материала недостаточно для запрошенного числа вопросов…" present in `SYSTEM_PROMPT`.
So the eval is already testing a prompt that does not match production.
**Fix:** Have the eval read `SYSTEM_PROMPT` from `quiz-prompt.ts` programmatically (a
generated prompt file or a promptfoo `file://` reference), so the gate and production can
never diverge. At minimum, fix the current divergence now.

### IN-05: `extractPdfText` / `extractDocxText` have no guard against an empty extraction

**File:** `supabase/functions/_shared/extract-text.ts:55-77`, `supabase/functions/ai-generate-quiz/index.ts:251`
**Issue:** A scanned/image-only PDF or an empty DOCX yields `raw = ''`. `capText('')` returns
`{ text: '', truncated: false }`, `source = ''`, and the EF proceeds to call OpenAI with an
empty `--- ИСХОДНЫЙ МАТЕРИАЛ ---`. The model will either refuse or hallucinate a quiz from
nothing. The pasted-text path is guarded (`sourceText.trim()` at line 263) but the file
path is not.
**Fix:** After extraction, reject empty/whitespace-only `source` with a 400 like
`EMPTY_DOCUMENT: no extractable text` so the user gets a correctable error instead of an
opaque AI failure.

### IN-06: `AiWizardWidget` leave-guard `leaveResolveCancel` declared after first use

**File:** `src/3-widgets/AiWizardWidget.vue:55-65`
**Issue:** `onBeforeRouteLeave` (line 55) assigns `leaveResolveCancel = () => resolve(false)`,
but `let leaveResolveCancel` is declared on line 65 — *after* the `onBeforeRouteLeave` call.
This works only because the guard callback runs lazily (at navigation time, after module
init), so the TDZ is not actually hit. It is fragile and confusing; a reader cannot tell at
a glance that it is safe. Also: if the user closes the dialog via the overlay/Esc, the
`@update:open` handler calls `cancelLeave` which resolves false — correct — but `confirmLeave`
and `cancelLeave` both null out `pendingLeave`/`leaveResolveCancel`, so a double-trigger is
harmless; still, the ordering should be cleaned up.
**Fix:** Move the `let leaveResolveCancel: (() => void) | null = null` declaration above
`onBeforeRouteLeave`, next to `pendingLeave`.

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
