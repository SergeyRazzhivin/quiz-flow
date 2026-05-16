# Phase 1: Foundation, Auth & Quiz Editor — Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 47 new files (greenfield — no existing source code)
**Analogs found:** 0 / 47 from codebase (greenfield); all patterns sourced from RESEARCH.md and ARCHITECTURE.md

> This is a greenfield project. `src/` and `supabase/` do not exist yet.
> Patterns below are sourced from `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`,
> and `.planning/phases/01-foundation-auth-and-quiz-editor/01-RESEARCH.md`.
> Every code excerpt is a canonical template to be copied verbatim.

---

## File Classification

| New File | FSD Layer | Role | Data Flow | Pattern Source | Match Quality |
|----------|-----------|------|-----------|----------------|---------------|
| `src/1-app/main.ts` | 1-app | entry-point | request-response | RESEARCH.md Pattern 1 | template |
| `src/1-app/App.vue` | 1-app | root-component | event-driven | RESEARCH.md §Architecture | template |
| `src/1-app/router/index.ts` | 1-app | router | request-response | RESEARCH.md Pattern 7 | template |
| `src/1-app/styles/main.css` | 1-app | config | — | RESEARCH.md Pattern 8 | template |
| `src/2-pages/AuthPage.vue` | 2-pages | page | request-response | RESEARCH.md §Structure | template |
| `src/2-pages/QuizListPage.vue` | 2-pages | page | CRUD | RESEARCH.md §Structure | template |
| `src/2-pages/MyQuizListPage.vue` | 2-pages | page | CRUD | RESEARCH.md §Structure | template |
| `src/2-pages/QuizEditorPage.vue` | 2-pages | page | CRUD | RESEARCH.md Pattern 8 / ARCHITECTURE.md | template |
| `src/3-widgets/AppHeader.vue` | 3-widgets | widget | event-driven | ARCHITECTURE.md §Component Hierarchy | template |
| `src/3-widgets/QuizEditorWidget.vue` | 3-widgets | widget | CRUD | ARCHITECTURE.md §Component Hierarchy | template |
| `src/3-widgets/QuizEditorHeader.vue` | 3-widgets | widget | CRUD | ARCHITECTURE.md §Component Hierarchy | template |
| `src/3-widgets/QuestionList.vue` | 3-widgets | widget | event-driven | RESEARCH.md Pattern 4 | template |
| `src/3-widgets/QuizEditorFooter.vue` | 3-widgets | widget | event-driven | ARCHITECTURE.md §Component Hierarchy | template |
| `src/4-features/auth/model/useAuthStore.ts` | 4-features | store | request-response | RESEARCH.md Pattern 2 | template |
| `src/4-features/auth/ui/LoginForm.vue` | 4-features | form-component | request-response | RESEARCH.md Pitfall 8 | template |
| `src/4-features/auth/ui/RegisterForm.vue` | 4-features | form-component | request-response | RESEARCH.md Pitfall 8 | template |
| `src/4-features/quiz-editor/model/useQuizEditorStore.ts` | 4-features | store | CRUD | RESEARCH.md Pattern 3 | template |
| `src/4-features/quiz-editor/ui/QuizMetaForm.vue` | 4-features | form-component | CRUD | RESEARCH.md Pattern 3 | template |
| `src/4-features/quiz-editor/ui/CoverUpload.vue` | 4-features | component | file-I/O | RESEARCH.md Pattern 6 | template |
| `src/4-features/quiz-editor/ui/PublishToggle.vue` | 4-features | component | event-driven | CONTEXT.md D-13 | template |
| `src/4-features/quiz-editor/ui/QuestionEditor.vue` | 4-features | component | CRUD | ARCHITECTURE.md §Component Hierarchy | template |
| `src/4-features/quiz-editor/ui/AnswerOptionEditor.vue` | 4-features | component | CRUD | ARCHITECTURE.md §Component Hierarchy | template |
| `src/4-features/quiz-editor/ui/NavigationSettings.vue` | 4-features | component | event-driven | CONTEXT.md D-18, NAV-01/02 | template |
| `src/5-entities/quiz/api.ts` | 5-entities | api | CRUD | RESEARCH.md §Code Examples | template |
| `src/5-entities/quiz/model.ts` | 5-entities | model | — | SPEC.md §quizzes | template |
| `src/5-entities/quiz/ui/QuizCard.vue` | 5-entities | display-component | — | CONTEXT.md D-06 | template |
| `src/5-entities/question/api.ts` | 5-entities | api | CRUD | ARCHITECTURE.md §FSD Layer Mapping | template |
| `src/5-entities/question/model.ts` | 5-entities | model | — | SPEC.md §questions | template |
| `src/5-entities/answer-option/api.ts` | 5-entities | api | CRUD | ARCHITECTURE.md §FSD Layer Mapping | template |
| `src/5-entities/answer-option/model.ts` | 5-entities | model | — | SPEC.md §answer_options | template |
| `src/6-shared/api/supabase.ts` | 6-shared | singleton | request-response | RESEARCH.md §Code Examples | template |
| `src/6-shared/api/database.types.ts` | 6-shared | generated-types | — | RESEARCH.md §Stack | template |
| `src/6-shared/lib/image.ts` | 6-shared | utility | file-I/O | RESEARCH.md Pattern 6 | template |
| `src/6-shared/lib/debounce.ts` | 6-shared | utility | — | RESEARCH.md Open Question 3 | template |
| `src/6-shared/lib/format.ts` | 6-shared | utility | transform | RESEARCH.md §Structure | template |
| `src/6-shared/lib/draggable.ts` | 6-shared | re-export | — | RESEARCH.md §Structure | template |
| `src/6-shared/config/env.ts` | 6-shared | config | — | RESEARCH.md §Code Examples | template |
| `src/6-shared/types/index.ts` | 6-shared | types | — | RESEARCH.md Open Question 2 | template |
| `src/6-shared/ui/Button.vue` | 6-shared | ui-component | — | CONTEXT.md D-18 (shadcn-vue) | shadcn-vue |
| `src/6-shared/ui/Input.vue` | 6-shared | ui-component | — | CONTEXT.md D-18 (shadcn-vue) | shadcn-vue |
| `src/6-shared/ui/Dialog.vue` | 6-shared | ui-component | — | CONTEXT.md D-18 (shadcn-vue) | shadcn-vue |
| `src/6-shared/ui/Tabs.vue` | 6-shared | ui-component | — | CONTEXT.md D-18 (shadcn-vue) | shadcn-vue |
| `src/6-shared/ui/Switch.vue` | 6-shared | ui-component | — | CONTEXT.md D-18 (shadcn-vue) | shadcn-vue |
| `src/6-shared/ui/Tooltip.vue` | 6-shared | ui-component | — | CONTEXT.md D-18 (shadcn-vue) | shadcn-vue |
| `supabase/migrations/001_init_profiles.sql` | — | migration | CRUD | RESEARCH.md §Code Examples | template |
| `supabase/migrations/002_quizzes.sql` | — | migration | CRUD | SPEC.md §quizzes | template |
| `supabase/migrations/003_questions_answers.sql` | — | migration | CRUD | SPEC.md §questions + §answer_options | template |
| `supabase/migrations/004_quiz_access.sql` | — | migration | CRUD | SPEC.md §quiz_access | template |
| `supabase/migrations/005_sessions.sql` | — | migration | CRUD | SPEC.md §quiz_sessions + §session_answers | template |
| `supabase/migrations/006_subscriptions.sql` | — | migration | CRUD | SPEC.md §subscriptions | template |
| `supabase/migrations/007_rls_policies.sql` | — | migration | access-control | RESEARCH.md Pattern 5 + ARCHITECTURE.md §RLS | template |
| `vite.config.ts` | — | config | — | RESEARCH.md Pattern 8 + §Code Examples | template |
| `tsconfig.json` | — | config | — | RESEARCH.md §Code Examples | template |
| `package.json` | — | config | — | RESEARCH.md §Standard Stack | template |
| `steiger.config.ts` | — | linter-config | — | RESEARCH.md Open Question 1 | template |

