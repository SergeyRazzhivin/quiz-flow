# Quiz Flow — Project Guide

## Project

Quiz Flow — сервис для создания и прохождения тестов с AI-генерацией вопросов.

See: [.planning/PROJECT.md](.planning/PROJECT.md)

**Core value:** Пользователь загружает текст — AI генерирует готовый тест за секунды, который можно сразу отправить тестируемым.

---

## Stack

- **Frontend:** Vite + Vue 3 (script setup) + TypeScript + Tailwind CSS v4
- **State:** Pinia | **Routing:** Vue Router 4
- **Architecture:** FSD (Feature-Sliced Design, числовые префиксы 1-app … 6-shared)
- **Backend:** Supabase (Auth, PostgreSQL, Storage, Edge Functions)
- **AI:** OpenAI API — только через Supabase Edge Functions, не с клиента
- **Payments:** ЮKassa

---

## Architecture: FSD Import Rules

```
src/
├── 1-app/      — только app init
├── 2-pages/    — импорт из 3–6
├── 3-widgets/  — импорт из 4–6
├── 4-features/ — импорт из 5–6
├── 5-entities/ — импорт из 6
└── 6-shared/   — только внутри себя
```

**Critical rules:**
- `5-entities` — domain nouns (data shapes, API fetchers, thin display components). No business logic.
- `4-features` — domain verbs (Pinia stores, side effects, form logic). No feature-to-feature imports.
- `3-widgets` — the ONLY layer that can compose multiple feature slices.
- `2-pages` — thin assemblers only (~80 lines max). No domain logic.
- `6-shared` — generic UI, Supabase singleton, utilities with NO domain knowledge.

---

## GSD Workflow

This project uses [GSD (Get Shit Done)](https://github.com/get-shit-done/get-shit-done) for structured development.

**Planning artifacts:**
- [.planning/ROADMAP.md](.planning/ROADMAP.md) — 5 phases, 48 requirements
- [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) — full requirement list
- [.planning/STATE.md](.planning/STATE.md) — current phase status
- [.planning/research/](.planning/research/) — domain research (stack, features, architecture, pitfalls)

**Workflow commands:**
```
/gsd:plan-phase 1    — plan Phase 1 (Foundation, Auth & Quiz Editor)
/gsd:execute-phase 1 — execute the plan
/gsd:verify-work 1   — verify phase goals were met
/gsd:progress        — check current status
```

**Current status:** Phase 1 not started. Run `/gsd:plan-phase 1` to begin.

---

## Phases

| # | Phase | Requirements | Status |
|---|-------|--------------|--------|
| 1 | Foundation, Auth & Quiz Editor | AUTH, QUIZ, EDIT, NAV (20 reqs) | Not started |
| 2 | Quiz Taking & Sharing | TAKE, SHARE (13 reqs) | Not started |
| 3 | AI Wizard | AI (7 reqs) | Not started |
| 4 | Statistics | STATS (3 reqs) | Not started |
| 5 | Billing | PAY (5 reqs) | Not started |

---

## Key Constraints

1. **OpenAI never called from client** — only via Supabase Edge Functions
2. **Quiz-takers have no Supabase Auth** — guest access via `quiz_access` token + Edge Function JWT
3. **RLS must cover both owner (authenticated) and guest (anon) roles** — separate policy families
4. **Freemium limits enforced at DB/Edge Function level** — client-side checks are UX only
5. **FSD layer discipline** — steiger linter enforces import rules in CI

## Critical Pitfalls to Avoid

- Timer drift: compute from server `started_at`, not client-side decrement
- Answer loss on refresh: upsert each answer immediately on selection
- `is_correct` and `password_hash` must never reach anon-role clients — `answer_options` and `quiz_access` have no `anon` RLS policy at all (anon cannot read those tables), and guest reads of options go through the `answer_options_public` view (no `is_correct` column). Edge Functions use `service_role` and must hand-filter sensitive columns.
- Array index as DnD key: always use entity UUID
- `order_index` not persisted after drag: batch upsert in `@end` handler
- ЮKassa webhook idempotency: check `yookassa_payment_id` before processing

See full details in [.planning/research/PITFALLS.md](.planning/research/PITFALLS.md).
