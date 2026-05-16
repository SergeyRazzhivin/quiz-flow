---
phase: 01-foundation-auth-and-quiz-editor
plan: "01"
subsystem: scaffold
tags: [vite, vue3, tailwind-v4, fsd, supabase, migrations, rls, auth]
dependency_graph:
  requires: []
  provides:
    - vite-vue-ts-scaffold
    - fsd-skeleton
    - steiger-linter
    - supabase-migrations-001-007
    - rls-dual-policy-set
    - shared-foundation
    - auth-store
    - quiz-entity-api
  affects:
    - 01-02-PLAN.md
    - 01-03-PLAN.md
    - 01-04-PLAN.md
tech_stack:
  added:
    - vite@6.3.5
    - vue@3.5.34
    - typescript@5.8.3
    - tailwindcss@4.3.0
    - "@tailwindcss/vite@4.3.0"
    - pinia@3.0.4
    - vue-router@5.0.7
    - "@supabase/supabase-js@2.105.4"
    - vue-draggable-plus@0.6.1
    - vue-sonner@2.0.9
    - lucide-vue-next@1.0.0
    - vee-validate@4.15.1
    - "@vee-validate/zod@4.15.1"
    - zod@3.24.0
    - radix-vue@1.9.17
    - class-variance-authority@0.7.1
    - steiger@0.5.12
    - vitest@3.1.2
  patterns:
    - FSD numeric-prefix layers (1-app…6-shared) with path aliases
    - Tailwind v4 @import + @theme in main.css (no tailwind.config.js)
    - Supabase RLS dual-policy (owner authenticated + guest anon)
    - (SELECT auth.uid()) subquery form for initPlan optimization
key_files:
  created:
    - package.json
    - vite.config.ts
    - tsconfig.json
    - tsconfig.node.json
    - vitest.config.ts
    - index.html
    - eslint.config.ts
    - steiger.config.ts
    - .env.example
    - .gitignore
    - src/1-app/main.ts
    - src/1-app/App.vue
    - src/1-app/styles/main.css
    - src/1-app/router/index.ts (staged, not yet committed)
    - src/6-shared/api/supabase.ts (staged, not yet committed)
    - src/6-shared/api/database.types.ts (placeholder, staged)
    - src/6-shared/config/env.ts (staged, not yet committed)
    - src/6-shared/types/index.ts (staged, not yet committed)
    - src/6-shared/lib/debounce.ts (staged, not yet committed)
    - src/6-shared/lib/image.ts (staged, not yet committed)
    - src/6-shared/lib/format.ts (staged, not yet committed)
    - src/6-shared/lib/draggable.ts (staged, not yet committed)
    - src/6-shared/lib/utils.ts (staged, not yet committed)
    - src/6-shared/ui/Button.vue (staged, not yet committed)
    - src/6-shared/ui/Input.vue (staged, not yet committed)
    - src/6-shared/ui/Dialog.vue (staged, not yet committed)
    - src/6-shared/ui/Tabs.vue (staged, not yet committed)
    - src/6-shared/ui/TabsList.vue (staged, not yet committed)
    - src/6-shared/ui/TabsTrigger.vue (staged, not yet committed)
    - src/6-shared/ui/TabsContent.vue (staged, not yet committed)
    - src/6-shared/ui/Switch.vue (staged, not yet committed)
    - src/6-shared/ui/Tooltip.vue (staged, not yet committed)
    - src/5-entities/quiz/model.ts (staged, not yet committed)
    - src/5-entities/quiz/api.ts (staged, not yet committed)
    - src/4-features/auth/model/useAuthStore.ts (staged, not yet committed)
    - src/4-features/auth/ui/LoginForm.vue (staged, not yet committed)
    - src/4-features/auth/ui/RegisterForm.vue (staged, not yet committed)
    - src/2-pages/AuthPage.vue (staged, not yet committed)
    - src/2-pages/QuizListPage.vue (staged, not yet committed)
    - src/2-pages/MyQuizListPage.vue (staged, not yet committed)
    - src/2-pages/QuizEditorPage.vue (staged, not yet committed)
    - supabase/config.toml
    - supabase/migrations/001_init_profiles.sql
    - supabase/migrations/002_quizzes.sql
    - supabase/migrations/003_questions_answers.sql
    - supabase/migrations/004_quiz_access.sql
    - supabase/migrations/005_sessions.sql
    - supabase/migrations/006_subscriptions.sql
    - supabase/migrations/007_rls_policies.sql
decisions:
  - fsd/typo-in-layer-name disabled in steiger to support numeric-prefixed layers
  - shadcn-vue CLI failed (ERR_MODULE_NOT_FOUND with Node 20 + vue-metamorph); components hand-crafted using radix-vue + class-variance-authority
  - database.types.ts is a placeholder until supabase db push + gen types runs
metrics:
  duration: "~3 hours"
  completed_date: "2026-05-17"
  tasks_completed: 2
  tasks_total: 6
  files_created: 43
---

# Phase 1 Plan 01: Walking Skeleton Summary

**One-liner:** Vite + Vue 3 + Tailwind v4 + FSD skeleton with Supabase migrations 001-007 and RLS dual-policy set authored; stopped at database apply checkpoint.

## Status: PAUSED at Task 3 (checkpoint:human-verify)

