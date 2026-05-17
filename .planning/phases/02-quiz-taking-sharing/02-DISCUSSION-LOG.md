# Phase 2: Quiz Taking & Sharing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 02-quiz-taking-sharing
**Areas discussed:** Guest entry & intro, Taking screen, Result page, Access link management, Scoring

---

## Guest Entry & Intro

| Option | Description | Selected |
|--------|-------------|----------|
| Интро + форма вместе | Title/description/cover and the login form on one screen | ✓ |
| Сначала логин | Login form first, intro shown after authentication | |

| Option | Description | Selected |
|--------|-------------|----------|
| Полное интро | Title, description, cover, question count, time limit | ✓ |
| Минимум | Title and cover only | |

| Option | Description | Selected |
|--------|-------------|----------|
| По кнопке «Начать» | Session + timer start when the guest presses "Начать" | ✓ |
| Сразу после логина | Session + timer start on successful login | |

| Option | Description | Selected |
|--------|-------------|----------|
| Одна попытка | Finished → show result; in-progress → resume | (basis) |
| Каждый раз заново | Re-open always restarts the quiz | |

**User's choice:** Intro + form together; full intro; timer starts on "Начать". For re-open behavior the user asked for an owner-configurable setting instead of a fixed rule.
**Notes:** User directed that single-vs-multiple attempts be an owner setting per quiz (pulls EXT-04 from v2 into Phase 2). Re-open logic finalized in D-04: in-progress → resume; expired → auto-submit; finished depends on the attempt setting.

---

## Taking Screen

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky-шапка | Fixed header: progress + bar left, timer right | ✓ |
| Только прогресс сверху | Progress in header, timer floating in a corner | |

| Option | Description | Selected |
|--------|-------------|----------|
| С подтверждением | "Стоп" → confirmation dialog → finish → result | ✓ |
| Без подтверждения | "Стоп" finishes immediately | |

| Option | Description | Selected |
|--------|-------------|----------|
| Проверка при завершении | Free navigation; warn about skipped required at finish | |
| Блок перехода | Cannot advance past an unanswered required question | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Авто-сабмит + уведомление | "Время вышло" notice → auto-submit → result | ✓ |
| Сразу на результат | Instant redirect to result on zero | |

**User's choice:** Sticky header; "Стоп" with confirmation; required questions block navigation; timer expiry shows a notice then auto-submits.
**Notes:** User added that a time limit is optional — the timer and auto-submit are conditional on `time_limit_sec` (already supported by the nullable column). Captured as D-09.

---

## Result Page

| Option | Description | Selected |
|--------|-------------|----------|
| Балл + процент | Score, percentage, taker name, neutral message | ✓ |
| + пройдено/нет | Add a pass/fail threshold | |

| Option | Description | Selected |
|--------|-------------|----------|
| Только итог | Score + percentage, no breakdown | ✓ |
| Верно/неверно по вопросам | Per-question right/wrong, no correct answers shown | |
| Полный разбор | Questions + guest answer + correct answer | |

| Option | Description | Selected |
|--------|-------------|----------|
| Ссылка на Quiz Flow | Link to the public home page | ✓ |
| Тупик | Just the result, no further action | |

**User's choice:** Score + percentage only; no per-question breakdown; a link to Quiz Flow home.
**Notes:** Pass/fail threshold declined. Showing correct answers stays v2 (QA-02).

---

## Access Link Management

| Option | Description | Selected |
|--------|-------------|----------|
| Модалка из редактора | "Ссылки доступа" button in the editor header → modal | ✓ |
| Отдельная страница | A dedicated route for link management | |

| Option | Description | Selected |
|--------|-------------|----------|
| Авто-генерация | System generates login + password | ✓ |
| Ввод вручную | Owner types login + password | |

| Option | Description | Selected |
|--------|-------------|----------|
| Блок для копирования | Link + login + password as one copyable block | ✓ |
| Отдельные поля | Link, login, password as separate copyable rows | |

| Option | Description | Selected |
|--------|-------------|----------|
| + статус прохождения | Name, login, expiry + completion status | |
| Без статуса | Name, login, expiry + delete only | ✓ |

**User's choice:** Modal from the editor; auto-generated credentials; copyable block on creation; link list without completion status.
**Notes:** Plaintext password is shown only at creation (only `password_hash` is stored). Completion status deferred to Phase 4.

---

## Scoring

| Option | Description | Selected |
|--------|-------------|----------|
| Всё-или-ничего | Point only if the exact correct set is selected | |
| Частичный балл | Fractional score for partially correct answers | ✓ |

**User's choice:** Partial credit.
**Notes:** Formula proposed and accepted: `max(0, (correct_selected − incorrect_selected) / total_correct)` per question. Implies `quiz_sessions.score` changes from `int` to `numeric` (D-18).

---

## Claude's Discretion

- Exact Russian copy for guest-facing messages, dialogs, and notices
- Visual styling within the dark theme + orange accent system
- Edge Function internal structure and custom-JWT handling
- Progress bar treatment and the "timer red in final 20%" styling

## Deferred Ideas

- Per-question breakdown / showing correct answers on the result page → v2 (QA-02)
- Pass/fail threshold on the result page → declined
- Completion status in the access-link list → Phase 4 (statistics)
- Multiple-attempt aggregation → Phase 4
- Pro-gating of access links → Phase 5 (freemium enforcement)
