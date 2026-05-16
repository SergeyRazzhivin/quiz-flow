# Phase 1: Foundation, Auth & Quiz Editor — Research

**Researched:** 2026-05-16
**Domain:** Vue 3 / Vite / Supabase / FSD — greenfield project setup, auth, quiz editor CRUD
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** After successful login OR registration → redirect to `/` (public quiz list, not `/my`)
- **D-02:** AuthPage is a single route `/auth` with toggle (tabs/link) between login and register — not separate routes
- **D-03:** Unauthenticated user accessing `/my` or `/editor/:id` → route guard redirects to `/auth?returnUrl=...`; after successful auth → return to original destination
- **D-04:** Auth form: email + password + submit only. No `full_name`, no "Remember me", no OAuth
- **D-05:** "New Quiz" button on `/my` → immediately `INSERT INTO quizzes` (default title "Без названия") → `router.push('/editor/:id')`. No modal
- **D-06:** Both `/` and `/my` use the same card grid layout with a shared `QuizCard` component. `/my` cards have edit/delete actions; `/` cards do not
- **D-07:** Delete quiz → custom confirmation dialog before `DELETE`. `window.confirm` acceptable for v1 but Dialog used for consistent styling
- **D-08:** Empty state on `/my` for new users: illustration/icon + "У вас пока нет тестов" + "Создать первый тест" CTA
- **D-09:** Questions in editor are always expanded (never collapsible). Scrollable body handles overflow
- **D-10:** "Add question" → appended to end, page auto-scrolls to it, textarea receives focus
- **D-11:** Delete question → confirmation dialog. Delete answer option → no confirmation (immediate)
- **D-12:** All error and success feedback uses a toast notification system (auth errors, save errors, publish success, etc.)
- **D-13:** Question validation (min 2 options, ≥1 correct) enforced at **publish time**, not at auto-save time
- **D-14:** Cover upload zone: click-to-open file picker AND drag-and-drop
- **D-15:** No cover: placeholder zone with icon + "Добавить обложку" (no gradient background)
- **D-16:** After file selection → upload immediately to Supabase Storage, save `cover_url` to quiz. No preview-then-confirm
- **D-17:** Accepted formats: JPEG/PNG/WebP. Max 5 MB. Resize to max 1280px wide on client before uploading. Path: `covers/{owner_id}/{quiz_id}/{uuid}.{ext}`
- **D-18:** Use **shadcn-vue** as UI component foundation (source-copy approach). Tailwind CSS v4 compatible. Provides: Button, Dialog, Tabs, Input, Select, Toggle, Tooltip, Toast

### Claude's Discretion