---

## Pattern Assignments

### `vite.config.ts` (config)

**Source:** RESEARCH.md Pattern 8 + Code Examples (Tailwind CSS v4 Breaking Changes)

**CRITICAL — Tailwind v4 setup (NOT v3):**
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // No PostCSS config needed — tailwindcss() Vite plugin replaces it
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

**Anti-pattern:** Do NOT create `tailwind.config.js`. Do NOT use `@tailwindcss/postcss`.

---

### `tsconfig.json` (config)

**Source:** RESEARCH.md §Code Examples

**Path alias block (required for steiger to resolve FSD layers):**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
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

---

### `src/1-app/styles/main.css` (config — Tailwind v4 entry)

**Source:** RESEARCH.md Pattern 8

**CRITICAL — v4 syntax (NOT v3 `@tailwind` directives):**
```css
/* src/1-app/styles/main.css */
@import "tailwindcss";

@theme {
  --font-sans: 'Inter', sans-serif;
  --color-brand-from: theme(--color-violet-600);
  --color-brand-to:   theme(--color-indigo-600);
}

/* Class-based dark mode — v4 syntax (not darkMode: 'class' in config) */
@custom-variant dark (&:where(.dark, .dark *));
```

**Anti-pattern:** Do NOT use `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`.

---

### `src/1-app/main.ts` (entry-point)

**Source:** RESEARCH.md §Architecture Patterns — Standard Stack

