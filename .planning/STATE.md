# State: Quiz Flow

**Initialized:** 2026-05-16
**Current Phase:** 1 — Foundation, Auth & Quiz Editor
**Status:** Executing — Plan 01-03 complete; Plan 01-04 next

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16)

**Core value:** Пользователь загружает текст — AI генерирует готовый тест за секунды, который можно сразу отправить тестируемым.
**Current focus:** Phase 1 Plan 04 — Question editor (CRUD, DnD reorder, publish validation)

---

## Current Position

**Phase:** 1 — Foundation, Auth & Quiz Editor
**Plan:** 01-04 (Question editor) — next
**Status:** Plan 01-03 complete

```
Phase 1 [▓▓▓▓▓▓▓▓▓ ] executing (Plans 01-03 done, Plan 04 next)
Phase 2 [          ] 0%
Phase 3 [          ] 0%
Phase 4 [          ] 0%
Phase 5 [          ] 0%
```

---

## Performance Metrics

**Plans completed:** 3 (01-01 ✓, 01-02 ✓, 01-03 ✓)
**Plans created:** 4 (Phase 1)
**Requirements shipped:** 14 / 48 (AUTH-01–03, QUIZ-01–07, EDIT-08, NAV-01–02)
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

None.

### Incidents

- `handle_new_user()` trigger required `SET search_path = public` (Supabase SECURITY DEFINER restriction) — fixed in a49925e
- Supabase dashboard shows new `sb_publishable_*` key format — must use JWT `eyJ…` anon key in `.env`

---

## Session Continuity

**Last session:** 2026-05-17 — Plans 01-01/02/03 complete and verified; UI design-review tweaks applied; moving to Plan 01-04
**Resume file:** .planning/phases/01-foundation-auth-and-quiz-editor/01-04-PLAN.md
**Next action:** Execute Plan 01-04 — question editor (question/option CRUD, DnD reorder, publish validation)

---

## Phase History

(none yet — Phase 1 in progress)
