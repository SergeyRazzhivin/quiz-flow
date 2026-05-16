# Quiz Flow

## What This Is

Quiz Flow — сервис для создания и прохождения тестов с поддержкой AI-генерации вопросов на основе документации, книг или произвольного текста. Владельцы создают тесты через удобный редактор или AI-визард, затем делятся ими по индивидуальным ссылкам с логином и паролем. Тестируемые проходят тесты без регистрации; результаты доступны владельцу в статистике.

## Core Value

Пользователь загружает текст — AI генерирует готовый тест за секунды, который можно сразу отправить тестируемым.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Регистрация и вход по email + password
- [ ] Создание, редактирование и публикация тестов (конструктор)
- [ ] DnD-сортировка вопросов
- [ ] Типы вопросов: single / multiple choice
- [ ] AI-генерация вопросов (4-шаговый визард, OpenAI через Supabase Edge Functions)
- [ ] Загрузка обложки теста в Supabase Storage
- [ ] Индивидуальные ссылки доступа (token + login + password)
- [ ] Прохождение теста без авторизации на сайте
- [ ] Таймер прохождения (time_limit_sec)
- [ ] Навигация: назад/вперёд/стоп, переключатель «Разрешить возврат»
- [ ] Сохранение ответов (quiz_sessions + session_answers)
- [ ] Страница результата прохождения
- [ ] Статистика теста для владельца
- [ ] Freemium-модель: Free (3 теста, 10 вопросов, 1 AI/мес) и Pro (всё безлимит, 490 ₽/мес)
- [ ] Интеграция с ЮKassa для оплаты подписки

### Out of Scope

- Мобильное приложение — веб-first, мобильный клиент не запланирован
- Командная работа / совместное редактирование — усложняет MVP
- Встроенный чат или комментарии — не core value
- Экспорт тестов в PDF/Word — может быть добавлен позже
- Прохождение тестов авторизованными пользователями Supabase — только через quiz_access token

## Context

- **Архитектура:** FSD (Feature-Sliced Design) с числовыми префиксами слоёв (1-app, 2-pages, 3-widgets, 4-features, 5-entities, 6-shared). Правила импорта строго сверху вниз.
- **Backend:** Supabase — Auth, PostgreSQL, Storage, Edge Functions. Тестируемые работают через токен без Supabase Auth (RLS через quiz_access).
- **AI:** OpenAI API вызывается из Edge Functions, ответ — JSON со структурой теста.
- **Дизайн:** Вдохновение от app.promto.ai — минимализм, чистые карточки. Tailwind CSS + CSS custom properties (light/dark). Градиентные CTA-кнопки (`from-violet-600 to-indigo-600`). Шрифт Inter.
- **Payments:** ЮKassa — российский платёжный провайдер.
- **Миграции:** 7 файлов в `supabase/migrations/` (001–007).

## Constraints

- **Tech Stack**: Vue 3 (script setup, Composition API) + TypeScript + Tailwind CSS + Pinia + Vue Router 4 — зафиксирован спецификацией
- **Architecture**: FSD с числовыми префиксами, импорты строго сверху вниз — отступление не допускается
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Edge Functions) — зафиксирован
- **AI Provider**: OpenAI API — только через Supabase Edge Functions, не напрямую с клиента
- **Payments**: ЮKassa — российский рынок, без Stripe
- **Auth model**: Тестируемые проходят тест без Supabase Auth — только через quiz_access токен + login/password hash

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Тестируемые без Supabase Auth | RLS работает через quiz_access token; не нужен аккаунт для прохождения теста | — Pending |
| AI через Edge Functions | OpenAI ключ не утекает на клиент | — Pending |
| ЮKassa вместо Stripe | Российский рынок и рубли | — Pending |
| FSD архитектура | Масштабируемая структура, чёткие границы слоёв | — Pending |
| Freemium модель | Монетизация без барьера входа для новых пользователей | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-16 after initialization*
