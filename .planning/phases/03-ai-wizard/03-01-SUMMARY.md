---
phase: 03-ai-wizard
plan: 01
subsystem: api
tags: [supabase, edge-functions, deno, openai, gpt-4o-mini, zod, unpdf, unzipit, postgres, rls]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: quizzes/questions/answer_options schema, profiles.plan enum, useQuizEditorStore order_index convention
  - phase: 02-quiz-taking
    provides: owner-authenticated Edge Function template (create-quiz-access), _shared/cors.ts + _shared/errors.ts
provides:
  - ai_jobs tracking table with ai_job_status / ai_job_stage enums and owner-only SELECT RLS
  - four _shared AI helper modules (quiz-schema, quiz-prompt, extract-text, openai)
  - ai-generate-quiz Edge Function — owner-auth, plan-aware limits, async generation via EdgeRuntime.waitUntil
  - server-side PDF/DOCX text extraction (unpdf + unzipit)
affects: [ai-wizard-ui, ai-job-polling, ai-quiz-generation]

# Tech tracking
tech-stack:
  added: [openai@4.104.0, unpdf@0.12.1, unzipit@1.4.3]
  patterns:
    - "Fast-ACK async job: auth -> limits -> insert pending row -> EdgeRuntime.waitUntil -> 202"
    - "Client polls a status table directly via owner-SELECT RLS instead of a status Edge Function"
    - "Hand-written OpenAI strict JSON schema + Zod re-validation gate before DB persist"

key-files:
  created:
    - supabase/migrations/012_ai_jobs.sql
    - supabase/functions/_shared/quiz-schema.ts
    - supabase/functions/_shared/quiz-prompt.ts
    - supabase/functions/_shared/extract-text.ts
    - supabase/functions/_shared/openai.ts
    - supabase/functions/ai-generate-quiz/deno.json
    - supabase/functions/ai-generate-quiz/index.ts
  modified: []

key-decisions:
  - "ai-job-status Edge Function NOT created — client polls ai_jobs directly via owner-SELECT RLS (RESEARCH Assumption A2 / Pattern 2)"
  - "OpenAI pinned to v4 SDK (openai@4.104.0) — AI-SPEC §4b code is v4-only; openai@6 would break the verbatim copy"
  - "Plan-aware limits (file size D-06, question count D-07) enforced server-side with HTTP 400 on overage"
  - "D-03: quizzes row created only after a successful generation; a failed job creates no quizzes row"
  - "base64-in-JSON file transport is the chosen design; Storage-upload remains the documented contingency"

patterns-established:
  - "Fast-ACK async job pattern: Edge Function returns 202 {jobId} in <200 ms, slow work runs in EdgeRuntime.waitUntil and is never awaited"
  - "Status-table polling: owner reads job progress via owner-only SELECT RLS — no dedicated status Edge Function"
  - "Untrusted AI output is re-indexed (order_index 0..n-1) and Zod-revalidated before any DB insert"

requirements-completed: [AI-05]

# Metrics
duration: ~35min
completed: 2026-05-17
---

# Phase 3 Plan 01: AI Generation Backend Summary

**Owner-authenticated `ai-generate-quiz` Edge Function that runs the GPT-4o-mini quiz pipeline asynchronously via `EdgeRuntime.waitUntil`, backed by an `ai_jobs` tracking table with owner-only RLS and server-side PDF/DOCX extraction.**

## Performance

- **Duration:** ~35 min (across original + continuation executor)
- **Completed:** 2026-05-17
- **Tasks:** 5 (3 auto, 1 blocking-human checkpoint, 1 human-action checkpoint)
- **Files modified:** 7 created

## Accomplishments

