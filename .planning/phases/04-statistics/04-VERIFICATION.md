---
phase: 04-statistics
verified: 2026-05-18T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Открыть /quiz/:id/stats в браузере под авторизованным владельцем теста и убедиться, что отображаются три карточки (Всего попыток, Процент завершений, Средний балл) с реальными данными"
    expected: "Карточки показывают числа, не прочерки и не нули при наличии попыток"
    why_human: "Данные приходят из RPC-вызова в runtime; grep не может подтвердить, что live DB вернула корректный payload"
  - test: "Открыть /quiz/:id/stats под Free-владельцем и проверить секцию точности"
    expected: "Секция 'Точность по вопросам' размыта (backdrop-blur), реальные проценты не видны, отображается кнопка 'Перейти на Pro'; в Network Tab отсутствует запрос get_quiz_accuracy"
    why_human: "Поведение Pro-gate требует проверки реального сетевого трафика и визуального рендеринга"
  - test: "Открыть /quiz/:id/stats под Pro-владельцем (активная подписка в таблице subscriptions)"
    expected: "Секция точности показывает горизонтальные progress bars с процентами по каждому вопросу"
    why_human: "Требует реальной строки subscriptions с plan='pro', status='active' в live DB"
  - test: "Открыть /quiz/:id/stats для теста без ни одной попытки"
    expected: "Отображается пустое состояние: иконка BarChart3, текст 'Пока никто не проходил тест', без нулевых карточек"
    why_human: "Условие D-08 требует проверки в реальном браузере"
  - test: "Убедиться, что migration 014_quiz_stats_rpc_fixes.sql применена к live DB"
    expected: "`supabase migration list` показывает 014 как Remote (applied); в Supabase SQL Editor `SELECT proname FROM pg_proc WHERE proname IN ('get_quiz_stats','get_quiz_accuracy')` возвращает 2 строки"
    why_human: "Применение миграции — это операция в live окружении, автоматически не верифицируется"
  - test: "Проверить кнопку 'Статистика' на карточке теста (/my) и в редакторе теста (QuizEditorHeader)"
    expected: "Обе кнопки навигируют на /quiz/:id/stats для соответствующего теста"
    why_human: "Навигация и routing требуют проверки в браузере"
---

# Phase 4: Statistics — Verification Report