- Auto-save debounce interval (500ms recommended)
- Exact toast library choice (vue-sonner recommended — simpler setup than radix-vue's own toast)
- Specific icon set (Lucide is standard with shadcn-vue)
- Whether publish toggle uses `<Toggle>` or `<Switch>` from shadcn-vue

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Пользователь может зарегистрироваться по email и паролю | Supabase `auth.signUp()` in `useAuthStore` |
| AUTH-02 | Пользователь может войти по email и паролю и оставаться в системе после перезагрузки | `auth.signInWithPassword()` + `onAuthStateChange` persists session |
| AUTH-03 | Пользователь может выйти из аккаунта с любой страницы | `auth.signOut()` in AppHeader, triggered from `useAuthStore` |
| QUIZ-01 | Пользователь может создать новый тест с названием, описанием, обложкой и лимитом времени | INSERT into `quizzes`, `useQuizEditorStore` |
| QUIZ-02 | Пользователь может редактировать метаданные теста | Auto-save with 500ms debounce in `useQuizEditorStore` |
| QUIZ-03 | Пользователь может публиковать и снимать тест с публикации | `is_published` flag UPDATE, publish-time validation |
| QUIZ-04 | Пользователь может видеть список своих тестов на `/my` | `fetchMyQuizzes()` in `5-entities/quiz/api.ts` |
| QUIZ-05 | Пользователь может видеть список опубликованных тестов на главной `/` | `fetchPublishedQuizzes()` anon SELECT |
| QUIZ-06 | Пользователь может удалить свой тест | DELETE with confirmation dialog |
| QUIZ-07 | Обложка загружается в Supabase Storage | `storage.from('covers').upload(path, file)` |
| EDIT-01 | Пользователь может добавлять вопросы | INSERT into `questions` |
| EDIT-02 | Пользователь может редактировать текст вопроса и тип | UPDATE `questions.body` and `type` |
| EDIT-03 | Пользователь может отмечать вопрос как обязательный/необязательный | UPDATE `questions.is_required` |
| EDIT-04 | Пользователь может добавлять, редактировать, удалять варианты ответов | CRUD on `answer_options` |
| EDIT-05 | Пользователь может отмечать варианты как правильные | UPDATE `answer_options.is_correct` |
| EDIT-06 | Пользователь может менять порядок вопросов через DnD | `vue-draggable-plus`, batch upsert `order_index` in `@end` handler |
| EDIT-07 | Пользователь может удалять вопросы | DELETE with confirmation |
| EDIT-08 | Редактор: фиксированный header, скроллируемый body, фиксированный footer | CSS Grid `grid-template-rows: auto 1fr auto; height: 100dvh` |
| NAV-01 | Настройка кнопок навигации для тестируемого | `settings.show_stop_button` in `quizzes.settings` JSONB |
| NAV-02 | Включать/выключать возврат к предыдущему вопросу | `settings.allow_back` in `quizzes.settings` JSONB |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield project startup that must deliver the full editorial surface for quiz creation. It establishes all foundational infrastructure — project scaffold, FSD layer structure, Supabase migrations with RLS, auth flow, and the quiz editor — in a single walking skeleton vertical slice.

The project has unusually rich pre-existing research context. ARCHITECTURE.md defines the FSD layer mapping and exact component hierarchy. PITFALLS.md documents the most dangerous failure modes (RLS dual-policy, DnD `order_index`, cover upload path collisions, FSD drift). STACK.md resolves every library choice with versions. UI-SPEC.md provides the visual and interaction contract down to copy strings. The research task for this phase is primarily synthesis and verification, not discovery.

The critical insight for planning is the **walking skeleton build order**: the planner must not assign UI tasks before the Supabase migrations and `6-shared` foundation exist. Auth must come before quiz editor. The FSD layer structure must be scaffolded before any feature code is written, because steiger enforces import rules and will fail CI if layers are added out of order.

**Primary recommendation:** Build in strict wave order — infrastructure (Vite scaffold + Tailwind + FSD skeleton + steiger) → migrations 001–007 + RLS → 6-shared foundation → auth feature → quiz list pages → quiz editor feature. Do not parallelize across waves.

---

## Project Constraints (from CLAUDE.md)

| Directive | Category | Constraint |
|-----------|----------|------------|
| OpenAI never called from client | Security | All AI calls via Supabase Edge Functions only |
| Quiz-takers have no Supabase Auth | Architecture | Guest access via `quiz_access` token + Edge Function JWT |
| RLS must cover both owner and guest roles | Security | Separate policy families: `TO authenticated` and `TO anon` |
| Freemium limits enforced at DB/Edge Function level | Architecture | Client-side checks are UX only |
| FSD layer discipline enforced | Architecture | steiger linter in CI from day one |
| Stack is fixed | Stack | Vite + Vue 3 + TypeScript + Tailwind CSS v4 + Pinia + Vue Router 4 + Supabase + FSD |
| Numeric FSD prefixes | Architecture | `1-app` through `6-shared` — not `app/`, `pages/`, etc. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth session persistence | `4-features/auth` (Pinia store) | `6-shared/api/supabase.ts` | `onAuthStateChange` runs in store init; singleton client lives in shared |
| Route guarding | `1-app/router` | `4-features/auth` | `beforeEach` hook in app layer; reads `useAuthStore` |
| Quiz CRUD API calls | `5-entities/quiz/api.ts` | `6-shared/api/supabase.ts` | Entity layer owns API fetchers; no business logic |
| Quiz editor state + auto-save | `4-features/quiz-editor` (Pinia store) | `5-entities/quiz/api.ts` | Business verb (editing) belongs in features; entity provides raw API |
| Question/answer CRUD | `5-entities/question/api.ts`, `5-entities/answer-option/api.ts` | `4-features/quiz-editor` store | Entity layer provides API functions; store orchestrates |
| DnD reordering + order_index persistence | `4-features/quiz-editor` store | `5-entities/question/api.ts` | Side effect (batch upsert after drag) = feature concern |
| Cover image upload + resize | `4-features/quiz-editor` store | `6-shared/api/supabase.ts` (Storage) | Upload logic is a side effect; canvas resize happens before upload |
| Page assembly | `2-pages` | `3-widgets` | Pages are thin (~80 lines); widgets compose features |
| Shared UI components (Button, Input, etc.) | `6-shared/ui` | — | shadcn-vue components live here; zero domain knowledge |
| Supabase client singleton | `6-shared/api/supabase.ts` | — | Single import point for all entity and feature layers |
| Database schema + RLS | `supabase/migrations/` | — | Separate concern; all 7 migration files in Phase 1 |
| Toast notifications | `6-shared/ui` (vue-sonner provider in `1-app`) | `4-features/*` (consumers) | Provider mounted once in App.vue; features call `toast()` |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | 3.5.34 | Framework | Project constraint [VERIFIED: npm registry] |
| vite | latest | Build tool | Project constraint [ASSUMED] |
| @vitejs/plugin-vue | latest | Vite Vue plugin | Required for `.vue` SFC support [ASSUMED] |
| typescript | latest | Type safety | Project constraint [ASSUMED] |
| tailwindcss | 4.3.0 | Utility CSS | Project constraint; v4 breaking changes apply [VERIFIED: npm registry] |
| @tailwindcss/vite | 4.3.0 | Vite integration for Tailwind v4 | Replaces PostCSS approach in v4 [VERIFIED: npm registry] |
| pinia | 3.0.4 | State management | Project constraint [VERIFIED: npm registry] |
| vue-router | 5.0.7 | Routing | Project constraint — note: npm shows v5 but Vue Router 4.x series for Vue 3 [VERIFIED: npm registry] |
| @supabase/supabase-js | 2.105.4 | Supabase client | Project constraint [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vue-draggable-plus | 0.6.1 | DnD for question reordering | Phase 1 editor (decided in SPEC.md) [VERIFIED: npm registry] |
| vue-sonner | 2.0.9 | Toast notifications | Simpler than radix-vue's own toast; pairs with shadcn-vue [VERIFIED: npm registry] |
| lucide-vue-next | 1.0.0 | Icons | Standard with shadcn-vue; consistent icon set [VERIFIED: npm registry] |
| vee-validate | 4.15.1 | Form validation | Auth form, quiz metadata form [VERIFIED: npm registry] |
| @vee-validate/zod | 4.15.1 | Zod schema adapter for vee-validate | Pairs with vee-validate [VERIFIED: npm registry] |
| zod | 3.x (latest 4.4.3) | Schema validation | Used with vee-validate AND Edge Function validation [VERIFIED: npm registry] |
| steiger | 0.5.12 | FSD import rule linter | Official FSD linter; enforces layer hierarchy [VERIFIED: npm registry] |
| eslint | 10.4.0 | Linting | Project quality gate [VERIFIED: npm registry] |
| @vue/eslint-config-typescript | 14.7.0 | TypeScript ESLint for Vue | Required with ESLint v9 flat config [VERIFIED: npm registry] |
| vitest | 4.1.6 | Unit testing | Vue ecosystem standard [VERIFIED: npm registry] |
| @vue/test-utils | 2.4.10 | Vue component testing | Official Vue testing library [VERIFIED: npm registry] |
| @pinia/testing | 1.0.3 | Pinia test utilities | Stubs actions automatically [VERIFIED: npm registry] |
| happy-dom | 20.9.0 | Test DOM environment | Faster than jsdom [VERIFIED: npm registry] |

> **Note on shadcn-vue:** shadcn-vue is NOT installed as an npm dependency. It is a source-copy system — components are copied directly into the project via `npx shadcn-vue@latest add <component>`. The `shadcn-vue` npm package (v2.7.3 on registry) is the CLI tool, not a runtime dependency.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vue-draggable-plus | vue.draggable.next | `vue.draggable.next` is unmaintained (no npm v4 release since 2021); `vue-draggable-plus` is the maintained successor [CITED: STACK.md] |
| vue-sonner | radix-vue Toast | vue-sonner has simpler Vue 3 setup; radix-vue toast requires more boilerplate with shadcn-vue [CITED: UI-SPEC.md] |
| vee-validate + zod | vuelidate | vee-validate v4's `defineField` composable is canonical; `vuelidate` has weaker TypeScript support [CITED: STACK.md] |
| steiger | eslint-plugin-boundaries | steiger is the official FSD tool; purpose-built for FSD layer rules [CITED: PITFALLS.md] |
| happy-dom | jsdom | happy-dom is ~5× faster for simple component tests [CITED: STACK.md] |

**Installation (production dependencies):**
```bash
npm install vue pinia vue-router @supabase/supabase-js vue-draggable-plus vue-sonner lucide-vue-next vee-validate @vee-validate/zod zod
```

**Installation (dev dependencies):**
```bash
npm install -D vite @vitejs/plugin-vue typescript tailwindcss @tailwindcss/vite steiger eslint @vue/eslint-config-typescript vitest @vue/test-utils @pinia/testing happy-dom
```

**shadcn-vue component initialization:**
```bash
npx shadcn-vue@latest init
npx shadcn-vue@latest add button input dialog tabs switch tooltip
```

---

## Package Legitimacy Audit

> slopcheck was not available at research time. All packages are tagged by source provenance below.

| Package | Registry | Age | Source Repo | Provenance | Disposition |
|---------|----------|-----|-------------|------------|-------------|
| vue-draggable-plus | npm | ~3 yr (created 2023-03-23, last update 2026-01) | github.com/Alfred-Skyblue/vue-draggable-plus | [VERIFIED: STACK.md + npm] | Approved |
| vue-sonner | npm | ~3 yr (created 2023-02-27, last update 2025-10) | github.com/xiaoluoboding/vue-sonner | [VERIFIED: UI-SPEC.md + npm] | Approved |
| steiger | npm | ~2 yr (created 2024-06-09, last update 2026-05) | github.com/feature-sliced/steiger | [VERIFIED: official FSD org + npm] | Approved |
| lucide-vue-next | npm | established | github.com/lucide-icons/lucide | [VERIFIED: shadcn-vue docs standard + npm] | Approved |
| vee-validate | npm | ~8 yr | github.com/logaretm/vee-validate | [VERIFIED: STACK.md + npm] | Approved |
| @supabase/supabase-js | npm | ~5 yr | github.com/supabase/supabase-js | [VERIFIED: official Supabase + npm] | Approved |
| pinia | npm | ~5 yr | github.com/vuejs/pinia | [VERIFIED: official Vue org + npm] | Approved |
| vue-router | npm | ~10 yr | github.com/vuejs/router | [VERIFIED: official Vue org + npm] | Approved |
| happy-dom | npm | established | github.com/capricorn86/happy-dom | [VERIFIED: npm registry] | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. All packages above were verified against their official source repositories and official project documentation. However, since slopcheck did not run, packages remain tagged [VERIFIED] by provenance rather than by slopcheck OK status.*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Owner)
│
├── /auth ──────────────────► useAuthStore (4-features/auth)
│                                    │
│                                    ▼
│                             supabase.auth.signIn/signUp
│                             supabase.auth.onAuthStateChange
│
├── / (QuizListPage) ────────► 5-entities/quiz/api.fetchPublishedQuizzes()
│                                    │
│                                    ▼
│                             Supabase PostgREST
│                             anon role → RLS: is_published=true
│
├── /my (MyQuizListPage) ────► 5-entities/quiz/api.fetchMyQuizzes()
│                                    │
│                                    ▼
│                             Supabase PostgREST
│                             authenticated role → RLS: owner_id=auth.uid()
│
└── /editor/:id ─────────────► useQuizEditorStore (4-features/quiz-editor)
                                     │
                  ┌──────────────────┼──────────────────────┐
                  ▼                  ▼                       ▼
          5-entities/quiz    5-entities/question    5-entities/answer-option
          api.updateQuiz()   api.createQuestion()   api.upsertAnswerOption()
                  │                  │                       │
                  └──────────────────┴───────────────────────┘
                                     │
                                     ▼
                          Supabase PostgREST (authenticated)
                          RLS: owner_id check via auth.uid()
                                     │
                                     ▼
                          supabase/migrations/
                          001_init_profiles.sql
                          002_quizzes.sql
                          003_questions_answers.sql
                          004_quiz_access.sql
                          005_sessions.sql
                          006_subscriptions.sql
                          007_rls_policies.sql
```

Cover upload path:
```
CoverUpload component
    │
    ├── canvas API: resize to max 1280px
    │
    └── supabase.storage.from('covers').upload(
            covers/{owner_id}/{quiz_id}/{uuid}.{ext}
        )
        ▼
    supabase.from('quizzes').update({ cover_url })
```

### Recommended Project Structure

```
src/
├── 1-app/
│   ├── main.ts                    — createApp, pinia, router mount
│   ├── App.vue                    — <RouterView> + <Sonner> toast provider
│   ├── router/
│   │   └── index.ts               — routes, beforeEach navigation guard
│   └── styles/
│       └── main.css               — @import "tailwindcss"; @theme {}; @custom-variant dark
│
├── 2-pages/
│   ├── AuthPage.vue               — mounts auth tabs widget
│   ├── QuizListPage.vue           — mounts quiz list widget (published)
│   ├── MyQuizListPage.vue         — mounts quiz list widget (mine) + new quiz button
│   └── QuizEditorPage.vue         — mounts QuizEditorWidget; shows mobile notice <768px
│
├── 3-widgets/
│   ├── AppHeader.vue              — nav bar, logout action, auth state display
│   ├── QuizEditorWidget.vue       — owns useQuizEditorStore; composes header/body/footer
│   ├── QuizEditorHeader.vue       — title, description, cover, time limit, publish toggle
│   ├── QuestionList.vue           — <VueDraggable> wrapper; @end handler → store action
│   └── QuizEditorFooter.vue       — navigation settings panel
│
├── 4-features/
│   ├── auth/
│   │   ├── model/
│   │   │   └── useAuthStore.ts    — currentUser, login(), logout(), register()
│   │   └── ui/
│   │       ├── LoginForm.vue
│   │       └── RegisterForm.vue
│   └── quiz-editor/
│       ├── model/
│       │   └── useQuizEditorStore.ts — draft state, debounced save, publish toggle
│       └── ui/
│           ├── QuizMetaForm.vue
│           ├── CoverUpload.vue
│           ├── PublishToggle.vue
│           ├── QuestionEditor.vue  — question card, always expanded
│           ├── AnswerOptionEditor.vue
│           └── NavigationSettings.vue
│
├── 5-entities/
│   ├── quiz/
│   │   ├── api.ts                 — fetchPublishedQuizzes, fetchMyQuizzes, createQuiz, updateQuiz, deleteQuiz
│   │   ├── model.ts               — Quiz, QuizSettings interfaces
│   │   └── ui/QuizCard.vue        — display only, zero business logic
│   ├── question/
│   │   ├── api.ts                 — fetchQuestions, createQuestion, updateQuestion, deleteQuestion, reorderQuestions
│   │   └── model.ts               — Question, QuestionType
│   └── answer-option/
│       ├── api.ts                 — createAnswerOption, updateAnswerOption, deleteAnswerOption
│       └── model.ts               — AnswerOption
│
└── 6-shared/
    ├── api/
    │   ├── supabase.ts            — singleton createClient()
    │   └── database.types.ts      — generated: npx supabase gen types typescript --local
    ├── lib/
    │   ├── draggable.ts           — re-exports VueDraggable
    │   ├── format.ts              — date, duration formatters
    │   └── image.ts               — canvas resize util (resizeImageToMaxWidth)
    ├── ui/                        — shadcn-vue components (source-copied)
    │   ├── Button.vue
    │   ├── Input.vue
    │   ├── Dialog.vue
    │   ├── Tabs.vue
    │   ├── Switch.vue
    │   └── Tooltip.vue
    ├── config/
    │   └── env.ts                 — typed VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
    └── types/
        └── index.ts               — shared TypeScript utility types

supabase/
├── config.toml
└── migrations/
    ├── 001_init_profiles.sql
    ├── 002_quizzes.sql
    ├── 003_questions_answers.sql
    ├── 004_quiz_access.sql
    ├── 005_sessions.sql
    ├── 006_subscriptions.sql
    └── 007_rls_policies.sql
```

### Pattern 1: FSD Layer Import Discipline

**What:** Each layer may only import from layers with higher numbers. `4-features` can import `5-entities` and `6-shared`, but never another `4-features` slice.

**When to use:** Always. steiger enforces this in CI. Each slice exposes a public API via `index.ts`.

```typescript
// Source: ARCHITECTURE.md + FSD official docs
// CORRECT — feature imports entity
// 4-features/quiz-editor/model/useQuizEditorStore.ts
import { updateQuiz } from '@entities/quiz/api'
import { createQuestion } from '@entities/question/api'
import { supabase } from '@shared/api/supabase'

// WRONG — entity importing from feature (steiger will fail this)
// 5-entities/quiz/api.ts — DO NOT import from 4-features
```

### Pattern 2: Supabase Auth Session Sync

**What:** The auth store initializes by calling `getSession()` on app startup, then subscribes to `onAuthStateChange` to stay in sync with the Supabase session.

**When to use:** In `useAuthStore`, called once from `1-app/main.ts` or `App.vue` `onMounted`.

```typescript
// Source: STACK.md + Supabase official docs pattern
// 4-features/auth/model/useAuthStore.ts
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isLoading = ref(true)

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null
    isLoading.value = false

    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
    })
  }

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function register(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
  }

  return { user, isLoading, init, login, register, logout }
})
```

### Pattern 3: Debounced Auto-Save in useQuizEditorStore

**What:** Watch quiz metadata reactive state; debounce saves to avoid excessive Supabase writes during typing. Boolean toggles save immediately.

**When to use:** Quiz title, description, time limit fields → 500ms debounce. `is_required`, `allow_back`, `is_correct`, `question type` → immediate.

```typescript
// Source: ARCHITECTURE.md
// 4-features/quiz-editor/model/useQuizEditorStore.ts
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'  // OR manual setTimeout impl
import { updateQuiz } from '@entities/quiz/api'