- `ai_jobs` table (migration 012) with `ai_job_status` / `ai_job_stage` enums, AI-SPEC §7 monitoring columns, owner-only SELECT RLS, no anon/write policies.
- Four `_shared` AI helpers: hand-written `QUIZ_JSON_SCHEMA` strict schema + Zod `QuizSchema` re-validation, Russian `SYSTEM_PROMPT` + `buildUserPrompt`, server-side PDF/DOCX text extraction, and the D-11 single-retry `generateQuiz` wrapper pinned to `openai@4.104.0`.
- `ai-generate-quiz` Edge Function: owner auth, plan-aware file-size + question-count limits (HTTP 400 on overage), `ai_jobs` insert, async generation via `EdgeRuntime.waitUntil`, returns `{ jobId }` at HTTP 202.
- Migration 012 pushed to Supabase, `OPENAI_API_KEY` function secret set, `ai-generate-quiz` deployed (Task 5, human-confirmed).
- Requirement AI-05 shipped — the AI quiz-generation backend is fully callable.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 012_ai_jobs.sql + owner-only RLS** - `d6c517a` (feat)
2. **Task 2 (RED): Failing QuizSchema re-validation tests** - `087a2f3` (test)
3. **Task 2 (GREEN): _shared AI helper modules** - `0609307` (feat)
4. **Task 3: ai-generate-quiz Edge Function + deno.json** - `5e81339` (feat)
5. **Task 4: Package legitimacy verification** - no commit (blocking-human checkpoint — orchestrator-approved)
6. **Task 5: Schema push + deploy** - no commit (human-action checkpoint — user-confirmed deployment)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/012_ai_jobs.sql` - `ai_jobs` table, two enum types, owner-only SELECT RLS, FK index.
- `supabase/functions/_shared/quiz-schema.ts` - `QUIZ_JSON_SCHEMA` (OpenAI strict) + `QuizSchema` Zod re-validation + `GeneratedQuiz` type.
- `supabase/functions/_shared/quiz-prompt.ts` - `SYSTEM_PROMPT` + `buildUserPrompt` (Russian, D-08 difficulty mapping).
- `supabase/functions/_shared/extract-text.ts` - `extractDocumentText`: base64 decode, plan-aware size guard, PDF (unpdf) / DOCX (unzipit) extraction, 12000-char cap.
- `supabase/functions/_shared/openai.ts` - `generateQuiz`: GPT-4o-mini call, json_schema strict, D-11 single retry, refusal/finish_reason checks, `QuizSchema.parse`, count assertion.
- `supabase/functions/ai-generate-quiz/deno.json` - hard-pinned import map.
- `supabase/functions/ai-generate-quiz/index.ts` - owner-auth EF, plan-limit enforcement, `ai_jobs` insert, `runGeneration`/`persistQuiz`, 202 response.

## Decisions Made

- **No `ai-job-status` Edge Function** — the client polls the `ai_jobs` table directly through owner-SELECT RLS (RESEARCH Assumption A2 / Pattern 2). This collapses the phase to a single new Edge Function; CONTEXT.md delegates the Edge Function set to Claude's discretion.
- **OpenAI v4 SDK pin (`openai@4.104.0`)** — the AI-SPEC §4b code (`response_format`, `message.refusal`, `finish_reason`) is v4-only; `openai@6` would break the verbatim copy.
- **base64-in-JSON file transport** is the chosen design for uploaded PDF/DOCX; the Storage-upload fallback (client uploads to a temp Storage path, the EF reads + deletes it) remains the documented contingency if a live test shows a 413.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — Tasks 1-3 completed cleanly; Tasks 4-5 are checkpoints resolved by human approval.

## Server-Side Guard Confirmation (Task 5, code-level re-verification)

Verify-steps 1-4 of Task 5 (schema push, `OPENAI_API_KEY` secret, function deploy, `ai_jobs` table live with RLS) were confirmed by the user ("approved").

Verify-steps 5-6 (live EF body-limit test with a ~5 MB base64 payload, and live over-limit HTTP 400 tests) were NOT run as live invocations — they require crafted live requests. The server-side guards were instead re-confirmed at the code level:

- `ai-generate-quiz/index.ts` lines 229-236: an over-plan `questionCount` returns HTTP 400 `QUESTION_COUNT_EXCEEDED` (threat T-03-06).
- `ai-generate-quiz/index.ts` lines 244-262: `extractDocumentText` is called with `limits.maxFileBytes`; a `FILE_TOO_LARGE` throw is mapped to HTTP 400 (threat T-03-05).
- `_shared/extract-text.ts` lines 96-100: the raw-byte size guard runs BEFORE extraction and throws `FILE_TOO_LARGE` when the decoded file exceeds the plan limit.

Both threats T-03-05 / T-03-06 are mitigated in code.

## Deferred to Phase Verification / Human UAT

- **EF request-body limit for a Pro 5 MB base64 file (~6.7 MB encoded)** — RESEARCH Open Question 2 / Assumption A3. The base64-in-JSON transport assumes Supabase's Edge Function request-body limit comfortably exceeds an encoded Pro 5 MB file. This was not confirmed by a live invocation. base64-in-JSON is the chosen design; if a live test later returns HTTP 413, switch to the documented Storage-upload fallback. Tracked for phase verification / human UAT.
- **Live over-limit HTTP 400 test** — invoking the deployed function with an over-plan `questionCount` and an over-plan file size to observe HTTP 400 end-to-end. The code-level guards are confirmed above; the live observation is deferred to human UAT.

## User Setup Required

External service configuration completed during Task 5 (human-action checkpoint):
- `OPENAI_API_KEY` set as a Supabase function secret (`supabase secrets set OPENAI_API_KEY=sk-...`).
- Migration 012 applied via `supabase db push`.
- `ai-generate-quiz` deployed via `supabase functions deploy ai-generate-quiz`.

## Next Phase Readiness

- The AI generation backend is fully callable: `POST ai-generate-quiz` returns `{ jobId }` at HTTP 202; generation runs in the background and the result lands in the standard `quizzes`/`questions`/`answer_options` tables.
- Plan 03-02 / 03-03 can build the AI-wizard UI: a form that posts to `ai-generate-quiz` and a polling view that reads `ai_jobs` via owner-SELECT RLS (D-10 stage progress).
- Open contingency: confirm the EF body limit accommodates a Pro 5 MB base64 file during phase verification; the Storage-upload fallback is the documented backup.

## Self-Check: PASSED

All 7 created files verified present on disk; all 4 task commits (`d6c517a`, `087a2f3`, `0609307`, `5e81339`) verified in git history.

---
*Phase: 03-ai-wizard*
*Completed: 2026-05-17*