**Phase Goal:** An owner can view attempt totals, completion rate, average score, and a per-person result table for any quiz; Pro owners can also see per-question accuracy broken down for every question.
**Verified:** 2026-05-18T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Two SECURITY DEFINER RPCs exist and reject non-owners | VERIFIED | `013_quiz_stats_rpc.sql` и `014_quiz_stats_rpc_fixes.sql` оба содержат `IF v_owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'unauthorized'` для обоих функций |
| 2 | D-02: get_quiz_stats perPerson — DISTINCT ON (quiz_access_id) latest finished, avgScore over those rows | VERIFIED | SQL в 014: `SELECT DISTINCT ON (qs.quiz_access_id)` + `ORDER BY quiz_access_id, finished_at DESC`; avgScore — `SELECT AVG(score) FROM (SELECT DISTINCT ON (quiz_access_id) score ... ORDER BY quiz_access_id, finished_at DESC)` |
| 3 | D-03: totalAttempts/finishedCount span ALL sessions (not latest-per-person) | VERIFIED | SQL: `COUNT(*) FROM quiz_sessions WHERE quiz_id = p_quiz_id` (total) и `COUNT(*) ... AND finished_at IS NOT NULL` (finished) — отдельные скалярные subquery без DISTINCT ON |
| 4 | D-04: get_quiz_accuracy accuracy_percent from latest-finished-per-taker only | VERIFIED | CR-01 исправлен в 014: `bool_or(ao.is_correct)` агрегируется в одно boolean per (question, taker) внутри LATERAL, затем COUNT FILTER — каждый тестируемый вносит ровно одну строку |
| 5 | get_quiz_stats payload: totalAttempts, finishedCount, avgScore, totalQuestions, perPerson | VERIFIED | `jsonb_build_object('totalAttempts', ..., 'finishedCount', ..., 'avgScore', ..., 'totalQuestions', ..., 'perPerson', ...)` в 014 строки 33-59 |
| 6 | get_quiz_accuracy payload: question_id, body, order_index, accuracy_percent (без is_correct) | VERIFIED | SELECT q.id AS question_id, q.body, q.order_index, ROUND(...) AS accuracy_percent — is_correct используется только внутри LATERAL, в результирующий SELECT не включён |
| 7 | formatPercent, formatScore, formatShortDateTime экспортированы из 6-shared/lib/format.ts | VERIFIED | format.ts строки 58, 67, 77 — все три функции с `export function` |
| 8 | ProgressBar принимает size prop ('sm' default, 'md') без поломки существующих callers | VERIFIED | ProgressBar.vue: `withDefaults(defineProps<{ value: number; size?: 'sm' \| 'md' }>(), { size: 'sm' })` — h-1/h-2 условно |
| 9 | D-01: /quiz/:id/stats route с requiresAuth; кнопки Статистика на QuizCard и QuizEditorHeader | VERIFIED | router/index.ts строка 21: `{ path: '/quiz/:id/stats', ..., meta: { requiresAuth: true } }`; grep подтвердил "Статистика" в обоих файлах |
| 10 | D-05: isPro из реальной таблицы subscriptions через maybeSingle, null row = Free | VERIFIED | store.ts строки 53-61: `.from('subscriptions').select('plan, status').eq('user_id', ...).maybeSingle()`; `isPro.value = data?.plan === 'pro' && data?.status === 'active'`; при ошибке — throw (WR-04 fix) |
| 11 | D-06: Free owner видит blur overlay без реальных данных; get_quiz_accuracy НЕ вызывается | VERIFIED | store.ts строка 85: `if (isPro.value) { ... rpc('get_quiz_accuracy') ... } else { accuracy.value = null }`; AccuracySection.vue: `v-if="!isPro"` рендерит только 4 skeleton bars + blur overlay |
| 12 | D-07/D-08: карточки/таблица/progress bars без chart library; empty state при 0 попытках | VERIFIED | QuizStatsWidget.vue строка 47-55: `v-else-if="store.stats && store.stats.totalAttempts === 0"` → friendly empty state; D-07 реализован через SummaryCards (grid), ResultsTable (table), AccuracySection (ProgressBar) |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/013_quiz_stats_rpc.sql` | Исходные RPCs | VERIFIED | Содержит оба RPC с ownership check и GRANT |
| `supabase/migrations/014_quiz_stats_rpc_fixes.sql` | CR-01/CR-02/WR-02 fixes | VERIFIED | Переопределяет оба RPC с исправленными телами |
| `src/6-shared/lib/format.ts` | formatPercent, formatScore, formatShortDateTime | VERIFIED | Все три функции экспортированы; formatDuration сохранён |
| `src/6-shared/ui/ProgressBar.vue` | size prop + clamp | VERIFIED | withDefaults size='sm', clampedValue computed |
| `src/4-features/quiz-stats/model/useQuizStatsStore.ts` | Pinia store с Pro gate | VERIFIED | isPro из subscriptions, if (isPro.value) guard, maybeSingle |
| `src/4-features/quiz-stats/ui/SummaryCards.vue` | 3 cards + skeleton | VERIFIED | grid-cols-3, animate-pulse skeletons, formatScore |
| `src/4-features/quiz-stats/ui/ResultsTable.vue` | Per-person table + sort | VERIFIED | sortKey/sortDir, WR-01 numeric sort, WR-02 quiz_access_id key, WR-03 empty row |
| `src/4-features/quiz-stats/ui/AccuracySection.vue` | Pro-gated blur overlay | VERIFIED | backdrop-blur-md, skeleton bars для Free, ProgressBar rows для Pro |
| `src/3-widgets/QuizStatsWidget.vue` | loading/empty/error/data branches | VERIFIED | 4 ветки рендеринга, D-08 empty state |
| `src/2-pages/QuizStatsPage.vue` | Thin assembler | VERIFIED | Только `<QuizStatsWidget />`, 8 строк |
| `src/1-app/router/index.ts` | /quiz/:id/stats route | VERIFIED | requiresAuth, lazy import |
| `src/3-widgets/QuizEditorHeader.vue` | Кнопка Статистика | VERIFIED | grep подтверждён |
| `src/5-entities/quiz/ui/QuizCard.vue` | Кнопка Статистика | VERIFIED | grep подтверждён |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useQuizStatsStore.loadStats` | `supabase.rpc('get_quiz_accuracy')` | `if (isPro.value)` guard | WIRED | store.ts строка 85-92 |
| `QuizStatsWidget` | `useQuizStatsStore` | `onMounted store.loadStats(route.params.id)` | WIRED | QuizStatsWidget.vue строка 14-16 |
| `router/index.ts` | `QuizStatsPage` | `/quiz/:id/stats` + requiresAuth | WIRED | router строка 21 |
| `AccuracySection` | `formatPercent` + `ProgressBar` | import из @shared | WIRED | AccuracySection.vue строки 5-6 |
| `ResultsTable` | `formatScore` + `formatShortDateTime` | import из @shared | WIRED | ResultsTable.vue строка 4 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SummaryCards.vue` | `stats` prop | `useQuizStatsStore.stats` ← `supabase.rpc('get_quiz_stats')` | Да — RPC читает quiz_sessions и questions | FLOWING |
| `ResultsTable.vue` | `rows` prop | `store.stats.perPerson` ← RPC perPerson payload | Да — DISTINCT ON latest finished attempts | FLOWING |
| `AccuracySection.vue` | `accuracy` prop | `store.accuracy` ← `supabase.rpc('get_quiz_accuracy')` (только Pro) | Да — per-question accuracy из session_answers | FLOWING |
| `SummaryCards.vue` | `completionRate` | `store.completionRate` computed из `stats.finishedCount/totalAttempts` | Да — real computed | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — верификация RPC требует live Supabase соединения; статический анализ уже подтвердил все ветки кода.

### Probe Execution

Step 7c: Нет probe-скриптов для этой фазы.

### Requirements Coverage

| Requirement | Source Plan | Описание | Status | Evidence |
|-------------|-------------|----------|--------|----------|
| STATS-01 | 04-01, 04-02 | Владелец видит кол-во попыток, % завершений, средний балл (Free) | SATISFIED | SummaryCards: totalAttempts, completionRate, formatScore(avgScore); RPC get_quiz_stats |
| STATS-02 | 04-01, 04-02 | Владелец видит таблицу результатов по каждому тестируемому (Free) | SATISFIED | ResultsTable: name/score/finished_at, DISTINCT ON latest per taker |
| STATS-03 | 04-01, 04-02 | Pro-пользователь видит точность по каждому вопросу | SATISFIED | AccuracySection Pro branch + get_quiz_accuracy RPC; D-06 gate в store |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/4-features/quiz-stats/model/useQuizStatsStore.ts` | 75, 87 | `supabase as any` casts на RPC-вызовах | INFO | Нет compile-time проверки сигнатур RPC; runtime ошибки не поймает tsc. Запланировано: regenerate database.types.ts после деплоя |
| `src/4-features/quiz-stats/model/useQuizStatsStore.ts` | 112-118 | `$reset()` определён, но не вызывается в onMounted | INFO | При навигации между двумя stats-страницами старые данные мигают до загрузки новых |
| `src/3-widgets/QuizStatsWidget.vue` | 14-16 | Нет watcher на `route.params.id` | INFO | При SPA-навигации /quiz/A/stats → /quiz/B/stats данные не перезагружаются (теоретически; на практике router создаёт новый экземпляр компонента) |
| `src/6-shared/lib/format.ts` | 83 | `formatShortDateTime` использует regex replace на `toLocaleString` | INFO | Хрупко при смене runtime локали; приемлемо для v1 |

