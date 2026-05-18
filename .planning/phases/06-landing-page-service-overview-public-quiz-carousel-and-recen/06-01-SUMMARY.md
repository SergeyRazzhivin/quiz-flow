---
phase: 06
plan: "01"
subsystem: quiz-entity-api, app-chrome
tags: [entity, fetcher, navigation, landing-prep]
dependency_graph:
  requires: []
  provides: [fetchCarouselQuizzes, /quizzes nav rebinding]
  affects: [AppHeader, AppFooter, 5-entities/quiz/api.ts]
tech_stack:
  added: []
  patterns: [supabase-aggregate-flatten, fsd-widget-nav-link]
key_files:
  created: []
  modified:
    - src/5-entities/quiz/api.ts
    - src/3-widgets/AppHeader.vue
    - src/3-widgets/AppFooter.vue
decisions:
  - "fetchCarouselQuizzes orders by updated_at DESC (not created_at) to surface recently-updated quizzes in the carousel"
  - "fetchPublishedQuizzes left byte-for-byte unchanged — QuizListPage depends on its created_at ordering"
  - "Logo RouterLink in AppHeader stays on to='/' — landing page target unchanged"
metrics:
  duration: "10m"
  completed: "2026-05-18"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 06 Plan 01: Data & Nav Foundation Summary

**One-liner:** Carousel entity fetcher (updated_at-ordered, question_count) added to quiz API; "Все тесты" nav links in AppHeader and AppFooter rebound to /quizzes.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add fetchCarouselQuizzes entity fetcher | 00b8c3c | src/5-entities/quiz/api.ts |
| 2 | Rebind "Все тесты" nav links to /quizzes | 8cbced8 | src/3-widgets/AppHeader.vue, src/3-widgets/AppFooter.vue |

## Verification

- `npx vue-tsc --noEmit` — passed (no type errors)
- `npx steiger src --reporter pretty` — passed (no FSD layer violations)
- `fetchCarouselQuizzes` exports verified in api.ts
- `fetchPublishedQuizzes` body unchanged (orders by `created_at`)
- AppHeader logo RouterLink still `to="/"`, nav "Все тесты" now `to="/quizzes"`
- AppFooter "Все тесты" now `to="/quizzes"`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. fetchCarouselQuizzes select list is explicit (no is_correct, password_hash, or owner-private columns); is_published=true filter restricts to already-public rows.

## Self-Check: PASSED

- src/5-entities/quiz/api.ts — FOUND, contains fetchCarouselQuizzes
- src/3-widgets/AppHeader.vue — FOUND, "Все тесты" → /quizzes
- src/3-widgets/AppFooter.vue — FOUND, "Все тесты" → /quizzes
- Commit 00b8c3c — FOUND
- Commit 8cbced8 — FOUND