const title = ref('')
const description = ref('')

const debouncedSaveMetadata = useDebounceFn(async () => {
  await updateQuiz(quizId, { title: title.value, description: description.value })
}, 500)

watch([title, description], debouncedSaveMetadata)
```

> Note: `@vueuse/core` provides `useDebounceFn` — a lightweight composable. If adding it, verify it meets project size constraints. Alternatively, hand-roll with `setTimeout` + `clearTimeout` which requires no extra dependency.

### Pattern 4: DnD Reorder with Immediate Batch Upsert

**What:** When drag ends, renumber all questions 0, 1, 2, ... in order and batch upsert to Supabase. Never use array index as `:key`.

**When to use:** `@end` handler on `<VueDraggable>`.

```typescript
// Source: PITFALLS.md §6.2, STACK.md
// 3-widgets/QuestionList.vue
function onDragEnd() {
  // Renumber in-place — never replace the array reference
  questions.value.forEach((q, index) => {
    q.order_index = index
  })
  // Batch upsert immediately
  void quizEditorStore.reorderQuestions(questions.value)
}

// Template
// <VueDraggable v-model="questions" handle=".drag-handle" @end="onDragEnd">
//   <QuestionEditor v-for="q in questions" :key="q.id" :question="q" />
// </VueDraggable>
//                                               ^^^^ always UUID, never index
```

### Pattern 5: RLS Dual-Policy (Owner + Anon)

**What:** Every table needs two policy families: `TO authenticated` for owners (using `auth.uid()`), and `TO anon` for guest read-only access (limited to published content). Use `(SELECT auth.uid())` subquery form to enable Postgres `initPlan` optimization.

**When to use:** All 7 migration files. Phase 1 must establish the RLS foundation for all future phases.

```sql
-- Source: ARCHITECTURE.md (full policy set)
-- Pattern for quizzes table

