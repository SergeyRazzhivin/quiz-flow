---
status: partial
phase: 04-statistics
source: [04-VERIFICATION.md]
started: 2026-05-18
updated: 2026-05-18
---

## Current Test

[awaiting human testing]

## Tests

### 1. Карточки сводки в браузере
expected: Страница статистики показывает реальные данные из live RPC get_quiz_stats — total attempts, completion rate (%), average score — без заглушек/скелетонов после загрузки.
result: [pending]

### 2. Pro gate — Free owner
expected: Free-владелец видит секцию accuracy с blur-оверлеем и upgrade CTA; вызов get_quiz_accuracy ОТСУТСТВУЕТ в Network-вкладке (реальные числа не загружаются).
result: [pending]

### 3. Pro gate — Pro owner
expected: При строке subscriptions с plan='pro' владелец видит accuracy-бары с реальными процентами для каждого вопроса; ни один процент не превышает 100%.
result: [pending]

### 4. Empty state (D-08)
expected: Для теста без попыток виджет показывает дружелюбное сообщение («Пока никто не проходил тест»), а не пустую таблицу или ошибку.
result: [pending]

### 5. Migration 014 применена к live DB
expected: `npx supabase migration list` показывает 014 в колонке Remote; обе функции get_quiz_stats / get_quiz_accuracy обновлены.
result: [pending]

### 6. Навигация кнопок «Статистика»
expected: Кнопка «Статистика» в QuizEditorHeader и в QuizCard ведёт на корректный маршрут /quiz/:id/stats.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
