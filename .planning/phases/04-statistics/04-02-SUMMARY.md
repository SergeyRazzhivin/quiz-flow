---
phase: 04-statistics
plan: 02
subsystem: frontend
tags: [vue3, pinia, fsd, statistics, pro-gate, tailwind]

requires:
  - phase: 04-01
    provides: get_quiz_stats and get_quiz_accuracy RPCs, formatPercent/formatScore/formatShortDateTime helpers, ProgressBar size prop

provides:
  - useQuizStatsStore with Pro-gated accuracy fetch (D-05, D-06)
  - SummaryCards, ResultsTable, AccuracySection section components
  - QuizStatsWidget composing all states (loading/empty/error/data)
  - QuizStatsPage thin assembler for /quiz/:id/stats
  - /quiz/:id/stats route with requiresAuth
  - Статистика entry buttons on QuizCard and QuizEditorHeader

affects: [billing (placeholder /billing route in AccuracySection CTA)]

tech-stack:
  added: []
  patterns:
    - "Pinia composition store: supabase.rpc via (supabase as any).rpc() — database.types.ts lacks Functions type for migration 013 RPCs"
    - "Pro gate: isPro derived from subscriptions.maybeSingle() — null row treated as Free (Pitfall 5)"
    - "D-06: get_quiz_accuracy inside if (isPro.value) branch only"
    - "backdrop-blur-md overlay over skeleton bars for Free owner accuracy section"
    - "Client-side sort in ResultsTable via computed + sortKey/sortDir refs"

key-files:
  created:
    - src/4-features/quiz-stats/model/useQuizStatsStore.ts
    - src/4-features/quiz-stats/ui/SummaryCards.vue
    - src/4-features/quiz-stats/ui/ResultsTable.vue
    - src/4-features/quiz-stats/ui/AccuracySection.vue
    - src/3-widgets/QuizStatsWidget.vue
    - src/2-pages/QuizStatsPage.vue
  modified:
    - src/1-app/router/index.ts
    - src/3-widgets/QuizEditorHeader.vue
    - src/5-entities/quiz/ui/QuizCard.vue

key-decisions:
  - "supabase.rpc cast to (supabase as any) — database.types.ts was generated before migration 013 and has no Functions entry; cast avoids regenerating types in this phase (follow-up remains open)"
  - "AccuracySection renders 4 skeleton bars (not placeholder zeros) behind the blur overlay so no real numbers are ever visible to Free owners (D-06)"
  - "ResultsTable wraps in overflow-x-auto rather than reflowing on narrow viewports (UI-SPEC Interaction Contract)"

requirements: [STATS-01, STATS-02, STATS-03]

duration: 20min
completed: 2026-05-18
---

# Phase 4 Plan 02: Statistics UI Slice Summary

**Quiz-stats FSD feature slice: Pinia store with Pro-gated RPC calls, three section components (SummaryCards/ResultsTable/AccuracySection), composing widget, thin page, /quiz/:id/stats route, and Статистика entry buttons on QuizCard and QuizEditorHeader**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-05-18
- **Tasks completed:** 3 of 3
- **Files created:** 6
- **Files modified:** 3

## Accomplishments

- `useQuizStatsStore`: D-05 Pro status from subscriptions table via `maybeSingle()` with optional chaining (null row = Free); D-06 `get_quiz_accuracy` called only inside `if (isPro.value)`; `completionRate` computed returns 0 on zero attempts; try/catch/finally with `toast.error`
- `SummaryCards`: 3 cards (Всего попыток, Процент завершений, Средний балл) in `grid-cols-1 sm:grid-cols-3`; `animate-pulse` skeleton placeholders while `isLoading`
- `ResultsTable`: comparison table with client-side sort, default `finished_at DESC`, toggles on column header click; `overflow-x-auto` for narrow viewports
- `AccuracySection`: D-06 Free owner sees `backdrop-blur-md` overlay over 4 skeleton bars — no real numbers rendered; Pro owner sees `ProgressBar size="md"` rows with `formatPercent` labels
- `QuizStatsWidget`: full loading/empty/error/data render branches; D-08 empty state is a friendly message (not zeroed cards)
- `/quiz/:id/stats` route registered with `meta: { requiresAuth: true }` (D-01, T-04-05 mitigated)
- Статистика buttons on `QuizCard` (between Изменить and Trash2) and `QuizEditorHeader` (before Создать с ИИ, guarded `v-if="editorStore.quiz"`) — both navigate to `/quiz/${id}/stats`
- vue-tsc, steiger, npm run build all pass

## Task Commits

1. **Task 1: quiz-stats Pinia store** — `f91c359`
2. **Task 2: Section components (SummaryCards, ResultsTable, AccuracySection)** — `9104db3`
3. **Task 3: Widget, page, route, entry buttons** — `cc41690`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] supabase.rpc type error — database.types.ts has no Functions entry for migration 013 RPCs**
- **Found during:** Task 1 verify step (vue-tsc reported `Argument of type '"get_quiz_stats"' is not assignable to parameter of type 'never'`)
- **Issue:** `database.types.ts` was generated before migration 013; the `Functions` section is absent, making `supabase.rpc(...)` resolve to `never`
- **Fix:** Cast `supabase` to `(supabase as any)` on the two RPC calls, with ESLint disable comments
- **Files modified:** `src/4-features/quiz-stats/model/useQuizStatsStore.ts`
- **Commit:** `f91c359`

## Known Stubs

None.

## Threat Flags

None — T-04-04 mitigated (accuracy fetch inside `if (isPro.value)` branch), T-04-05 mitigated (`meta: { requiresAuth: true }` on route). No new security surface introduced.

---

## Self-Check

- [x] `src/4-features/quiz-stats/model/useQuizStatsStore.ts` — created (f91c359)
- [x] `src/4-features/quiz-stats/ui/SummaryCards.vue` — created (9104db3)
- [x] `src/4-features/quiz-stats/ui/ResultsTable.vue` — created (9104db3)
- [x] `src/4-features/quiz-stats/ui/AccuracySection.vue` — created (9104db3)
- [x] `src/3-widgets/QuizStatsWidget.vue` — created (cc41690)
- [x] `src/2-pages/QuizStatsPage.vue` — created (cc41690)
- [x] `src/1-app/router/index.ts` — modified, /quiz/:id/stats route added (cc41690)
- [x] `src/3-widgets/QuizEditorHeader.vue` — Статистика button added (cc41690)
- [x] `src/5-entities/quiz/ui/QuizCard.vue` — Статистика button added (cc41690)
- [x] grep "if (isPro" in store — PASS
- [x] grep "maybeSingle" in store — PASS
- [x] grep "backdrop-blur-md" in AccuracySection — PASS
- [x] grep "sortKey" in ResultsTable — PASS
- [x] grep "/quiz/:id/stats" in router — PASS
- [x] steiger — no problems
- [x] vue-tsc — no errors
- [x] npm run build — success

## Self-Check: PASSED