-- Owner: full CRUD on own quizzes
CREATE POLICY "owner_manage_quizzes"
  ON quizzes TO authenticated
  USING  ( owner_id = (SELECT auth.uid()) )
  WITH CHECK ( owner_id = (SELECT auth.uid()) );

-- Guest: read-only, published only
CREATE POLICY "anon_read_published_quizzes"
  ON quizzes FOR SELECT TO anon
  USING ( is_published = true );

-- Performance: always use (SELECT auth.uid()) not auth.uid()
-- This enables initPlan optimization — evaluated once per query, not per row
```

### Pattern 6: Supabase Storage Cover Upload with Client Resize

**What:** Before uploading, use canvas API to resize the image to max 1280px wide. Upload to namespaced path to avoid collisions. Save returned public URL to `quizzes.cover_url`.

**When to use:** `CoverUpload.vue` component in the quiz editor.

```typescript
// Source: PITFALLS.md §7.4 + CONTEXT.md D-17
// 6-shared/lib/image.ts
export async function resizeImageToMaxWidth(file: File, maxWidth = 1280): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth * scale
      canvas.height = img.naturalHeight * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => resolve(blob!), file.type)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

// 4-features/quiz-editor: CoverUpload upload handler
async function uploadCover(file: File) {
  const ext = file.name.split('.').pop()
  const path = `covers/${ownerId}/${quizId}/${crypto.randomUUID()}.${ext}`
  const resized = await resizeImageToMaxWidth(file)
  const { error } = await supabase.storage.from('covers').upload(path, resized)
  if (error) throw error
  const { data } = supabase.storage.from('covers').getPublicUrl(path)
  await updateQuiz(quizId, { cover_url: data.publicUrl })
}
```

### Pattern 7: Vue Router Navigation Guard with returnUrl

**What:** Global `beforeEach` guard checks auth state and redirects unauthenticated users to `/auth?returnUrl=...`. After login, `router.push(returnUrl || '/')`.

```typescript
// Source: CONTEXT.md D-03 + STACK.md
// 1-app/router/index.ts
const PROTECTED_ROUTES = ['/my', '/editor']

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const requiresAuth = PROTECTED_ROUTES.some(r => to.path.startsWith(r))
  if (requiresAuth && !authStore.user) {
    return { path: '/auth', query: { returnUrl: to.fullPath } }
  }
})
```

### Pattern 8: Tailwind CSS v4 Setup (Breaking Changes from v3)

**What:** v4 eliminates `tailwind.config.js`, removes `@tailwind` directives, and changes dark mode configuration.

```css
/* Source: STACK.md — verified breaking changes */
/* src/1-app/styles/main.css */
@import "tailwindcss";

