---
phase: 03-ai-wizard
plan: 02
subsystem: ui
tags: [vue, pinia, fsd, ai, openai, polling, supabase-edge-functions]

# Dependency graph
requires:
  - phase: 03-01
    provides: migration 012 (ai_jobs + owner-only RLS), ai-generate-quiz Edge Function returning 202 {jobId}
  - phase: 01
    provides: quiz editor (/editor/:id), router beforeEach requiresAuth guard, 6-shared/ui component kit
provides:
  - ai-job entity slice (model types + invokeGenerateQuiz/fetchAiJob API)
  - useAiWizardStore — 4-step state machine with EF generation + ai_jobs poll loop
  - 4 wizard step components + WizardStepper + AiWizardWidget + AiWizardPage
  - /ai-wizard authenticated route
  - fileToBase64 helper (6-shared/lib/file.ts) and formatBytes helper (6-shared/lib/format.ts)
affects: [03-03-entry-points, statistics, billing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wizard state machine: composition-API Pinia store with clamped step counter + per-step isStepValid computed"
    - "Job polling: setInterval(2000) loop calling fetchAiJob, torn down via stopPolling on completed/failed/cleanup/retry"
    - "Direct PostgREST poll of ai_jobs under owner SELECT RLS (no ai-job-status EF) — deviation from AI-SPEC §3"
    - "base64-in-JSON file transport: fileToBase64 strips data: prefix, payload sent in GenerateQuizPayload"

key-files:
  created:
    - src/5-entities/ai-job/model.ts
    - src/5-entities/ai-job/api.ts
    - src/6-shared/lib/file.ts
    - src/6-shared/lib/format.ts
    - src/4-features/ai-wizard/model/useAiWizardStore.ts
    - src/4-features/ai-wizard/ui/WizardStepper.vue
    - src/4-features/ai-wizard/ui/WizardStep1.vue
    - src/4-features/ai-wizard/ui/WizardStep2.vue
    - src/4-features/ai-wizard/ui/WizardStep3.vue
    - src/4-features/ai-wizard/ui/WizardStep4.vue
    - src/3-widgets/AiWizardWidget.vue
    - src/2-pages/AiWizardPage.vue
  modified:
    - src/1-app/router/index.ts

key-decisions:
  - "AiWizardPage.vue intentionally does NOT mount AppHeader — the 03-UI-SPEC prescribes the wizard's own full-viewport (100dvh) shell as the authoritative contract"
  - "resetWizard() runs on every wizard entry so a second visit to /ai-wizard opens a fresh step 1 (D-02 — the wizard always creates a new quiz, never mutates an existing one)"
  - "fetchAiJob widens the supabase client to an untyped shape for the single ai_jobs read — ai_jobs is absent from the stale generated database.types.ts"

patterns-established:
  - "4-step wizard machine: step ref clamped 1..4, next()/back() guarded, isStepValid keyed on current step"
  - "Stage-based progress: WizardStep4 maps store.currentStage (reading/generating/saving/done) to Russian status lines — no fake percentage bar"
  - "Step-4 exit guard: onBeforeRouteLeave + beforeunload confirm dialog active only while generationStatus==='pending' (D-12)"

requirements-completed: [AI-01, AI-02, AI-03, AI-04, AI-06, AI-07]

# Metrics
duration: ~2h (incl. human-verify checkpoint)
completed: 2026-05-17
---

# Phase 3 Plan 02: AI-Wizard Frontend Slice Summary

**Complete 4-step AI quiz-generation wizard — ai-job entity, useAiWizardStore state machine with ai_jobs poll loop, four step components, widget/page, and the /ai-wizard route — delivering the full owner flow from title entry to auto-redirect into the editor with a generated quiz.**

## Performance

- **Duration:** ~2h (including the Task 4 human-verify checkpoint)
- **Completed:** 2026-05-17
- **Tasks:** 4 (3 implementation + 1 human-verify checkpoint)
- **Files modified:** 13 (12 created, 1 modified)

## Accomplishments
- `ai-job` entity slice: `AiJob`/`AiJobStatus`/`AiJobStage` types, `invokeGenerateQuiz()` EF wrapper, `fetchAiJob()` direct PostgREST poll.
- `useAiWizardStore` — composition-API Pinia store driving the 4-step machine, plan-aware validation, EF generation, and the 2-second `ai_jobs` poll loop with leak-free teardown.
- 4 wizard step components (title, source material with text/file tabs + focus-area prompt, parameters, stage-based progress) plus the store-bound `WizardStepper`.
- `AiWizardWidget` with footer nav, exit button, and the D-12 step-4 exit guards (`onBeforeRouteLeave` + `beforeunload`); thin `AiWizardPage` assembler; new authenticated `/ai-wizard` route.
- End-to-end flow verified live: a real OpenAI generation produced a quiz, the owner was redirected to `/editor/:id` with questions/options/correct-answer flags populated, and a second wizard visit opened a fresh step 1.

## Task Commits

Each task was committed atomically:

1. **Task 1: ai-job entity + fileToBase64 helper** — `49d434a` (test) → `f0589f6` (feat)
2. **Task 2: useAiWizardStore — 4-step machine + poll loop** — `08da01a` (test) → `625daac` (feat)
3. **Task 3: 4 step components, stepper, widget, page, route** — `5ca8bab` (feat)
4. **Bug fix (during Task 4 verification): resetWizard on every entry** — `e9ce95f` (fix)
5. **Task 4: end-to-end human-verify checkpoint** — APPROVED by the user (no commit — verification only)

_Note: Tasks 1 & 2 were TDD (test → feat). formatBytes was added to `src/6-shared/lib/format.ts` during Task 3 for the step-2 file-size display._

## Files Created/Modified
- `src/5-entities/ai-job/model.ts` - `AiJob`, `AiJobStatus`, `AiJobStage` types.
- `src/5-entities/ai-job/api.ts` - `invokeGenerateQuiz()` EF invoke wrapper, `fetchAiJob()` ai_jobs poll read, `GenerateQuizPayload` interface.
- `src/6-shared/lib/file.ts` - `fileToBase64()` — reads a File, strips the `data:` URL prefix.
- `src/6-shared/lib/format.ts` - `formatBytes()` — human-readable file size for the step-2 display.
- `src/4-features/ai-wizard/model/useAiWizardStore.ts` - 4-step wizard state machine, generation, and the polling loop.
- `src/4-features/ai-wizard/ui/WizardStep1.vue` - Title input (AI-02).
- `src/4-features/ai-wizard/ui/WizardStep2.vue` - Text/file source tabs + always-visible focus-area prompt (AI-03).
- `src/4-features/ai-wizard/ui/WizardStep3.vue` - Question count, difficulty segments, optional difficulty prompt (AI-04).
- `src/4-features/ai-wizard/ui/WizardStep4.vue` - Stage-based spinner with Russian status lines + failure recovery (AI-07).
- `src/4-features/ai-wizard/ui/WizardStepper.vue` - 4-marker store-bound progress stepper.
- `src/3-widgets/AiWizardWidget.vue` - Composes stepper + active step, footer nav, exit button, D-12 leave guards.
- `src/2-pages/AiWizardPage.vue` - Thin full-viewport page assembler (no AppHeader, per UI-SPEC).
- `src/1-app/router/index.ts` - Added `/ai-wizard` route with `meta: { requiresAuth: true }`.

## Decisions Made
- **AiWizardPage omits AppHeader by design.** The 03-UI-SPEC prescribes the wizard as a self-contained full-viewport (100dvh) shell; the UI-SPEC is the authoritative visual contract, so the page does not mount the standard `AppHeader`.
- **`resetWizard()` runs on every wizard entry.** Surfaced during Task 4 verification — without it, a return visit to `/ai-wizard` re-rendered the prior run's state. Resetting on entry enforces D-02 (the wizard always creates a new quiz, never mutates an existing one).
- **`fetchAiJob` widens the supabase client to an untyped shape** for the single `ai_jobs` read because `ai_jobs` is absent from the generated `database.types.ts` (migration 012 shipped without a type regen).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wizard did not reset on re-entry**
- **Found during:** Task 4 (end-to-end human-verify checkpoint)
- **Issue:** Visiting `/ai-wizard` a second time re-rendered the previous run's step/form state instead of a fresh step 1, violating D-02.
- **Fix:** Added a `resetWizard()` action and invoked it on every wizard entry so each visit starts a clean 4-step flow.
- **Files modified:** `src/4-features/ai-wizard/model/useAiWizardStore.ts`, `src/3-widgets/AiWizardWidget.vue`
- **Verification:** Confirmed in the browser during the Task 4 checkpoint — a second visit opens a fresh step 1.
- **Committed in:** `e9ce95f`

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The fix was necessary for D-02 correctness. No scope creep.

## Issues Encountered
- During verification an OpenAI `403 — project does not have access to model gpt-4o-mini` was returned. Resolved on the user's side by allowing `gpt-4o-mini` in the OpenAI project's allowed-models list. Not a code issue — no code change.

## Verification
- All 73 unit tests pass.
- `npx vue-tsc --noEmit`, `npx steiger src` (FSD lint), and `npm run build` are all clean.
- Task 4 end-to-end browser walk APPROVED by the user: a live OpenAI generation succeeded, the wizard redirected to `/editor/:id` with questions/options/correct-answer flags populated, and a second `/ai-wizard` visit opened a fresh step 1.

## Follow-up Items
- **Regenerate `database.types.ts`.** `ai_jobs` is missing from the generated types because migration 012 shipped without a regen. Run `npx supabase gen types` to refresh the file, then drop the untyped-client widening in `fetchAiJob`.

## User Setup Required
None - no new external service configuration required (the `ai-generate-quiz` Edge Function and `OPENAI_API_KEY` were set up in plan 03-01).

## Next Phase Readiness
- The AI-wizard frontend slice is fully wired and verified end to end.
- Plan 03-03 (entry-point buttons on /my + the editor header, plus the AI-SPEC §5 evals harness) can proceed — the `/ai-wizard` route is the navigation target those buttons link to.

---
*Phase: 03-ai-wizard*
*Completed: 2026-05-17*