Tasks 1 and 2 are complete and committed. Tasks 3-6 require a real Supabase project with credentials.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold Vite + Vue + Tailwind v4 + FSD + steiger | 5346f18 | package.json, vite.config.ts, tsconfig*, index.html, eslint.config.ts, steiger.config.ts, .env.example, .gitignore, src/1-app/* |
| 2 | Author Supabase migrations 001-007 with RLS | de428b6 | supabase/config.toml, supabase/migrations/001-007 |

## Tasks Remaining (after checkpoint)

| Task | Name | Type |
|------|------|------|
| 3 | Apply migrations via supabase db push | checkpoint:human-verify (BLOCKING) |
| 4 | Shared foundation — supabase client, types, libs, shadcn-vue | auto |
| 5 | Auth slice — store, login/register forms, routing | auto (tdd) |
| 6 | Verify end-to-end Walking Skeleton | checkpoint:human-verify |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn-vue CLI fails on Node 20**
- **Found during:** Task 1 (shared foundation setup)
- **Issue:** `npx shadcn-vue@latest add button` throws `ERR_MODULE_NOT_FOUND: Cannot find module 'magic-string/dist/magic-string.es.mjs'` — a bug in vue-metamorph (shadcn-vue's code transform dep) incompatible with Node 20.20.2
- **Fix:** Installed `radix-vue`, `class-variance-authority`, `clsx`, `tailwind-merge` manually. Hand-crafted Button.vue, Input.vue, Dialog.vue, Tabs.vue, TabsList.vue, TabsTrigger.vue, TabsContent.vue, Switch.vue, Tooltip.vue directly using radix-vue primitives + CVA — equivalent to shadcn-vue output.
- **Files modified:** src/6-shared/ui/* (9 files), package.json
- **Commit:** included in 5346f18 (package.json deps)

**2. [Rule 1 - Bug] steiger fsd/typo-in-layer-name rejects numeric FSD prefixes**
- **Found during:** Task 1 verification
- **Issue:** `steiger ./src` reported 5 errors — "Layer '1-app' potentially contains a typo. Did you mean 'app'?" for all 6 numeric-prefix layer directories.
- **Fix:** Added `'fsd/typo-in-layer-name': 'off'` to steiger.config.ts. This is explicitly documented as Open Question 1 in 01-RESEARCH.md — steiger requires explicit config for numeric prefixes.
- **Files modified:** steiger.config.ts
- **Commit:** included in 5346f18

**3. [Rule 1 - Bug] tsconfig.json path aliases require baseUrl when not relative**
- **Found during:** Task 1 build
- **Issue:** TS5090 "Non-relative paths are not allowed when 'baseUrl' is not set"
- **Fix:** Added `"baseUrl": "."` to tsconfig.json
- **Commit:** included in 5346f18

**4. [Rule 1 - Bug] tsconfig.node.json missing composite:true**
- **Found during:** Task 1 build
- **Issue:** TS6306 "Referenced project must have setting 'composite': true"
- **Fix:** Added `"composite": true` to tsconfig.node.json compilerOptions
- **Commit:** included in 5346f18

## Pre-written Files (awaiting Task 3 checkpoint resume)

The following files were written to make `npm run build` pass (Task 1 acceptance criteria required a clean build), but belong logically to Tasks 4 and 5. They are uncommitted and will be committed when those tasks execute after the checkpoint:

- `src/6-shared/` — complete shared foundation (supabase.ts, env.ts, types/index.ts, lib/*, ui/*)
- `src/5-entities/quiz/` — Quiz model + API
- `src/4-features/auth/` — useAuthStore + LoginForm + RegisterForm
- `src/2-pages/` — AuthPage, QuizListPage, MyQuizListPage, QuizEditorPage
- `src/1-app/router/index.ts` — router with 4 routes + beforeEach guard
- `src/6-shared/api/database.types.ts` — placeholder (to be replaced after `supabase gen types typescript --linked`)

**Note:** `database.types.ts` is a hand-authored placeholder matching the migration schema. After Task 3 (supabase db push + gen types), this file MUST be replaced with the generated output.

## Known Stubs

| File | Location | Reason |
|------|----------|--------|
| `src/6-shared/api/database.types.ts` | Entire file | Placeholder until `supabase gen types typescript --linked` runs after migrations are applied |
| `src/2-pages/MyQuizListPage.vue` | Page body | Stub — Plan 02 builds the full quiz list + CRUD UI |
| `src/2-pages/QuizEditorPage.vue` | Page body | Stub — Plan 02/03 builds the full editor |

## Verification Results

| Check | Result |
|-------|--------|
| `npm run build` | PASS (0 errors) |
| `npx steiger ./src` | PASS (0 violations) |
| All 7 migration files exist | PASS |
| Every migration 001-006 has ENABLE ROW LEVEL SECURITY | PASS |
| 007 contains anon_read_published_quizzes | PASS |
| 007 uses (SELECT auth.uid()) throughout | PASS (11 occurrences) |
| No bare auth.uid() in policy expressions | PASS |
| 003 has answer_options_public view | PASS |
| 003 has no UNIQUE on order_index | PASS |
| 002 settings default includes show_stop_button | PASS |

## Self-Check: PASSED

- Commits 5346f18 and de428b6 confirmed in git log
- All 7 migration files exist in supabase/migrations/
- npm run build exits 0
- npx steiger ./src exits 0