@theme {
  --font-sans: 'Inter', sans-serif;
  --color-brand-from: theme(--color-violet-600);
  --color-brand-to: theme(--color-indigo-600);
}

/* Class-based dark mode — v4 syntax */
@custom-variant dark (&:where(.dark, .dark *));
```

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // No PostCSS config needed
})
```

### Anti-Patterns to Avoid

- **Array index as `:key` in DnD list:** Always use `:key="question.id"` (UUID). Index keys cause SortableJS to reuse DOM nodes incorrectly after reorder. [CITED: PITFALLS.md §6.1]
- **Replacing array reference during drag:** Mutate in-place with `splice()`, never `questions.value = newArray`. SortableJS holds a reference to the original array. [CITED: PITFALLS.md §6.3]
- **Business logic in `6-shared`:** `6-shared` contains only generic UI, the Supabase singleton, and domain-agnostic utilities. No quiz or user logic. [CITED: PITFALLS.md §4.1]
- **Feature-to-feature imports:** `4-features/auth` must never import from `4-features/quiz-editor` or vice versa. Cross-feature communication goes through entities or router events. [CITED: PITFALLS.md §4.2]
- **Fat pages:** Page components must stay under ~80 lines. All logic belongs in `4-features` stores or `3-widgets`. [CITED: PITFALLS.md §4.3]
- **`100vh` in editor layout:** Use `100dvh`. On mobile, `100vh` doesn't account for browser chrome collapse. [CITED: ARCHITECTURE.md]
- **Tables without RLS enabled:** Every `CREATE TABLE` must be immediately followed by `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY`. [CITED: PITFALLS.md §7.3]
- **Batch `order_index` not updated after drag:** The `@end` handler must batch-upsert all questions with renumbered `order_index`. Local-only reorder creates gaps that corrupt sort order. [CITED: PITFALLS.md §6.2]
- **`UNIQUE` constraint on `(quiz_id, order_index)`:** Do NOT add this — it makes batch reorders impossible. Use `ORDER BY order_index ASC, created_at ASC` instead. [CITED: PITFALLS.md §6.4]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop sortable list | Custom mouse event handler | `vue-draggable-plus` | SortableJS handles touch, keyboard, scroll-during-drag, accessibility |
| Toast notifications | Custom Vue component with state | `vue-sonner` | Handles stacking, auto-dismiss, animation, aria-live regions |
| Form validation + schema | Custom validators in components | `vee-validate` + `zod` | Type inference, async validation, field-level errors, cross-field rules |
| Image canvas resize | Custom FileReader + canvas utility | `6-shared/lib/image.ts` (thin wrapper) | Actually hand-roll this — it's simple and no library needed |
| FSD import rule enforcement | Code review, manual discipline | `steiger` | steiger catches violations at CI time, not at review time |
| Auth session persistence | Custom cookie/localStorage | `@supabase/supabase-js` | Supabase client handles token refresh automatically |
| UUID generation for storage paths | Custom ID scheme | `crypto.randomUUID()` | Native browser API, cryptographically secure, no dependency |
| Supabase TypeScript types | Manual interface declarations | `supabase gen types typescript --local` | Generates exact DB schema types; run after every migration |