Нет TBD/FIXME/XXX/PLACEHOLDER маркеров. Нет необработанных debt-маркеров.

### Human Verification Required

#### 1. Проверка карточек статистики в браузере

**Test:** Войти как владелец теста, открыть `/quiz/:id/stats` для теста с несколькими попытками
**Expected:** Три карточки показывают реальные числа: общее кол-во попыток, процент завершений в %, средний балл в формате "X из Y"
**Why human:** Данные приходят из live Supabase RPC; grep не может подтвердить корректность runtime-payload

#### 2. Pro gate — Free owner

**Test:** Под Free-аккаунтом открыть `/quiz/:id/stats`; открыть Network tab в DevTools
**Expected:** Секция "Точность по вопросам" размыта (`backdrop-blur-md`), реальные проценты не отображаются, видна кнопка "Перейти на Pro"; в Network Tab отсутствует запрос к `get_quiz_accuracy`
**Why human:** Визуальный blur и отсутствие сетевого запроса требуют проверки в браузере

#### 3. Pro gate — Pro owner

**Test:** Убедиться, что в таблице `subscriptions` есть строка с `plan='pro'`, `status='active'` для тестового пользователя; открыть `/quiz/:id/stats`
**Expected:** Секция точности показывает реальные ProgressBar rows с процентами (формат "X,X%")
**Why human:** Требует реальной строки subscriptions; D-05 gate нельзя проверить статически

#### 4. D-08 empty state

**Test:** Открыть `/quiz/:id/stats` для теста с 0 попытками
**Expected:** Страница показывает иконку BarChart3, заголовок "Пока никто не проходил тест" и подсказку — без нулевых карточек и без ошибки
**Why human:** Требует live DB с тестом без попыток

#### 5. Migration 014 применена к live DB

**Test:** В терминале: `supabase migration list`; или в Supabase SQL Editor: `SELECT proname FROM pg_proc WHERE proname IN ('get_quiz_stats','get_quiz_accuracy')`
**Expected:** `migration list` показывает 014_quiz_stats_rpc_fixes как Remote (applied); pg_proc возвращает 2 строки
**Why human:** Применение миграции — runtime-операция; из кодовой базы подтвердить нельзя

#### 6. Кнопки "Статистика" навигируют корректно

**Test:** На странице `/my` нажать "Статистика" на карточке теста; в редакторе теста нажать "Статистика" в header
**Expected:** Оба навигируют на `/quiz/:id/stats` для соответствующего теста
**Why human:** Навигация и параметры маршрута требуют проверки в браузере

### Gaps Summary

Нет блокирующих gap'ов. Все 12 must-have truths верифицированы статическим анализом кода. Четыре INFO-уровня находки из code review (IN-01—IN-04) не являются блокерами для цели фазы.

Единственное условие для перехода к следующей фазе — человеческая проверка применения migration 014 к live DB и визуального соответствия UI требованиям.

---

_Verified: 2026-05-18T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