**Pattern:**
```typescript
// src/1-app/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import App from './App.vue'
import './styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

---

### `src/1-app/App.vue` (root-component)

**Source:** RESEARCH.md §Architectural Responsibility Map — Toast provider

**Pattern:** mounts `<RouterView>` + `<Sonner>` toast provider once. Auth store `init()` called here.
```vue
<!-- src/1-app/App.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { Toaster } from 'vue-sonner'
import { useAuthStore } from '@features/auth/model/useAuthStore'

const authStore = useAuthStore()
onMounted(() => authStore.init())
</script>

<template>
  <RouterView />
  <Toaster position="top-right" richColors />
</template>
```

---

### `src/1-app/router/index.ts` (router — navigation guard)

**Source:** RESEARCH.md Pattern 7

**Core pattern:**
```typescript
// src/1-app/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@features/auth/model/useAuthStore'

const PROTECTED_ROUTES = ['/my', '/editor']

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',            component: () => import('@pages/QuizListPage.vue') },
    { path: '/auth',        component: () => import('@pages/AuthPage.vue') },
    { path: '/my',          component: () => import('@pages/MyQuizListPage.vue') },
    { path: '/editor/:id',  component: () => import('@pages/QuizEditorPage.vue') },
  ]
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const requiresAuth = PROTECTED_ROUTES.some(r => to.path.startsWith(r))
  if (requiresAuth && !authStore.user) {
    return { path: '/auth', query: { returnUrl: to.fullPath } }
  }
})
```

**returnUrl usage in auth feature (after successful login):**
```typescript
// src/4-features/auth/model/useAuthStore.ts — after login()
const returnUrl = route.query.returnUrl as string | undefined
router.push(returnUrl || '/')
```

---

### `src/2-pages/AuthPage.vue` (page — thin assembler)

**Source:** RESEARCH.md §Structure + CONTEXT.md D-02

**Rule:** Pages stay under ~80 lines. No domain logic. Mounts feature components only.

```vue
<!-- src/2-pages/AuthPage.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import LoginForm from '@features/auth/ui/LoginForm.vue'
import RegisterForm from '@features/auth/ui/RegisterForm.vue'
// Tabs from shadcn-vue (source-copied to 6-shared/ui)
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs.vue'
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <Tabs default-value="login" class="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="login">Войти</TabsTrigger>
        <TabsTrigger value="register">Зарегистрироваться</TabsTrigger>
      </TabsList>
      <TabsContent value="login"><LoginForm /></TabsContent>
      <TabsContent value="register"><RegisterForm /></TabsContent>
    </Tabs>
  </div>
</template>
```

---

### `src/2-pages/QuizEditorPage.vue` (page — thin assembler)

**Source:** ARCHITECTURE.md §Component Hierarchy + CONTEXT.md EDIT-08

**CRITICAL — `100dvh` not `100vh` for editor layout:**
```vue
<!-- src/2-pages/QuizEditorPage.vue -->
<script setup lang="ts">
import QuizEditorWidget from '@widgets/QuizEditorWidget.vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const quizId = route.params.id as string
</script>

<template>
  <!-- Mobile notice for screens < 768px -->
  <div class="hidden md:block h-full">
    <QuizEditorWidget :quiz-id="quizId" />
  </div>
  <div class="flex md:hidden items-center justify-center min-h-screen p-6 text-center">
    <p>Редактор доступен только на экранах шире 768px</p>
  </div>
</template>
```

---

### `src/3-widgets/QuizEditorWidget.vue` (widget — owns store, assembles layout)

**Source:** ARCHITECTURE.md §Component Hierarchy + CONTEXT.md EDIT-08

**CSS Grid layout pattern (CRITICAL — `100dvh` not `100vh`):**
```vue
<!-- src/3-widgets/QuizEditorWidget.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import QuizEditorHeader from './QuizEditorHeader.vue'
import QuestionList from './QuestionList.vue'
import QuizEditorFooter from './QuizEditorFooter.vue'

const props = defineProps<{ quizId: string }>()
const store = useQuizEditorStore()

onMounted(() => store.loadQuiz(props.quizId))
</script>

<template>
  <div class="quiz-editor-layout">
    <QuizEditorHeader />
    <main class="editor-body">
      <QuestionList />
    </main>
    <QuizEditorFooter />
  </div>
</template>

