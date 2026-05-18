---
status: partial
phase: 05-billing
source: [05-VERIFICATION.md]
started: 2026-05-18T17:10:00Z
updated: 2026-05-18T17:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Реальный платёжный round-trip YooKassa
expected: Деплой Edge Functions (`create-payment`, `yookassa-webhook`, `ai-generate-quiz`); установка секретов `YOOKASSA_SHOP_ID`/`YOOKASSA_SECRET_KEY`/`APP_URL`; регистрация webhook URL для `payment.succeeded` в тестовом кабинете YooKassa. Вызов `create-payment` с `{ period: 'monthly' }` возвращает `confirmation_url`; оплата тестовой картой выдаёт Pro (`subscriptions`: `pro / active / ~30 дней`); повторная отправка того же webhook не дублирует грант и не сбрасывает остаток периода.
result: [pending]

### 2. Визуальный обзор страницы /billing
expected: Страница `/billing` показывает две карточки (Free/Pro) с переключателем Помесячно/Ежегодно (490 ₽ / 4 490 ₽), счётчики использования, градиентную CTA; для Pro-пользователя — `ProStatusBanner` с датой окончания и кнопкой «Продлить»; upsell-тост «Перейти на Pro» при блокировке лимита.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
