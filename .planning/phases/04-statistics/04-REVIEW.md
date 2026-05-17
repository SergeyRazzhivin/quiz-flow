---
phase: 04-statistics
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - supabase/migrations/013_quiz_stats_rpc.sql
  - src/6-shared/lib/format.ts
  - src/6-shared/ui/ProgressBar.vue
  - src/4-features/quiz-stats/model/useQuizStatsStore.ts
  - src/4-features/quiz-stats/ui/SummaryCards.vue
  - src/4-features/quiz-stats/ui/ResultsTable.vue
  - src/4-features/quiz-stats/ui/AccuracySection.vue
  - src/3-widgets/QuizStatsWidget.vue
  - src/2-pages/QuizStatsPage.vue
  - src/1-app/router/index.ts
  - src/3-widgets/QuizEditorHeader.vue
  - src/5-entities/quiz/ui/QuizCard.vue
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: fixes_applied
resolved:
  - CR-01
  - CR-02
  - WR-01
  - WR-02
  - WR-03
  - WR-04
  - WR-05
  - WR-06
unresolved:
  - IN-01
  - IN-02
  - IN-03
  - IN-04
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

The Phase 4 Statistics slice is well-structured: FSD layering is respected (store imports
only from 5-entities/6-shared, the page is a thin assembler, the widget composes features),
the Pro gate is enforced server-side and client-side, and `answer_options.is_correct` is
correctly confined to the SQL function body and never returned in any payload — the
CLAUDE.md sensitive-column constraint holds.

However the per-question accuracy SQL contains a join-fan-out bug that produces wrong
numbers, and the empty/error rendering path can crash. Findings below.

## Critical Issues

### CR-01: Accuracy denominator double-counts when a taker selects multiple options

**File:** `supabase/migrations/013_quiz_stats_rpc.sql:88-121`
**Issue:** In `get_quiz_accuracy`, the `correct_answers` LATERAL `unnest(sa.selected_option_ids)`
joined `ON true` to the row chain produces **one row per selected option** for a given
`(question, taker)` pair. The aggregate then runs over that fanned-out set:
- `COUNT(CASE WHEN correct_answers.is_correct THEN 1 END)` — `is_correct` is `bool_or(...)`
  computed by the inner LATERAL, so it is the *same value repeated* for every fanned row.
  This is not the count of correct answers; it is the count of selected options on
  correct-answering sessions. A taker who picks 3 options on a correct answer contributes 3
  to the numerator, a taker who picks 1 contributes 1. The numerator is therefore weighted
  by how many options each taker clicked, not by how many takers were correct.
- Worse, when `selected_option_ids` is empty/NULL the `unnest` yields zero rows, so the
  `correct_answers` LATERAL `ON true` still yields one all-NULL row — but multi-select
  takers inflate the count.

The denominator `COUNT(DISTINCT latest.quiz_access_id)` is correct (distinct takers), so
numerator and denominator are on different scales and `accuracy_percent` can exceed 100%.
**Fix:** Aggregate correctness to one boolean per `(question, taker)` before counting. e.g.

```sql
SELECT
  q.id AS question_id, q.body, q.order_index,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE per_taker.is_correct)
         / NULLIF(COUNT(per_taker.quiz_access_id), 0),
    1
  ) AS accuracy_percent
FROM questions q
LEFT JOIN LATERAL (
  SELECT
    latest.quiz_access_id,
    bool_or(ao.is_correct) AS is_correct
  FROM (
    SELECT DISTINCT ON (quiz_access_id) id AS session_id, quiz_access_id
    FROM quiz_sessions
    WHERE quiz_id = p_quiz_id AND finished_at IS NOT NULL
    ORDER BY quiz_access_id, finished_at DESC
  ) latest
  JOIN session_answers sa
    ON sa.session_id = latest.session_id AND sa.question_id = q.id
  LEFT JOIN LATERAL unnest(sa.selected_option_ids) AS sel_id ON true
  LEFT JOIN answer_options ao ON ao.id = sel_id
  GROUP BY latest.quiz_access_id
) per_taker ON true
WHERE q.quiz_id = p_quiz_id
GROUP BY q.id, q.body, q.order_index
ORDER BY q.order_index
```

Decide explicitly whether the denominator is "all takers" or "takers who answered this
question" — the current code mixes both interpretations.

### CR-02: Stats page crashes on the error branch — `formatShortDateTime` / sort on undefined

**File:** `src/3-widgets/QuizStatsWidget.vue:35-43` and `src/4-features/quiz-stats/ui/ResultsTable.vue:42`
**Issue:** Two related correctness failures around partial/empty data:
1. If `get_quiz_stats` returns a quiz with **zero finished sessions**, `perPerson` is
   `jsonb_agg(...)` over an empty set, which returns SQL `NULL`, not `[]`. `stats.perPerson`
   is then `null`. `ResultsTable` declares `rows: PerPersonRow[]` and does
   `[...props.rows].sort(...)` (`ResultsTable.vue:27`) — spreading `null` throws
   `TypeError: props.rows is not iterable`, breaking the whole data branch render.
   The empty-state guard in the widget only checks `totalAttempts === 0`; a quiz with
   started-but-never-finished attempts has `totalAttempts > 0` and `perPerson === null`,
   so it falls through to the data branch and crashes.
2. Same applies to `accuracy` when `get_quiz_accuracy` returns `NULL` (a quiz with no
   questions or no finished sessions) — `AccuracySection` `v-for="row in accuracy"` over
   `null` renders nothing (tolerable) but the type contract `AccuracyRow[]` is violated.