**Key insight:** The quiz editor's most complex problem — maintaining `order_index` consistency after drag operations — cannot be delegated to a library. It requires custom store logic. Every other problem in Phase 1 has a battle-tested solution that must be used.

---

## Common Pitfalls

### Pitfall 1: RLS Policy Collision Between Owner and Anon Roles

**What goes wrong:** `007_rls_policies.sql` writes all policies using `auth.uid()` checks. Quiz takers (anon role) cannot read quiz content even though the quiz is published. Alternatively: anon role can read `password_hash` or `is_correct` because no column exclusions are set.

**Why it happens:** Supabase Dashboard's autogenerated policies default to `authenticated` role only. Developers add anon READ without thinking about column-level security.

**How to avoid:**
1. Every table gets two policy families: `TO authenticated` (owner) and `TO anon` (guest, published content only)
2. `answer_options`: no anon SELECT on the table directly — create a `SECURITY DEFINER` view `answer_options_public` that excludes `is_correct`; grant `anon` SELECT on the view only
3. `quiz_access`: no anon access at all — Edge Function only (Phase 2)
4. Always `ENABLE ROW LEVEL SECURITY` before adding policies

**Warning signs:** Quiz list page shows empty results. `supabase.from('quizzes').select()` returns 0 rows for authenticated owner.

[CITED: PITFALLS.md §1.1, §1.4 + ARCHITECTURE.md RLS Design section]

---

### Pitfall 2: `order_index` Corruption After Drag Operations

**What goes wrong:** After a drag, only local Vue state is reordered. `order_index` in the DB is not updated. Next page load restores original order. OR: gaps form after deletions (e.g., indices 0,1,3,4 after deleting index 2) and new questions are appended at index 5 instead of 2.

**Why it happens:** `@end` handler updates the `v-model` array but does not call a Supabase upsert. Or the upsert only updates the dragged item, not all affected items.

**How to avoid:**
- `@end` handler: iterate the full array, assign `order_index = arrayIndex`, batch upsert ALL questions
- After any delete: renumber remaining questions 0...N-1
- Always fetch questions with `ORDER BY order_index ASC, created_at ASC`

**Warning signs:** Questions appear in wrong order after page refresh. DnD works visually but resets on reload.

[CITED: PITFALLS.md §6.2, §6.4]

---

### Pitfall 3: SortableJS Array Reference Replacement

**What goes wrong:** After a successful drag, the store action replaces the questions array reference (e.g., `state.questions = [...newItems]`). SortableJS holds a reference to the original array and null-reference errors appear in the console. The list randomly reverts to the pre-drag state.

**Why it happens:** SortableJS's internal state references the original DOM-backing array. Replacing the reference breaks this link.

**How to avoid:** Always mutate in-place:
```typescript
state.questions.splice(0, state.questions.length, ...newItems)
```

**Warning signs:** Console shows SortableJS null reference errors. List reverts after drag drop.

[CITED: PITFALLS.md §6.3]

---

### Pitfall 4: FSD Layer Drift Starting in Phase 1

**What goes wrong:** Convenience shortcuts accumulate — a quiz API call placed in `6-shared`, a Pinia store imported in a `5-entities` API file, a page component that grows to 200 lines with inline store logic. steiger is not set up until "later" and by then violations are everywhere.

**Why it happens:** Greenfield projects have no enforcement until it's added. Each shortcut seems reasonable in isolation.

**How to avoid:**
- Install and configure steiger in `Day 1` of Phase 1 — before any feature code is written
- Configure TypeScript path aliases (`@app/*`, `@pages/*`, `@widgets/*`, `@features/*`, `@entities/*`, `@shared/*`) in `tsconfig.json` AND `vite.config.ts` — steiger uses these to determine layers
- Run `npx steiger ./src` as a pre-commit hook and in CI

**Warning signs:** `import` paths traverse multiple `../` segments. A `6-shared` file imports from `5-entities`. A page file exceeds 100 lines.

[CITED: PITFALLS.md §4.1–4.3 + STACK.md]

---

### Pitfall 5: Cover Image Storage Path Collisions

**What goes wrong:** Multiple users upload a file named `cover.jpg`. The last upload overwrites all previous ones. OR: a user uploads a new cover for a quiz and the old one remains in Storage (storage leak).

**Why it happens:** Upload path is not namespaced. No UUID in the filename.

**How to avoid:**
- Path template: `covers/{owner_id}/{quiz_id}/{uuid}.{ext}` — always a fresh UUID per upload
- Storage INSERT policy: verify path prefix starts with `auth.uid()` — prevents users from writing to other users' directories
- When updating a cover: delete old file before uploading new one (or accept orphan accumulation as a Phase 1 tradeoff)

**Warning signs:** Uploading a second cover shows the first cover because `cover_url` was not updated. Two users share the same storage path.

[CITED: PITFALLS.md §7.4 + CONTEXT.md D-17]

---

### Pitfall 6: `show_stop_button` Missing from Schema

**What goes wrong:** UI-SPEC.md defines a "Показывать кнопку «Стоп»" toggle (NAV-01) that maps to `settings.show_stop_button`. The DB schema in SPEC.md only shows `allow_back` and `shuffle_questions` in the `settings` JSONB. The field is missing.

**Why it happens:** UI-SPEC was developed after the original schema, adding navigation requirements that weren't in the initial SPEC.md.

**How to avoid:** Migration `002_quizzes.sql` must initialize `settings` JSONB with `{ "allow_back": true, "show_stop_button": true, "shuffle_questions": false, "shuffle_answers": false }` as the default. No schema change needed since it's JSONB — but document the expected shape in `6-shared/types/index.ts`.

**Warning signs:** NAV-01 toggle has nowhere to persist its value. `settings.show_stop_button` is `undefined` instead of `true`.

[CITED: STATE.md Open Questions + UI-SPEC.md footer anatomy]

---

