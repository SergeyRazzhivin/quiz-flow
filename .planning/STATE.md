# State: Quiz Flow

**Initialized:** 2026-05-16
**Current Phase:** 1 — Foundation, Auth & Quiz Editor
**Status:** Executing — paused at checkpoint (Task 3, Plan 01-01)

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16)

**Core value:** Пользователь загружает текст — AI генерирует готовый тест за секунды, который можно сразу отправить тестируемым.
**Current focus:** Phase 1 Plan 01 — Walking Skeleton (paused at Supabase db push checkpoint)

---

## Current Position

**Phase:** 1 — Foundation, Auth & Quiz Editor
**Plan:** 01-01 (Walking Skeleton) — PAUSED at Task 3 checkpoint
**Status:** Awaiting human: supabase db push + covers bucket + gen types + .env

```
Phase 1 [▓▓▓       ] executing (Plan 01 paused at Task 3/6)
Phase 2 [          ] 0%
Phase 3 [          ] 0%
Phase 4 [          ] 0%
Phase 5 [          ] 0%
```

---

## Performance Metrics

**Plans completed:** 0 (01-01 partially done, awaiting checkpoint)
**Plans created:** 4 (Phase 1)
**Requirements shipped:** 0 / 48
**Requirements planned:** 20 / 48 (Phase 1)
**Phases completed:** 0 / 5

---

## Accumulated Context

### Key Decisions (from research)

- Guest writes go through Edge Functions only (verify-quiz-access, start-quiz-session, submit-quiz-answers, get-quiz-result, generate-quiz) — service_role key never reaches the client
- Guest token is a short-lived custom JWT (1 hour) stored in sessionStorage; closing the tab reverts to session-expired state
- AI generation uses async job pattern: Edge Function returns job_id in <200 ms, processes OpenAI in waitUntil(), client polls via Supabase Realtime or polling
- Timer must compute (started_at + time_limit_sec) - Date.now() on every tick and recalculate on visibilitychange to handle background tab throttling
- Answers upserted to session_answers immediately on selection — never only at final submit
- YooKassa webhook: verify sender IP allowlist, re-fetch payment from YooKassa API before applying state change, use ON CONFLICT DO UPDATE with idempotency key
- FSD linter (steiger) runs in CI from day one to prevent layer violations
- steiger fsd/typo-in-layer-name disabled for numeric FSD prefix dirs (1-app…6-shared) — Open Question 1 resolved
- shadcn-vue CLI broken on Node 20 (vue-metamorph/magic-string ESM bug); components hand-crafted with radix-vue + CVA instead

### Open Questions

- File parsing strategy for AI wizard (PDF/DOCX in Deno Edge Function) — LOW confidence, decision required before Phase 3 planning
- shuffle_answers RESOLVED: added to quizzes.settings JSONB default in migration 002
- Supabase Storage RLS for cover images RESOLVED: covers/{owner_id}/{quiz_id}/{uuid}.{ext} path in migration 007 comment

### Blockers

- **Task 3 (01-01):** Requires human to: run `supabase db push`, create covers Storage bucket, run `supabase gen types typescript --linked > src/6-shared/api/database.types.ts`, populate `.env` with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Type "applied" to resume.

---

## Session Continuity

**Last session:** 2026-05-17 — Plan 01-01 executing; Tasks 1 and 2 committed (5346f18, de428b6); paused at Task 3 checkpoint
**Resume file:** .planning/phases/01-foundation-auth-and-quiz-editor/01-01-SUMMARY.md
**Next action:** Human applies Supabase migrations → types "applied" → executor resumes from Task 4

---

## Phase History

(none yet — Phase 1 in progress)