<style scoped>
.quiz-editor-layout {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100dvh;           /* dvh — not vh — adjusts for mobile browser chrome */
  overflow: hidden;
}
.editor-body {
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
```

---

### `src/3-widgets/QuestionList.vue` (widget — DnD container)

**Source:** RESEARCH.md Pattern 4 + PITFALLS.md §6.1–6.4

**CRITICAL DnD pattern — always UUID key, never index; mutate in-place:**
```vue
<!-- src/3-widgets/QuestionList.vue -->
<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import QuestionEditor from '@features/quiz-editor/ui/QuestionEditor.vue'

const store = useQuizEditorStore()

function onDragEnd() {
  // Renumber in-place — NEVER replace the array reference
  store.questions.forEach((q, index) => {
    q.order_index = index
  })
  // Batch upsert ALL questions immediately
  void store.reorderQuestions(store.questions)
}
</script>

<template>
  <VueDraggable
    v-model="store.questions"
    handle=".drag-handle"
    @end="onDragEnd"
  >
    <!-- :key MUST be UUID, never array index -->
    <QuestionEditor
      v-for="q in store.questions"
      :key="q.id"
      :question="q"
    />
  </VueDraggable>

  <button @click="store.addQuestion">+ Добавить вопрос</button>
</template>
```

**Anti-patterns:**
- Never `:key="index"` — use `:key="q.id"` (UUID)
- Never `store.questions = [...newItems]` — always mutate in-place via `splice()`
- Never add `UNIQUE` constraint on `(quiz_id, order_index)` in DB

---

### `src/4-features/auth/model/useAuthStore.ts` (store — auth session sync)

**Source:** RESEARCH.md Pattern 2

**Full store pattern:**
```typescript
// src/4-features/auth/model/useAuthStore.ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@shared/api/supabase'
import type { User } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isLoading = ref(true)

  // Call once from App.vue onMounted — establishes session sync
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

---

### `src/4-features/auth/ui/LoginForm.vue` and `RegisterForm.vue` (form-components)

**Source:** RESEARCH.md Pitfall 8 + CONTEXT.md D-04

**CRITICAL — use `defineField` composable, NOT the deprecated `<Field>` component:**
```typescript
// Inside <script setup> of LoginForm.vue / RegisterForm.vue
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import { useRouter, useRoute } from 'vue-router'

const schema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
})

const { defineField, handleSubmit, errors, isSubmitting } = useForm({
  validationSchema: toTypedSchema(schema)
})

const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const onSubmit = handleSubmit(async (values) => {
  try {
    await authStore.login(values.email, values.password)  // or register()
    const returnUrl = route.query.returnUrl as string | undefined
    router.push(returnUrl || '/')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Ошибка входа')
  }
})
```

**Anti-pattern:** Do NOT use `<Field>` or `<ErrorMessage>` Vue components from vee-validate — deprecated in v4.

---

### `src/4-features/quiz-editor/model/useQuizEditorStore.ts` (store — debounced auto-save)

**Source:** RESEARCH.md Pattern 3 + ARCHITECTURE.md §State Management Patterns

**Auto-save pattern:**
```typescript
// src/4-features/quiz-editor/model/useQuizEditorStore.ts
import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useDebounceFn } from '@shared/lib/debounce'   // hand-rolled (see 6-shared/lib/debounce.ts)
import { updateQuiz, fetchQuiz } from '@entities/quiz/api'
import { createQuestion, updateQuestion, deleteQuestion, reorderQuestions } from '@entities/question/api'
import type { Quiz } from '@entities/quiz/model'
import type { Question } from '@entities/question/model'
import { toast } from 'vue-sonner'

export const useQuizEditorStore = defineStore('quiz-editor', () => {
  const quiz = ref<Quiz | null>(null)
  const questions = ref<Question[]>([])
  const title = ref('')
  const description = ref('')
  const isDirty = ref(false)

  // 500ms debounce for text fields — boolean toggles save immediately
  const debouncedSaveMetadata = useDebounceFn(async () => {
    if (!quiz.value) return
    try {
      await updateQuiz(quiz.value.id, { title: title.value, description: description.value })
    } catch (err) {
      toast.error('Не удалось сохранить изменения')
    }
  }, 500)

  watch([title, description], debouncedSaveMetadata)

  async function loadQuiz(id: string) {
    // fetch quiz + questions; populate reactive refs
  }

  async function addQuestion() {
    // INSERT, append to questions, auto-scroll + focus
  }

  async function reorderQuestions(reordered: Question[]) {
    // batch upsert order_index for ALL questions
    // mutate in-place: questions.value.splice(0, questions.value.length, ...reordered)
  }

  async function publishToggle() {
    // Validate: ≥1 question, each has ≥2 options with ≥1 correct
    // UPDATE is_published immediately (no debounce)
  }

  return { quiz, questions, title, description, isDirty, loadQuiz, addQuestion, reorderQuestions, publishToggle }
})
```

**Key rules:**
- Text fields (title, description, time_limit_sec) → 500ms debounce
- Boolean toggles (is_required, is_correct, allow_back, show_stop_button, is_published) → immediate save
- `reorderQuestions`: always mutate questions array in-place with `splice()`, never replace the reference
- Publish validation enforced here, not in the form — per CONTEXT.md D-13

---

### `src/4-features/quiz-editor/ui/CoverUpload.vue` (component — file I/O)

**Source:** RESEARCH.md Pattern 6 + CONTEXT.md D-14–D-17

**Pattern — click-to-open and drag-and-drop, resize before upload:**
```typescript
// Inside CoverUpload.vue <script setup>
import { resizeImageToMaxWidth } from '@shared/lib/image'
import { supabase } from '@shared/api/supabase'
import { updateQuiz } from '@entities/quiz/api'
import { toast } from 'vue-sonner'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024  // 5 MB

async function handleFile(file: File) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    toast.error('Допустимые форматы: JPEG, PNG, WebP')
    return
  }
  if (file.size > MAX_BYTES) {
    toast.error('Максимальный размер файла — 5 МБ')
    return
  }

  const ext = file.name.split('.').pop()
  const path = `covers/${ownerId}/${quizId}/${crypto.randomUUID()}.${ext}`
  const resized = await resizeImageToMaxWidth(file, 1280)

  const { error } = await supabase.storage.from('covers').upload(path, resized)
  if (error) { toast.error('Ошибка загрузки обложки'); return }

  const { data } = supabase.storage.from('covers').getPublicUrl(path)
  await updateQuiz(quizId, { cover_url: data.publicUrl })
}

// Drag-and-drop wiring
function onDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files[0]
  if (file) handleFile(file)
}
```

**Placeholder when no cover:** icon + "Добавить обложку" label. No gradient background — per CONTEXT.md D-15.

---

### `src/5-entities/quiz/api.ts` (entity API — CRUD)

**Source:** RESEARCH.md §Code Examples (Quiz Entity API Layer)

**Full pattern (copy verbatim):**
```typescript
// src/5-entities/quiz/api.ts
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

export async function fetchQuiz(id: string): Promise<Quiz> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createQuiz(): Promise<Quiz> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('quizzes')
    .insert({
      title: 'Без названия',
      owner_id: user!.id,
      is_published: false,
      settings: {
        allow_back: true,
        show_stop_button: true,
        shuffle_questions: false,
        shuffle_answers: false
      }
    })
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

**FSD rule:** This file must NOT import from `4-features/`. Only imports from `6-shared`.

---

### `src/5-entities/question/api.ts` (entity API — CRUD + reorder)

**Source:** ARCHITECTURE.md §5-entities Slice Breakdown

**Reorder function pattern:**
```typescript
// src/5-entities/question/api.ts
import { supabase } from '@shared/api/supabase'
import type { Question } from './model'

export async function fetchQuestions(quizId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true })  // secondary: created_at asc
  if (error) throw error
  return data
}

