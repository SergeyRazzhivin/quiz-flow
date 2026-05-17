---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 02
status: executing
last_updated: "2026-05-17T12:00:00.000Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 9
  completed_plans: 7
  percent: 33
---

# State: Quiz Flow

**Initialized:** 2026-05-16
**Current Phase:** 02
**Status:** Executing Phase 02

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16)

**Core value:** Пользователь загружает текст — AI генерирует готовый тест за секунды, который можно сразу отправить тестируемым.
**Current focus:** Phase 02 — quiz-taking-sharing

---

## Current Position

Phase: 02 (quiz-taking-sharing) — EXECUTING
Plan: 4 of 5 — NOT STARTED
**Phase:** 1 — Foundation, Auth & Quiz Editor — COMPLETE
**Phase 2 Plan 1:** COMPLETE — server foundation (migration 009, Edge Functions, verify-quiz-access)
**Phase 2 Plan 2:** COMPLETE — owner access-link slice (create-quiz-access EF, quiz-share store/UI, AccessLinksModal)
**Phase 2 Plan 3:** COMPLETE — guest entry slice (start-quiz-session EF, quiz-session entity, useQuizTakingStore, guest UI, allow_retake toggle, get-quiz-meta EF)

```
Phase 1 [▓▓▓▓▓▓▓▓▓▓] complete (4/4 plans)
Phase 2 [▓▓▓▓▓▓    ] 3/5 plans complete
Phase 3 [          ] 0%
Phase 4 [          ] 0%
Phase 5 [          ] 0%
```

---

## Performance Metrics

**Plans completed:** 7 (01-01 ✓, 01-02 ✓, 01-03 ✓, 01-04 ✓, 02-01 ✓, 02-02 ✓, 02-03 ✓)
**Plans created:** 9 (Phase 1: 4, Phase 2: 5)
**Requirements shipped:** 27 / 48 (AUTH-01–03, QUIZ-01–07, EDIT-01–08, NAV-01–02, TAKE-01–03, SHARE-01–03, EXT-04)
**Requirements planned:** 33 / 48 (Phase 1 + Phase 2)
**Phases completed:** 1 / 5

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
- bcryptjs VERIFIED in the Supabase Deno runtime (probe-bcrypt returned hashValid:true) — no PBKDF2 fallback needed for guest password hashing
- Supabase Edge Function names cannot start with `_` — probe function renamed `_probe-bcrypt` → `probe-bcrypt`
- Guest token signed with a dedicated `GUEST_JWT_SECRET` (not `SUPABASE_JWT_SECRET`), jose HS256, 1h TTL
- Owner-authenticated Edge Functions stay out of `config.toml` so `verify_jwt` defaults to true; they still re-verify quiz ownership in-handler because the service_role client bypasses RLS
- Access-link credentials (8-char login, 16-char password) auto-generated server-side via `crypto.getRandomValues`; plaintext password shown exactly once at creation, only a bcrypt cost-10 hash persists (D-14, D-15)
- `quiz_access` table needed a `created_at` column (migration 010) — migration 004 omitted it, breaking the `created_at`-ordered link list
- D-01 (intro+login on one screen) needed pre-login quiz metadata — added a 6th Phase 2 Edge Function `get-quiz-meta` (public, `verify_jwt=false`, returns only non-sensitive title/description/cover/time-limit/question-count)
- start-quiz-session resume branch returns stored `session_answers` so a resumed taker keeps answers and the D-07 required-question gate is not falsely tripped (D-04)

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

**Last session:** 2026-05-17T14:00:00.000Z
**Resume file:** None
**Stopped at:** 02-03-PLAN.md — COMPLETE (checkpoint:human-verify passed, "approved")
**Next action:** Execute 02-04-PLAN.md — quiz-answering UI slice (replaces the `active` placeholder in QuizTakingWidget).

---

## Phase History

### Phase 1 — Foundation, Auth & Quiz Editor (complete 2026-05-17)

- 4 plans, 20 requirements shipped (AUTH, QUIZ, EDIT, NAV)
- Walking Skeleton → quiz lists → editor shell → question editor
- Mid-phase UI overhaul: dark theme + orange accent, PrimeVue ToggleSwitch
- Notable incidents: handle_new_user search_path, vue-sonner CSS, storage policies (migration 008), router-guard refresh race
