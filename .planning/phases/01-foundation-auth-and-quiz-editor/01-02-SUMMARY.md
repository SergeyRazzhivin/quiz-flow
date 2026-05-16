---
plan: 01-02
phase: 01-foundation-auth-and-quiz-editor
status: complete
completed: 2026-05-17
requirements: [QUIZ-04, QUIZ-05, QUIZ-06, NAV-01]
commits:
  - 02220a8 feat(01-02): AppHeader, QuizCard, home /, /my pages with create/delete
  - 047aafe fix(01-02): await idempotent auth init in router guard to fix refresh race
---

# Phase 1 Plan 02: Quiz Lists Summary

**One-liner:** Shared QuizCard + AppHeader; public `/` and owner `/my` pages with create, delete-with-dialog, and empty state.

## Status: COMPLETE

## Artifacts

- `src/3-widgets/AppHeader.vue` — sticky h-14 nav bar; brand, "Все тесты"/"Мои тесты" links, auth-state-aware right side with working logout
- `src/5-entities/quiz/ui/QuizCard.vue` — shared display card; 16:9 cover or gray placeholder, title/desc, `showActions` (edit/delete + published badge); emits `delete`, no API calls
- `src/4-features/quiz-list/ui/EmptyState.vue` — new-owner empty state with "Создать первый тест" CTA
- `src/4-features/quiz-list/ui/DeleteQuizDialog.vue` — confirm dialog ("Удалить тест?") via shadcn-vue Dialog
- `src/2-pages/QuizListPage.vue` — public `/`, lists published quizzes (showActions=false)
- `src/2-pages/MyQuizListPage.vue` — owner `/my`, create→editor, delete-with-dialog, empty state

## Verified

- ✅ Header reflects auth state; logout works from any page
- ✅ `/` lists published quizzes; `/my` lists owner quizzes
- ✅ Create lands in editor; delete confirms via dialog
- ✅ Empty state shows for new owners
- ✅ `/my` refresh stays authenticated (race fixed)

## Deviations / Incidents

- **`Dialog.vue` invalid exports** — original shared `Dialog.vue` had `export {}` inside `<script setup>` (illegal in Vue SFC); stripped to a thin `DialogRoot` wrapper. `DeleteQuizDialog.vue` imports radix-vue primitives directly.
- **Router guard refresh race** — `authStore.init()` ran in `App.vue` onMounted, after the first `beforeEach`; guard saw `user === null` and bounced authenticated users off `/my`. Fix: `init()` is now idempotent (cached promise) and the guard `await`s it before checking auth.

## Interfaces for Plan 01-03

```
AppHeader: src/3-widgets/AppHeader.vue — drop-in, no props
QuizCard:  src/5-entities/quiz/ui/QuizCard.vue — props { quiz, showActions? }, emits delete
Auth store: useAuthStore().init() is idempotent and awaitable
```