export async function createQuestion(quizId: string, orderIndex: number): Promise<Question> {
  const { data, error } = await supabase
    .from('questions')
    .insert({ quiz_id: quizId, body: '', type: 'single', order_index: orderIndex, is_required: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateQuestion(id: string, patch: Partial<Question>): Promise<void> {
  const { error } = await supabase.from('questions').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) throw error
}

// Batch upsert for DnD reorder — called from useQuizEditorStore.reorderQuestions()
export async function reorderQuestions(questions: Pick<Question, 'id' | 'order_index'>[]): Promise<void> {
  const { error } = await supabase
    .from('questions')
    .upsert(questions.map(q => ({ id: q.id, order_index: q.order_index })))
  if (error) throw error
}
```

---

### `src/5-entities/answer-option/api.ts` (entity API — CRUD)

**Source:** ARCHITECTURE.md §5-entities Slice Breakdown

```typescript
// src/5-entities/answer-option/api.ts
import { supabase } from '@shared/api/supabase'
import type { AnswerOption } from './model'

export async function createAnswerOption(questionId: string, orderIndex: number): Promise<AnswerOption> {
  const { data, error } = await supabase
    .from('answer_options')
    .insert({ question_id: questionId, body: '', is_correct: false, order_index: orderIndex })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAnswerOption(id: string, patch: Partial<AnswerOption>): Promise<void> {
  const { error } = await supabase.from('answer_options').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteAnswerOption(id: string): Promise<void> {
  const { error } = await supabase.from('answer_options').delete().eq('id', id)
  if (error) throw error
}
```

---

### `src/6-shared/api/supabase.ts` (singleton)

**Source:** RESEARCH.md §Code Examples

```typescript
// src/6-shared/api/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@shared/config/env'

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
```

**FSD rule:** Only this file creates the Supabase client. All other layers import `supabase` from here.

---

### `src/6-shared/config/env.ts` (config — typed env vars)

**Source:** RESEARCH.md §Structure

```typescript
// src/6-shared/config/env.ts
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env')
}
```

---

### `src/6-shared/lib/image.ts` (utility — canvas resize)

**Source:** RESEARCH.md Pattern 6

**Copy verbatim — no external library needed:**
```typescript
// src/6-shared/lib/image.ts
export async function resizeImageToMaxWidth(file: File, maxWidth = 1280): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth  * scale
      canvas.height = img.naturalHeight * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => resolve(blob!), file.type)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}
```

---

### `src/6-shared/lib/debounce.ts` (utility — hand-rolled debounce)

**Source:** RESEARCH.md Open Question 3 (hand-roll instead of `@vueuse/core`)

```typescript
// src/6-shared/lib/debounce.ts
export function useDebounceFn<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
```

---

### `src/6-shared/types/index.ts` (shared types — QuizSettings shape)

**Source:** RESEARCH.md Open Question 2 + CONTEXT.md NAV-01/02

```typescript
// src/6-shared/types/index.ts

// Full JSONB shape for quizzes.settings
// Default: { allow_back: true, show_stop_button: true, shuffle_questions: false, shuffle_answers: false }
export interface QuizSettings {
  allow_back:         boolean
  show_stop_button:   boolean  // NAV-01 — required by UI-SPEC, not in original SPEC.md schema
  shuffle_questions:  boolean
  shuffle_answers:    boolean
}
```

---

### `supabase/migrations/001_init_profiles.sql` (migration)

**Source:** RESEARCH.md §Code Examples (Supabase Migration: profiles)

**Copy verbatim:**
```sql
-- supabase/migrations/001_init_profiles.sql
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

-- Auto-create profile on user signup
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

### `supabase/migrations/002_quizzes.sql` (migration)

**Source:** SPEC.md §quizzes + RESEARCH.md Pitfall 6 (show_stop_button in default settings)

```sql
-- supabase/migrations/002_quizzes.sql
CREATE TABLE quizzes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  title          text NOT NULL DEFAULT 'Без названия',
  description    text,
  cover_url      text,
  time_limit_sec int,
  is_published   bool NOT NULL DEFAULT false,
  -- JSONB default includes show_stop_button — required by NAV-01 (UI-SPEC)
  settings       jsonb NOT NULL DEFAULT '{"allow_back":true,"show_stop_button":true,"shuffle_questions":false,"shuffle_answers":false}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON quizzes (owner_id);
CREATE INDEX ON quizzes (is_published) WHERE is_published = true;
```

---

### `supabase/migrations/003_questions_answers.sql` (migration)

**Source:** SPEC.md §questions + §answer_options + PITFALLS.md §6.4

```sql
-- supabase/migrations/003_questions_answers.sql
CREATE TYPE question_type AS ENUM ('single', 'multiple');

CREATE TABLE questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid NOT NULL REFERENCES quizzes ON DELETE CASCADE,
  body        text NOT NULL DEFAULT '',
  type        question_type NOT NULL DEFAULT 'single',
  order_index int NOT NULL DEFAULT 0,
  is_required bool NOT NULL DEFAULT false
  -- NO UNIQUE constraint on (quiz_id, order_index) — batch reorder requires duplicates mid-transaction
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON questions (quiz_id);

CREATE TABLE answer_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions ON DELETE CASCADE,
  body        text NOT NULL DEFAULT '',
  is_correct  bool NOT NULL DEFAULT false,
  order_index int NOT NULL DEFAULT 0
);

ALTER TABLE answer_options ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON answer_options (question_id);

-- SECURITY DEFINER view: anon reads answer_options WITHOUT is_correct
-- (prevents correct answers leaking to quiz-takers — Phase 2 concern, create now)
CREATE VIEW answer_options_public AS
  SELECT id, question_id, body, order_index
  FROM answer_options;
```

---

### `supabase/migrations/007_rls_policies.sql` (migration — RLS dual-policy)

**Source:** RESEARCH.md Pattern 5 + ARCHITECTURE.md §RLS Design

**Dual-policy pattern (owner authenticated + guest anon):**
```sql
-- supabase/migrations/007_rls_policies.sql

-- ─── quizzes ──────────────────────────────────────────────
CREATE POLICY "owner_manage_quizzes"
  ON quizzes TO authenticated
  USING  ( owner_id = (SELECT auth.uid()) )
  WITH CHECK ( owner_id = (SELECT auth.uid()) );

CREATE POLICY "anon_read_published_quizzes"
  ON quizzes FOR SELECT TO anon
  USING ( is_published = true );

-- ─── questions ────────────────────────────────────────────
CREATE POLICY "owner_manage_questions"
  ON questions TO authenticated
  USING (
    quiz_id IN (SELECT id FROM quizzes WHERE owner_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    quiz_id IN (SELECT id FROM quizzes WHERE owner_id = (SELECT auth.uid()))
  );

CREATE POLICY "anon_read_questions_for_published"
  ON questions FOR SELECT TO anon
  USING (
    quiz_id IN (SELECT id FROM quizzes WHERE is_published = true)
  );

-- ─── answer_options ───────────────────────────────────────
CREATE POLICY "owner_manage_answer_options"
  ON answer_options TO authenticated
  USING (
    question_id IN (
      SELECT q.id FROM questions q
      JOIN quizzes qz ON qz.id = q.quiz_id
      WHERE qz.owner_id = (SELECT auth.uid())
    )
  );
-- NO anon SELECT on answer_options directly — use answer_options_public view

-- ─── quiz_access ──────────────────────────────────────────
CREATE POLICY "owner_manage_quiz_access"
  ON quiz_access TO authenticated
  USING (
    quiz_id IN (SELECT id FROM quizzes WHERE owner_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    quiz_id IN (SELECT id FROM quizzes WHERE owner_id = (SELECT auth.uid()))
  );
-- NO anon policy — token validation is Edge Function only

-- ─── Storage: covers bucket ───────────────────────────────
-- Bucket: public = true (cover images are displayed to anon users on /)
-- Storage INSERT policy: path must start with auth.uid() to prevent cross-user writes
-- INSERT policy (storage.objects):
--   bucket_id = 'covers'
--   AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
```

**Performance rule:** Always use `(SELECT auth.uid())` not `auth.uid()` — enables Postgres `initPlan` optimization (evaluated once per query, not per row).

---

## Shared Patterns

### Pattern A — FSD Import Discipline

**Apply to:** All files in all layers.
**Source:** RESEARCH.md Pattern 1 + ARCHITECTURE.md §FSD Layer Mapping

```typescript
// CORRECT: feature imports entity (lower number imports higher)
// 4-features/quiz-editor/model/useQuizEditorStore.ts
import { updateQuiz } from '@entities/quiz/api'         // 5-entities ✓
import { createQuestion } from '@entities/question/api'  // 5-entities ✓
import { supabase } from '@shared/api/supabase'          // 6-shared ✓

// WRONG: entity importing from feature — steiger CI will fail this
// 5-entities/quiz/api.ts — DO NOT import from @features/*

// WRONG: feature importing another feature — no cross-feature imports
// 4-features/auth — DO NOT import from @features/quiz-editor/*
```

**Layer→allowed imports:**
- `1-app` → any layer
- `2-pages` → `@widgets`, `@features`, `@entities`, `@shared`
- `3-widgets` → `@features`, `@entities`, `@shared`
- `4-features` → `@entities`, `@shared`
- `5-entities` → `@shared` only
- `6-shared` → within itself only

---

### Pattern B — Error Handling with Toast

**Apply to:** All feature stores and form submit handlers.
**Source:** CONTEXT.md D-12 + RESEARCH.md §Standard Stack (vue-sonner)

```typescript
// All async operations in stores and forms:
import { toast } from 'vue-sonner'

try {
  await someApiCall()
  toast.success('Сохранено')
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
  toast.error(message)
}
```

**Toast provider mounted once in `1-app/App.vue`:** `<Toaster position="top-right" richColors />`
**Consumers:** `toast.success()`, `toast.error()`, `toast.loading()` from `vue-sonner`

---

### Pattern C — Supabase Client Usage

**Apply to:** All entity API files (`5-entities/*/api.ts`) and feature stores (`4-features/*/model/*.ts`).
**Source:** RESEARCH.md §Code Examples (Supabase Client Singleton)

```typescript
import { supabase } from '@shared/api/supabase'

// Always check for error before using data
const { data, error } = await supabase.from('table').select('*')
if (error) throw error   // let caller handle via toast
return data
```

**Rule:** The supabase singleton is ONLY created in `6-shared/api/supabase.ts`. Never call `createClient()` elsewhere.

---

### Pattern D — Pinia Store Structure (Composition API style)

**Apply to:** All stores in `4-features/*/model/`.
**Source:** RESEARCH.md Pattern 2 + ARCHITECTURE.md §State Management Patterns

```typescript
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useSomeStore = defineStore('store-name', () => {
  // State: ref()
  const item = ref<SomeType | null>(null)
  const isLoading = ref(false)

  // Computed: computed()
  const derivedValue = computed(() => item.value?.field ?? null)

  // Actions: async functions
  async function fetchItem(id: string) {
    isLoading.value = true
    try {
      item.value = await apiCall(id)
    } finally {
      isLoading.value = false
    }
  }

  // Expose everything via return object
  return { item, isLoading, derivedValue, fetchItem }
})
```

**Rule:** Stores use Composition API style (`defineStore('name', () => {...})`), NOT Options API style.

---

### Pattern E — Publish Validation (at publish time, not at save time)

**Apply to:** `useQuizEditorStore.publishToggle()`.
**Source:** CONTEXT.md D-13

```typescript
// Validation runs only when toggling is_published → true
function validateForPublish(questions: Question[], answerOptions: Record<string, AnswerOption[]>): string | null {
  if (questions.length === 0) return 'Добавьте хотя бы один вопрос'
  for (const q of questions) {
    const opts = answerOptions[q.id] ?? []
    if (opts.length < 2) return `Вопрос «${q.body || '...'}» должен иметь минимум 2 варианта ответа`
    if (!opts.some(o => o.is_correct)) return `Вопрос «${q.body || '...'}» должен иметь хотя бы 1 правильный ответ`
  }
  return null  // valid
}

// Auto-save does NOT validate — quiz can be in any state when saved
```

---

### Pattern F — RLS: Always ENABLE ROW LEVEL SECURITY Immediately

**Apply to:** Every `CREATE TABLE` in every migration file.
**Source:** RESEARCH.md Pitfall 1 + PITFALLS.md §7.3

```sql
CREATE TABLE some_table ( ... );
-- This line MUST immediately follow CREATE TABLE — no exceptions
ALTER TABLE some_table ENABLE ROW LEVEL SECURITY;
```

---

### Pattern G — shadcn-vue Component Installation

**Apply to:** `src/6-shared/ui/` — all UI primitive components.
**Source:** CONTEXT.md D-18 + RESEARCH.md §Standard Stack

```bash
# One-time init (run once during project scaffold)
npx shadcn-vue@latest init

# Add individual components (source-copied into src/6-shared/ui/)
npx shadcn-vue@latest add button input dialog tabs switch tooltip
```

**Rule:** shadcn-vue components are source-copied, not imported from node_modules. They live in `src/6-shared/ui/`. They have zero domain knowledge.

---

## No Analog Found

All files in Phase 1 are new (greenfield project). The table below lists files that have no well-established pattern in the research and require additional implementation judgment:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/5-entities/quiz/ui/QuizCard.vue` | display-component | — | Layout/design details not fully specified in RESEARCH.md — reference UI-SPEC.md §QuizCard anatomy |
| `src/3-widgets/AppHeader.vue` | widget | event-driven | Exact header layout / responsive behavior not in RESEARCH.md — reference UI-SPEC.md |
| `src/4-features/quiz-editor/ui/QuestionEditor.vue` | component | CRUD | Complex local state (answer option list); scroll-into-view on add. Reference CONTEXT.md D-09–D-11 |
| `src/4-features/quiz-editor/ui/NavigationSettings.vue` | component | event-driven | NAV-01/02 toggle panel; maps to `settings.show_stop_button` and `settings.allow_back` — reference UI-SPEC.md §footer anatomy |
| `supabase/migrations/004_quiz_access.sql` | migration | CRUD | Phase 2 table created in Phase 1 for schema completeness; no Phase 1 UI uses it |
| `supabase/migrations/005_sessions.sql` | migration | CRUD | Phase 2 table; same as above |
| `supabase/migrations/006_subscriptions.sql` | migration | CRUD | Phase 5 table; same as above |
| `steiger.config.ts` | linter-config | — | Whether steiger auto-detects numeric FSD prefix dirs is unresolved — see RESEARCH.md Open Question 1 |

---

## Critical Anti-Patterns (from RESEARCH.md and PITFALLS.md)

The following must be flagged in every code review and CI check:

| Anti-Pattern | Effect | Correct Pattern |
|---|---|---|
| `:key="index"` on DnD list | DOM node reuse corrupts drag | `:key="question.id"` (UUID) |
| `questions.value = [...newItems]` after drag | SortableJS loses array reference | `questions.value.splice(0, questions.value.length, ...newItems)` |
| `UNIQUE` on `(quiz_id, order_index)` | Batch upsert impossible | No uniqueness constraint; `ORDER BY order_index ASC, created_at ASC` |
| `tailwind.config.js` exists | v4 ignores it; page renders unstyled | `@theme {}` in `main.css` |
| `@tailwind base` in CSS | Removed in v4 | `@import "tailwindcss"` |
| `100vh` in editor layout | Breaks on mobile browser chrome | `100dvh` |
| `auth.uid()` in RLS (not subquery form) | Per-row evaluation; 10× slower | `(SELECT auth.uid())` |
| No `ENABLE ROW LEVEL SECURITY` | Table fully open to anon reads | `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY` immediately after `CREATE TABLE` |
| anon SELECT on `answer_options` directly | `is_correct` leaks to guests | Grant SELECT on `answer_options_public` view only |
| `<Field>` component in vee-validate | Deprecated in v4; loses TS inference | `defineField` composable |
| Business logic in `6-shared` | FSD violation; steiger CI fail | Domain logic belongs in `4-features` or `5-entities` |
| Feature importing another feature | FSD violation; steiger CI fail | Cross-feature communication via router or entity layer |

---

## Metadata

**Analog search scope:** Entire codebase — no `src/` or `supabase/` directories exist yet (greenfield).
**Files scanned:** 0 existing source files.
**Pattern sources:** `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/phases/01-foundation-auth-and-quiz-editor/01-RESEARCH.md`, `.planning/phases/01-foundation-auth-and-quiz-editor/01-CONTEXT.md`, `SPEC.md`
**Pattern extraction date:** 2026-05-16