**Fix:** Coalesce in SQL: `COALESCE(jsonb_agg(...), '[]'::jsonb)` for both `perPerson` and
the `get_quiz_accuracy` return. Optionally also defensively default in the store:
`stats.value = { ...statsData, perPerson: statsData.perPerson ?? [] }`.

## Warnings

### WR-01: `finished_at` sort is a lexicographic string compare, not chronological

**File:** `src/4-features/quiz-stats/ui/ResultsTable.vue:37-44`
**Issue:** `valA = a.finished_at` is the raw ISO string from Postgres. Comparing with `<` /
`>` works only if every timestamp uses an identical format/zone. Postgres `timestamptz`
serialized to JSON can vary in fractional-second digits and offset representation
(`+00:00` vs `Z`), making string ordering unreliable across rows.
**Fix:** Compare timestamps numerically: `valA = new Date(a.finished_at).getTime()`.

### WR-02: `ResultsTable` row `:key` is not unique

**File:** `src/4-features/quiz-stats/ui/ResultsTable.vue:81`
**Issue:** `:key="row.finished_at + (row.name ?? '')"`. Two takers with the same display
label (`quiz_access.label` is not unique) finishing at the same instant collide. Vue then
mis-patches rows on re-sort. There is no stable id in `PerPersonRow`.
**Fix:** Add `quiz_access_id` to the `perPerson` payload in `get_quiz_stats` and the
`PerPersonRow` type, and key on it.

### WR-03: Empty `perPerson` shows nothing instead of an empty-table message

**File:** `src/3-widgets/QuizStatsWidget.vue:58-74`
**Issue:** When `totalAttempts > 0` but no session ever finished, `ResultsTable` renders
only its header with zero body rows — a bare table with no explanation. The D-08 empty
state only covers `totalAttempts === 0`.
**Fix:** Add an in-table "Никто пока не завершил тест" row when `sortedRows.length === 0`.

### WR-04: `loadProStatus` swallows query errors and silently treats user as Free

**File:** `src/4-features/quiz-stats/model/useQuizStatsStore.ts:51-57`
**Issue:** The `subscriptions` query destructures only `data`, ignoring `error`. A failed
query (network, RLS) yields `data === null` → `isPro = false`. A paying Pro owner whose
subscription lookup transiently fails is silently downgraded and shown the Free blur gate
with no error. This is a UX/correctness defect distinct from the deliberate "null row =
Free" rule.
**Fix:** Capture `error`; on error either rethrow into the outer `catch` or surface a
distinct message rather than silently defaulting to Free.

### WR-05: `catch {}` discards the real error — no diagnosability

**File:** `src/4-features/quiz-stats/model/useQuizStatsStore.ts:88-93`
**Issue:** The bare `catch {}` throws away the thrown RPC error. A `RAISE EXCEPTION
'unauthorized'` (wrong owner), a network failure, and a SQL bug all collapse into the same
generic toast with nothing logged. Debugging production issues becomes impossible, and an
authorization failure is indistinguishable from a connectivity failure.
**Fix:** `catch (e) { console.error('loadStats failed', e); ... }` and consider mapping
the `unauthorized` message to a distinct "Нет доступа" state.

### WR-06: `ProgressBar` does not clamp `value` — bar overflows its track

**File:** `src/6-shared/ui/ProgressBar.vue:13`
**Issue:** `width: ${value}%` is applied verbatim. Given CR-01 can yield
`accuracy_percent > 100`, or any future caller passing a value outside 0–100, the fill div
extends past its rounded track. Negative values also break layout.
**Fix:** Clamp: `width: ${Math.max(0, Math.min(100, value))}%`.

## Info

### IN-01: `supabase as any` casts defeat RPC type safety

**File:** `src/4-features/quiz-stats/model/useQuizStatsStore.ts:71,80`
**Issue:** Both RPC calls cast the client to `any`, so `statsData`/`accData` are then
asserted (`as QuizStats` / `as AccuracyRow[]`) with zero compile-time checking. If a
column is renamed in the SQL the client breaks silently at runtime.
**Fix:** Add the RPC function signatures to the generated Supabase `Database` types so
`.rpc('get_quiz_stats', ...)` is typed, and drop the casts.

### IN-02: `$reset` is defined but never invoked

**File:** `src/4-features/quiz-stats/model/useQuizStatsStore.ts:102-108`
**Issue:** The store is a singleton; navigating between two quizzes' stats pages reuses it.
`QuizStatsWidget` calls `loadStats` on mount but never `$reset`, so for a brief moment the
previous quiz's `stats`/`accuracy` are visible before the new data arrives. `$reset` exists
to solve exactly this but is dead code.
**Fix:** Call `store.$reset()` at the start of `loadStats` (or in the widget `onMounted`
before `loadStats`).

### IN-03: No watcher on `route.params.id` — stale data on in-app navigation

**File:** `src/3-widgets/QuizStatsWidget.vue:14-16`
**Issue:** `loadStats` runs only in `onMounted`. If the router reuses the
`QuizStatsPage` component instance when navigating `/quiz/A/stats` → `/quiz/B/stats`
(same component, different param), stats for quiz A remain shown.
**Fix:** `watch(() => route.params.id, (id) => store.loadStats(id as string), { immediate: true })`.

### IN-04: `formatShortDateTime` regex post-processing is fragile

**File:** `src/6-shared/lib/format.ts:77-84`
**Issue:** The function relies on `.replace(' г.', '')` and `.replace(/(\d+\s+\w+)/, '$1,')`
to reshape `toLocaleString` output. Locale/runtime changes to `ru-RU` formatting (e.g. a
different separator) silently break the output. This is brittle string surgery on a
formatter result.
**Fix:** Build the string from `Intl.DateTimeFormat().formatToParts()` and assemble the
desired `"17 мая, 14:32"` shape explicitly from named parts.

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
