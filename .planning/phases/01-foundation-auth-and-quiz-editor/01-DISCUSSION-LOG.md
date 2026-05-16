# Phase 1: Foundation, Auth & Quiz Editor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 1-Foundation, Auth & Quiz Editor
**Areas discussed:** Auth flow, Quiz creation entry, Question editor UX, Cover image upload, Component library

---

## Auth Flow

### Post-login/register redirect

| Option | Description | Selected |
|--------|-------------|----------|
| На /my (мои тесты) | Сразу к делу: владелец попадает туда, где будет работать | |
| На / (главная, список тестов) | Переход на публичную главную | ✓ |
| На страницу, с которой перешёл (returnUrl) | returnUrl: если пришёл с /my → после входа вернуть туда | |

**User's choice:** На / (главная, список тестов)

---

### AuthPage structure

| Option | Description | Selected |
|--------|-------------|----------|
| Одна страница, табы либо ссылка переключают режим | SPEC указывает AuthPage.vue → /auth. Одна страница с переключением между формами — проще и меньше маршрутов | ✓ |
| Две страницы: /auth/login и /auth/register | Отдельные URL — удобно для ссылок, но больше маршрутов и дублирование логики | |

**User's choice:** Одна страница, табы либо ссылка переключают режим

---

### Unauthenticated access to /my

| Option | Description | Selected |
|--------|-------------|----------|
| Редирект на /auth | Стандартный route guard. После входа — обратно на /my (returnUrl). Проще всего | ✓ |
| Страница /my отображается, но с приглашением войти | Empty state с кнопкой «Войти» — без перехода. Больше компонентов для поддержки | |

**User's choice:** Редирект на /auth (Recommended)

---

### Auth form elements

| Option | Description | Selected |
|--------|-------------|----------|
| Минимально: email + пароль + кнопка | Никаких лишних полей. Показать/скрыть пароль — достаточно для v1 | ✓ |
| Добавить поле full_name при регистрации | Имя сразу заполняет profiles.full_name. Можно сделать необязательным | |
| Только показать/скрыть пароль (без full_name) | То же, что Recommended, без дополнительных полей | |

**User's choice:** Минимально: email + пароль + кнопка (Recommended)

---

## Quiz Creation Entry

### "New Quiz" button behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Сразу создаёт в БД + редирект в редактор | Клик → INSERT quizzes (название по умолчанию «Без названия») → router.push('/editor/:id'). Название редактируется в хедере редактора | ✓ |
| Мини-модалька с полем названия | Попап: введи название теста → кнопка «Создать» → редирект. Слегка больше кликов | |

**User's choice:** Сразу создаёт в БД + редирект в редактор (Recommended)

---

### Quiz list layout

| Option | Description | Selected |
|--------|-------------|----------|
| Карточки | Каждый тест — карточка с обложкой (если есть), названием, статусом (draft/published), количеством вопросов. Сохраняет стиль app.promto.ai | ✓ |
| Таблица со строками | Плотное отображение, удобно для большого количества тестов | |

**User's choice:** Карточки (Recommended)

---

### Delete quiz confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Конфирм-диалог перед удалением | Тест с вопросами — ошибиться нельзя. Простой window.confirm или кастомный модал | ✓ |
| Прямое удаление + undo-тост | Оптимистичное удаление с таймером отмены. Сложнее в реализации | |
| Без подтверждения | Просто и быстро. Допустимо только если удаление обратимо | |

**User's choice:** Конфирм-диалог перед удалением (Recommended)

---

### Empty state on /my

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state: иллюстрация + текст + CTA-кнопка | Например: иконка-заглушка + «У вас пока нет тестов» + кнопка «Создать первый». Снижает барьер входа | ✓ |
| Просто кнопка «+ Новый тест» без оформленного empty state | Минимально, но страница просто пустая | |

**User's choice:** Empty state: иллюстрация + текст + CTA-кнопка (Recommended)

---

### Home page / layout

| Option | Description | Selected |
|--------|-------------|----------|
| Тот же карточный вид, что и /my | QuizCard компонент повторно используется. Разница — нет действий редактирования/удаления | ✓ |
| Более просторный hero-лейаут | Крупные карточки с другим отношением сторон. Новый компонент | |

**User's choice:** Тот же карточный вид, что и /my (Recommended)

---

## Question Editor UX

### Question expand/collapse

| Option | Description | Selected |
|--------|-------------|----------|
| Всегда развёрнуты | Все вопросы видны сразу, скроллить по списку. Проще редактировать, не нужно открывать перед изменением | ✓ |
| Аккордеон: клик разворачивает вопрос | Удобно при многих вопросах, но добавляет сложность: нужно кликать перед редактированием | |