### Pitfall 7: Tailwind CSS v4 Breaking Changes Applied Incorrectly

**What goes wrong:** Developer copies v3 setup: creates `tailwind.config.js`, uses `@tailwind base;` directives, sets `darkMode: 'class'`. None of these work in v4. CSS is not generated. The page renders unstyled.

**Why it happens:** v4 has radically different configuration. Training data and most tutorials still show v3 syntax.

**How to avoid:**
- No `tailwind.config.js` — v4 uses CSS-based configuration via `@theme` in `main.css`
- No `@tailwind base/components/utilities` — use `@import "tailwindcss"`
- No `darkMode: 'class'` in config — use `@custom-variant dark (&:where(.dark, .dark *))` in CSS
- Install `@tailwindcss/vite` (not `@tailwindcss/postcss`) and add to Vite plugins

**Warning signs:** `tailwind.config.js` is being created. `@tailwind` appears in CSS files.

[CITED: STACK.md Breaking Changes section]

---

### Pitfall 8: `vee-validate` Field Component (deprecated) Used Instead of `defineField`

**What goes wrong:** Developer uses `<Field>` component syntax from vee-validate v3 examples. This is deprecated in v4 and loses TypeScript inference.

**How to avoid:** Always use `defineField` composable:

```typescript
// Source: STACK.md
const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(schema)
})
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')
```

[CITED: STACK.md + vee-validate v4 docs]

---

## Code Examples

### Supabase Client Singleton

```typescript
// Source: STACK.md
// 6-shared/api/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@shared/config/env'

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
```

### TypeScript Path Aliases (tsconfig.json + vite.config.ts)

```json
// tsconfig.json — Source: STACK.md
{
  "compilerOptions": {
    "paths": {
      "@app/*":      ["src/1-app/*"],
      "@pages/*":    ["src/2-pages/*"],
      "@widgets/*":  ["src/3-widgets/*"],
      "@features/*": ["src/4-features/*"],
      "@entities/*": ["src/5-entities/*"],
      "@shared/*":   ["src/6-shared/*"]
    }
  }
}
```

```typescript
// vite.config.ts — Source: STACK.md
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@app':      fileURLToPath(new URL('./src/1-app', import.meta.url)),
      '@pages':    fileURLToPath(new URL('./src/2-pages', import.meta.url)),
      '@widgets':  fileURLToPath(new URL('./src/3-widgets', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/4-features', import.meta.url)),
      '@entities': fileURLToPath(new URL('./src/5-entities', import.meta.url)),
      '@shared':   fileURLToPath(new URL('./src/6-shared', import.meta.url)),
    }
  }
})
```

### RLS Policy Template for Quizzes Table

```sql
-- Source: ARCHITECTURE.md
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_quizzes"
  ON quizzes TO authenticated
  USING  ( owner_id = (SELECT auth.uid()) )
  WITH CHECK ( owner_id = (SELECT auth.uid()) );

CREATE POLICY "anon_read_published_quizzes"
  ON quizzes FOR SELECT TO anon
  USING ( is_published = true );

-- Performance index
CREATE INDEX ON quizzes (owner_id);
CREATE INDEX ON quizzes (is_published) WHERE is_published = true;
```

### Quiz Entity API Layer

```typescript
// Source: ARCHITECTURE.md FSD Layer Mapping
// 5-entities/quiz/api.ts
import { supabase } from '@shared/api/supabase'
import type { Quiz } from './model'

export async function fetchMyQuizzes(): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchPublishedQuizzes(): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, title, description, cover_url, time_limit_sec')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createQuiz(): Promise<Quiz> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('quizzes')
    .insert({ title: 'Без названия', owner_id: user!.id, is_published: false,
              settings: { allow_back: true, show_stop_button: true, shuffle_questions: false, shuffle_answers: false } })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateQuiz(id: string, patch: Partial<Quiz>): Promise<void> {
  const { error } = await supabase.from('quizzes').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteQuiz(id: string): Promise<void> {
  const { error } = await supabase.from('quizzes').delete().eq('id', id)
  if (error) throw error
}
```

### Supabase Migration: profiles (001_init_profiles.sql)

```sql
-- Source: SPEC.md DB schema + PITFALLS.md §7.3
CREATE TYPE plan_type AS ENUM ('free', 'pro');

CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email      text NOT NULL,
  full_name  text,
  avatar_url text,
  plan       plan_type NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_own_profile"
  ON profiles TO authenticated
  USING  ( id = (SELECT auth.uid()) )
  WITH CHECK ( id = (SELECT auth.uid()) );

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` | CSS `@theme {}` in main.css | Tailwind v4 (2025) | `tailwind.config.js` no longer works; all existing tutorials wrong |
| `@tailwind base` directives | `@import "tailwindcss"` | Tailwind v4 (2025) | Directive syntax removed |
| `darkMode: 'class'` config | `@custom-variant dark (&:where(.dark, .dark *))` | Tailwind v4 (2025) | Config option no longer exists |
| PostCSS for Tailwind | `@tailwindcss/vite` plugin | Tailwind v4 (2025) | Direct Vite integration, no PostCSS needed |
| `vue.draggable.next` | `vue-draggable-plus` | 2023 | `vue.draggable.next` unmaintained |
| `vee-validate` `<Field>` component | `defineField` composable | vee-validate v4 | Component approach deprecated |
| `deno.land/x/` imports in Edge Functions | `npm:` specifier | Supabase 2024 | `npm:` is now recommended; better compatibility |

**Deprecated/outdated in this project context:**
- `vue.draggable.next`: unmaintained, do not use [CITED: STACK.md]
- `vee-validate` `<Field>` component: deprecated in v4 [CITED: STACK.md]
- `@tailwind base/components/utilities` directives: removed in v4 [CITED: STACK.md]
- `tailwind.config.js`: no longer recognized in v4 [CITED: STACK.md]

---

## Runtime State Inventory

