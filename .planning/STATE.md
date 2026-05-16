# State: Quiz Flow

**Initialized:** 2026-05-16
**Current Phase:** None (not started)
**Status:** Ready to plan Phase 1

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16)

**Core value:** Пользователь загружает текст — AI генерирует готовый тест за секунды, который можно сразу отправить тестируемым.
**Current focus:** Phase 1 — Foundation, Auth & Quiz Editor

---

## Current Position

**Phase:** 1 — Foundation, Auth & Quiz Editor
**Plan:** None yet
**Status:** Not started

```
Phase 1 [          ] 0%
Phase 2 [          ] 0%
Phase 3 [          ] 0%
Phase 4 [          ] 0%
Phase 5 [          ] 0%
```

---

## Performance Metrics

**Plans completed:** 0
**Requirements shipped:** 0 / 48
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

### Open Questions

- File parsing strategy for AI wizard (PDF/DOCX in Deno Edge Function) — LOW confidence, decision required before Phase 3 planning
- shuffle_answers field missing from schema — add to quizzes.settings JSONB in Phase 1 migration
- Supabase Storage RLS for cover images — path pattern: covers/{owner_id}/{quiz_id}/{uuid}.{ext}

### Blockers

(none)

---

## Session Continuity

**Last session:** 2026-05-16 — Roadmap created (5 phases, 48 requirements mapped)
**Next action:** Run `/gsd:plan-phase 1` to decompose Phase 1 into executable plans

---

## Phase History

(none yet)