**User's choice:** Всегда развёрнуты (Recommended)

---

### Auto-scroll on add question

| Option | Description | Selected |
|--------|-------------|----------|
| Авто-скролл вниз + фокус на новом вопросе | Новый вопрос аппендится в конец списка, страница скроллится до него, фокус на textarea. Плавно | ✓ |
| Без авто-скролла | Вопрос добавляется, пользователь вручную скроллит до него | |

**User's choice:** Авто-скролл вниз + фокус на новом вопросе (Recommended)

---

### Delete confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Вопрос — подтверждение, вариант — без (Recommended) | Удалить весь вопрос со всеми ответами — конфирм. Удалить один вариант из 2+ — сразу (checkmark возле каждого) | |
| Оба действия без подтверждения | Быстро, но легко случайно удалить вопрос со многими вариантами ответа | ✓ |

**User's choice:** Оба действия без подтверждения

---

### Error/notification display

| Option | Description | Selected |
|--------|-------------|----------|
| Toast-уведомления | Попадают в угол (как в promto.ai), не перекрывают интерфейс. Одна система для всех страниц | ✓ |
| Инлайн под полем | Ошибка появляется прямо под полем. Удобно для форм регистрации/входа | |

**User's choice:** Toast-уведомления (Recommended)

**Notes:** Инлайн-ошибки для форм auth (invalid credentials и т.п.) можно реализовать дополнительно. Toast — основная система уведомлений.

---

### Validation timing

| Option | Description | Selected |
|--------|-------------|----------|
| Минимум 2 варианта, один обязательно правильный (валидация при публикации) | Валидация при публикации, не при сохранении. Тест можно сохранять в любом состоянии | ✓ |
| Сразу валидировать при сохранении | Ошибка сразу если не хватает вариантов. Больше трения | |

**User's choice:** Минимум 2 варианта, один обязательно правильный (Recommended)

---

## Cover Image Upload

### Upload zone UX

| Option | Description | Selected |
|--------|-------------|----------|
| Кликабельная зона + drag-and-drop | Зона с иконкой и текстом «Нажмите или перетащите файл». Стандарт для русскоязычных сервисов | ✓ |
| Только кнопка/иконка (file input) | Проще, но drag-and-drop не работает | |

**User's choice:** Кликабельная зона + drag-and-drop (Recommended)

---

### Empty state placeholder

| Option | Description | Selected |
|--------|-------------|----------|
| Плейсхолдер-зона с иконкой + текст «Добавить обложку» | Визуально чисто, явно зовёт действовать | ✓ |
| Пустая область (только рамка) | Минимально, но менее ясно | |
| Градиентный цветовой плейсхолдер | violet→indigo градиент бренда как фон. Сохраняет визуальный ритм | |

**User's choice:** Плейсхолдер-зона с иконкой + текст «Добавить обложку» (Recommended)

---

### Upload timing

| Option | Description | Selected |
|--------|-------------|----------|
| Сразу загрузить в Storage + сохранить URL | Без промежуточного превью. Загруженная обложка сразу отображается в зоне. Проще | ✓ |
| Показать превью сначала, затем кнопка «Сохранить» | Пользователь может отменить выбор перед загрузкой. Сложнее в реализации | |

**User's choice:** Сразу загрузить в Storage + сохранить URL (Recommended)

---

### Format and size limits

| Option | Description | Selected |
|--------|-------------|----------|
| JPEG/PNG/WebP, макс 5 МБ, резин до 1280px на клиенте | SPEC указывает «до 1280px». Валидация на клиенте, затем загрузка оригинала | ✓ |
| Без ограничений | Проще, но можно загрузить гигантский файл | |

**User's choice:** JPEG/PNG/WebP, макс 5 МБ, резин до 1280px на клиенте (Recommended)

---

## Component Library

### UI component approach

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn-vue | Headless + Tailwind-first, копируем исходники к себе. Полное совпадение с Tailwind CSS v4. Диалоги, Select, Combobox, Tabs уже готовы | ✓ |
| Pure Tailwind (без библиотеки) | Всё вручную: максимум контроля, но Dropdown/Dialog/Select — много работы | |
| Element Plus / PrimeVue | Готовые компоненты с дизайном Material или другим. Конфликтует с Tailwind, требует override стилей | |

**User's choice:** shadcn-vue (Recommended)

---

## Claude's Discretion

- Auto-save debounce interval for quiz metadata (500ms recommended in research)
- Exact toast library (radix-vue toast vs vue-sonner — both shadcn-vue compatible)
- Icon set (Lucide is standard with shadcn-vue)
- Toggle vs Switch component for publish state in editor header

## Deferred Ideas

None — discussion stayed within Phase 1 scope.