> Step 2.5 SKIPPED — this is a greenfield phase. `src/` and `supabase/` directories do not exist. No runtime state to inventory.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tools, npm scripts | ✓ | v20.20.2 | — |
| npm | Package installation | ✓ | 10.8.2 | — |
| Supabase CLI | Migrations, local dev, type generation | ✓ | 2.98.2 | — |
| Git | Version control | [ASSUMED] present | — | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

All required tooling is available on the development machine.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (email+password), `supabase.auth.signInWithPassword()` |
| V3 Session Management | yes | Supabase auto-refresh tokens, `onAuthStateChange` for session sync |
| V4 Access Control | yes | Supabase RLS policies (per-table, per-role) |
| V5 Input Validation | yes | `vee-validate` + `zod` on auth forms and quiz metadata |
| V6 Cryptography | partial | Supabase handles auth token crypto; cover upload paths use `crypto.randomUUID()` |

### Known Threat Patterns for Phase 1 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anon role reading `is_correct` answers | Information Disclosure | Column-level grants; `SECURITY DEFINER` view for anon reads |
| Anon role reading `password_hash` | Information Disclosure | No anon SELECT on `quiz_access` table at all |
| Cover upload path traversal / cross-user overwrite | Elevation of Privilege | Storage INSERT policy verifies path prefix = `auth.uid()` |
| SQL injection via PostgREST | Tampering | Parameterized queries via Supabase JS client (not raw SQL) |
| CSRF on Supabase calls | Spoofing | Supabase JWT in Authorization header (not cookie-based); no custom forms POST |
| Tables without RLS | Elevation of Privilege | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every table; CI check on `pg_tables.rowsecurity` |
| Unauthenticated access to `/my` or `/editor/:id` | Elevation of Privilege | Vue Router `beforeEach` guard; redirect to `/auth?returnUrl=...` |

---

## Open Questions (RESOLVED)

1. **steiger + numeric FSD prefixes compatibility**
   - What we know: steiger resolves layer order by directory name; numeric prefixes `1-app` through `6-shared` may need explicit configuration
   - What's unclear: Whether steiger auto-detects numeric prefixes or requires a custom `steiger.config.ts`
   - Recommendation: Wave 0 setup task should include: install steiger, run `npx steiger ./src`, verify no false positives before writing feature code

2. **`show_stop_button` not in SPEC.md schema**
   - What we know: UI-SPEC.md requires it (NAV-01); it maps to `quizzes.settings` JSONB
   - What's unclear: Whether the default should be `true` or `false`
   - Recommendation: Default `true` (better UX — takers can always stop); document the full JSONB shape in `6-shared/types/index.ts`

3. **`@vueuse/core` as an optional dependency for `useDebounceFn`**
   - What we know: ARCHITECTURE.md uses `useDebounceFn` in its store pattern example; this implies `@vueuse/core`
   - What's unclear: Whether to add the full `@vueuse/core` package or hand-roll a 5-line debounce utility
   - Recommendation: Hand-roll `useDebounceFn` in `6-shared/lib/debounce.ts` — avoids a dependency for a trivial utility; reconsider if more VueUse composables become useful in later phases

4. **Supabase Storage bucket `covers` — public or private?**
   - What we know: `cover_url` is stored in `quizzes` and displayed to anon users on `/`; images must be publicly readable
   - What's unclear: Storage RLS for public-read bucket vs. private bucket with signed URLs
   - Recommendation: Create the `covers` bucket as **public** (no storage RLS read policy needed); write is restricted by a storage policy that checks `auth.uid()` matches path prefix. Simpler than signed URLs for public quiz covers.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@vueuse/core` is the source of `useDebounceFn` in the store pattern | Code Examples / Pattern 3 | Low — easy to replace with inline debounce |
| A2 | `vue-router` npm v5.0.7 corresponds to Vue Router 4.x API for Vue 3 | Standard Stack | Low — import path and API are the same; the version jump is a semver bump |
| A3 | `covers` storage bucket should be public (no signed URLs) | Open Questions | Medium — if images must be private, signed URLs add complexity |
| A4 | Git is available on the development machine | Environment Availability | Low — would be caught immediately at scaffold stage |
| A5 | steiger v0.5.12 supports numeric FSD prefix directories without extra config | Common Pitfalls §4 | Medium — if config is required, Wave 0 setup task must include it |

**All other claims in this research are VERIFIED (npm registry + official project documentation) or CITED (project research files authored from official sources).**

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/ARCHITECTURE.md` — FSD layer mapping, RLS policy patterns, component hierarchy, store patterns (researched 2026-05-16 from official Supabase docs + FSD docs)
- `.planning/research/PITFALLS.md` — Phase 1 pitfall catalogue (researched 2026-05-16, HIGH confidence per file header)
- `.planning/research/STACK.md` — Library versions, breaking changes, canonical patterns (researched 2026-05-16)
- `SPEC.md` — DB schema, table definitions, page routes, migration file list
- `.planning/phases/01-foundation-auth-and-quiz-editor/01-CONTEXT.md` — Locked decisions D-01 through D-18
- `.planning/phases/01-foundation-auth-and-quiz-editor/01-UI-SPEC.md` — Component anatomy, copywriting, interaction states
- npm registry — version verification for all listed packages (verified 2026-05-16)

### Secondary (MEDIUM confidence)

- `.planning/research/FEATURES.md` — Feature-level research, anti-features, Russian market context
- `.planning/REQUIREMENTS.md` — Full 48-requirement list with traceability
- `.planning/ROADMAP.md` — Phase goals, success criteria

### Tertiary (LOW confidence)

- None — all significant claims are backed by primary or secondary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on 2026-05-16; libraries confirmed from official project research files
- Architecture: HIGH — FSD patterns come from official project research (ARCHITECTURE.md) authored from FSD docs + Supabase official docs
- Pitfalls: HIGH — sourced from PITFALLS.md (confidence: HIGH per file header, verified against Supabase + FSD docs)
- UI patterns: HIGH — sourced from approved UI-SPEC.md
- RLS patterns: HIGH — code sourced directly from ARCHITECTURE.md

**Research date:** 2026-05-16
**Valid until:** 2026-06-16 (stable ecosystem; Tailwind v4 and Supabase v2 not expected to have breaking changes within 30 days)
