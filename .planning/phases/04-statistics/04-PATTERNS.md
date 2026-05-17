# Phase 4: Statistics - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 13 (new/modified)
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/2-pages/QuizStatsPage.vue` | page | request-response | `src/2-pages/AiWizardPage.vue` | exact |
| `src/3-widgets/QuizStatsWidget.vue` | widget | request-response | `src/3-widgets/QuizTakingWidget.vue` | exact |
| `src/4-features/quiz-stats/model/useQuizStatsStore.ts` | store | request-response | `src/4-features/quiz-share/model/useQuizShareStore.ts` | exact |
| `src/4-features/quiz-stats/ui/SummaryCards.vue` | component | request-response | `src/4-features/quiz-taking/ui/QuizIntroScreen.vue` | role-match |
| `src/4-features/quiz-stats/ui/ResultsTable.vue` | component | request-response | `src/4-features/quiz-share/ui/AccessLinkList.vue` | role-match |
| `src/4-features/quiz-stats/ui/AccuracySection.vue` | component | request-response | `src/4-features/quiz-taking/ui/GracefulState.vue` | role-match |
| `src/6-shared/ui/ProgressBar.vue` | ui | transform | `src/6-shared/ui/ProgressBar.vue` (extend) | exact |
| `src/6-shared/lib/format.ts` | utility | transform | `src/6-shared/lib/format.ts` (extend) | exact |
| `supabase/migrations/013_quiz_stats_rpc.sql` | migration | CRUD | `supabase/migrations/009_phase2_schema.sql` | role-match |
| `src/1-app/router/index.ts` | config | request-response | `src/1-app/router/index.ts` (modify) | exact |
| `src/3-widgets/QuizEditorHeader.vue` | widget | request-response | `src/3-widgets/QuizEditorHeader.vue` (modify) | exact |
| `src/5-entities/quiz/ui/QuizCard.vue` | component | request-response | `src/5-entities/quiz/ui/QuizCard.vue` (modify) | exact |
| `src/2-pages/MyQuizListPage.vue` | page | request-response | `src/2-pages/MyQuizListPage.vue` (no change needed — QuizCard handles button) | exact |

---

## Pattern Assignments

### `src/2-pages/QuizStatsPage.vue` (page, request-response)

**Analog:** `src/2-pages/AiWizardPage.vue`

The page pattern in this project is a pure 1-line assembler that delegates everything to a widget. No domain logic, no store imports, no onMounted.

**Full file pattern** (`src/2-pages/AiWizardPage.vue`, lines 1–9):
```vue
<script setup lang="ts">
// AiWizardPage — thin assembler for the dedicated full-screen /ai-wizard route
import AiWizardWidget from '@widgets/AiWizardWidget.vue'
</script>

<template>
  <AiWizardWidget />
</template>
```

**Apply:** `QuizStatsPage.vue` imports `QuizStatsWidget` from `@widgets/QuizStatsWidget.vue` and renders nothing else. The route param `id` is read by the widget, not the page.

---

### `src/3-widgets/QuizStatsWidget.vue` (widget, request-response)

**Analog:** `src/3-widgets/QuizTakingWidget.vue`

The widget pattern: owns `useRoute()`, calls `store.init(param)` in `onMounted`, conditionally renders feature UI components based on store state.

**Imports pattern** (`src/3-widgets/QuizTakingWidget.vue`, lines 1–10):
```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'
import QuizIntroScreen from '@features/quiz-taking/ui/QuizIntroScreen.vue'
import GracefulState from '@features/quiz-taking/ui/GracefulState.vue'
// ... more feature UI components
```

**onMounted + store init pattern** (`src/3-widgets/QuizTakingWidget.vue`, lines 20–23):
```typescript
onMounted(() => {
  const token = route.params.token as string
  void store.init(token)
})
```

**Conditional rendering pattern** (`src/3-widgets/QuizTakingWidget.vue`, lines 64–80):
```vue
<!-- idle → intro card -->
<QuizIntroScreen v-if="store.sessionStatus === 'idle'" />

<!-- not_ready → graceful state -->
<GracefulState
  v-else-if="store.sessionStatus === 'not_ready'"
  heading="Тест пока не готов"
  body="..."
/>

<!-- active → full UI -->
<div v-else-if="store.sessionStatus === 'active'" class="taking-layout">
  <!-- composed feature components -->
</div>
```

**Apply to `QuizStatsWidget.vue`:**
- `onMounted` → `store.loadStats(route.params.id as string)`
- Three v-if branches: `isLoading` → skeletons, `isEmpty` (stats.totalAttempts === 0) → `<EmptyStatsState>`, default → `<SummaryCards>` + `<ResultsTable>` + `<AccuracySection>`
- Page shell: `<AppHeader />` + `<main class="mx-auto max-w-5xl px-4 py-12">`
- Use `min-h-[100dvh]` (never `100vh`) per UI-SPEC and RESEARCH anti-patterns

---

### `src/4-features/quiz-stats/model/useQuizStatsStore.ts` (store, request-response)

**Analog:** `src/4-features/quiz-share/model/useQuizShareStore.ts`

**Imports pattern** (`src/4-features/quiz-share/model/useQuizShareStore.ts`, lines 1–11):
```typescript
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { supabase } from '@shared/api/supabase'
import { fetchAccessLinks, deleteAccessLink } from '@entities/quiz-access/api'
import type { QuizAccess } from '@entities/quiz-access/model'
```

**Store definition + state refs** (`src/4-features/quiz-share/model/useQuizShareStore.ts`, lines 12–17):
```typescript
export const useQuizShareStore = defineStore('quiz-share', () => {
  const links = ref<QuizAccess[]>([])
  const isLoading = ref(false)
  const isCreating = ref(false)
  const lastCreated = ref<...| null>(null)
```

**Async load with toast.error + finally** (`src/4-features/quiz-share/model/useQuizShareStore.ts`, lines 18–27):
```typescript
async function loadLinks(quizId: string) {
  isLoading.value = true
  try {
    links.value = await fetchAccessLinks(quizId)
  } catch {
    toast.error('Не удалось загрузить ссылки. Проверьте соединение.')
  } finally {
    isLoading.value = false
  }
}
```

**Return object pattern** (`src/4-features/quiz-share/model/useQuizShareStore.ts`, line 79):
```typescript
return { links, isLoading, isCreating, lastCreated, loadLinks, createLink, removeLink }
```

**Apply to `useQuizStatsStore.ts`:**
- Uses `supabase.rpc('get_quiz_stats', { p_quiz_id: quizId })` instead of entity API fetchers
- Also calls `supabase.rpc('get_quiz_accuracy', ...)` but ONLY when `isPro.value === true` (D-06)
- Pro status loaded via `supabase.from('subscriptions').select('plan,status').eq('user_id', uid).maybeSingle()` — treat `null` result as Free (Pitfall 5)
- Also imports `useAuthStore` from `@features/auth/model/useAuthStore` for `user.id`
- Full store skeleton is in RESEARCH.md Pattern 2 (lines 286–376) — copy it verbatim

---

### `src/4-features/quiz-stats/ui/SummaryCards.vue` (component, request-response)

**Analog:** `src/2-pages/QuizResultPage.vue` (display-only component pattern with conditional states)

**Loading skeleton pattern** (`src/2-pages/MyQuizListPage.vue`, lines 83–87):
```vue
<div
  v-if="isLoading"
  class="text-sm text-neutral-400"
>
  Загрузка...
</div>
```

**Card container pattern** (UI-SPEC + RESEARCH Pattern from 04-RESEARCH.md line 583):
```vue
<div class="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
  <p class="text-[13px] uppercase tracking-wide text-neutral-400">Всего попыток</p>
  <p class="mt-2 text-4xl font-semibold text-neutral-50">{{ stats.totalAttempts }}</p>
</div>
```

**Grid layout** (UI-SPEC Component & Layout Inventory):
```vue
<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
  <!-- 3 cards: Всего попыток / Процент завершений / Средний балл -->
</div>
```

**Props pattern** — receives `stats` prop typed against `QuizStats` interface; uses `formatPercent` and `formatScore` from `@shared/lib/format`.

**Loading skeleton** — `animate-pulse bg-neutral-800 rounded-xl h-28` for each card placeholder while `isLoading` is true.

---

### `src/4-features/quiz-stats/ui/ResultsTable.vue` (component, request-response)

**Analog:** `src/4-features/quiz-share/ui/AccessLinkList.vue`

**Table structure** (UI-SPEC Component & Layout Inventory):
```vue
<div class="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
  <!-- Header row -->
  <div class="grid grid-cols-3 bg-neutral-800 px-4 py-2">
    <span class="text-[13px] uppercase tracking-wide text-neutral-400">Имя</span>
    <span class="text-[13px] uppercase tracking-wide text-neutral-400">Балл</span>
    <span class="text-[13px] uppercase tracking-wide text-neutral-400">Завершён</span>
  </div>
  <!-- Body rows -->
  <div
    v-for="row in sortedRows"
    :key="row.name ?? row.finished_at"
    class="grid grid-cols-3 border-t border-neutral-800 px-4 py-3 hover:bg-neutral-800/50"
  >
    <!-- cells -->
  </div>
</div>
```

**Default sort:** `finished_at DESC` (latest first). Implement client-side `computed` sort using `ref<'name' | 'score' | 'finished_at'>` sortKey and `ref<'asc' | 'desc'>` sortDir. Toggle on column header click. Data volume is small (one row per unique taker).

**Timestamp format:** `formatShortDateTime(row.finished_at)` → `"17 мая, 14:32"` (helper to add to `format.ts`).

**Score format:** `formatScore(row.score, totalQuestions)` → `"7,5 из 10"` — receives `totalQuestions` as prop from the store (include in `get_quiz_stats` RPC payload per RESEARCH open question #1).

**Responsive:** wrap table in `overflow-x-auto` rather than reflowing on narrow viewports (UI-SPEC Interaction Contract).

---

### `src/4-features/quiz-stats/ui/AccuracySection.vue` (component, request-response)

**Analog:** `src/4-features/quiz-taking/ui/GracefulState.vue` (icon + centered content pattern) + RESEARCH.md Pattern 3

**Pro gate overlay pattern** (RESEARCH.md Pattern 3, lines 383–416):
```vue
<div class="relative rounded-xl border border-neutral-800 bg-neutral-900 p-6">
  <h2 class="mb-4 text-xl font-semibold">Точность по вопросам</h2>

  <!-- Skeleton bars when not Pro (data never fetched per D-06) -->
  <template v-if="!isPro">
    <div
      v-for="i in 4"
      :key="i"
      class="mb-3 h-6 animate-pulse rounded bg-neutral-800"
    />
    <!-- Blur + CTA overlay -->
    <div class="absolute inset-0 flex flex-col items-center justify-center
                rounded-xl backdrop-blur-md bg-neutral-950/60">
      <Lock class="mb-3 h-8 w-8 text-neutral-400" />
      <p class="mb-1 text-base font-semibold">Точность по вопросам — функция Pro</p>
      <p class="mb-4 max-w-xs text-center text-sm text-neutral-400">
        Узнайте, на каких вопросах тестируемые ошибаются чаще всего.
        Доступно на тарифе Pro.
      </p>
      <Button variant="default" size="sm" @click="router.push('/billing')">
        Перейти на Pro
      </Button>
    </div>
  </template>

  <!-- Real accuracy bars (Pro only) -->
  <template v-else>
    <!-- accuracy rows using ProgressBar size="md" -->
  </template>
</div>
```

**Accuracy bar row pattern** (RESEARCH.md Code Examples, lines 566–578):
```vue
<div class="flex items-center gap-3">
  <span class="flex-1 truncate text-sm text-neutral-300">{{ row.body }}</span>
  <div class="w-40 shrink-0">
    <ProgressBar :value="row.accuracy_percent ?? 0" size="md" />
  </div>
  <span class="w-10 shrink-0 text-right text-sm font-semibold text-neutral-200">
    {{ formatPercent(row.accuracy_percent) }}
  </span>
</div>
```

**Lock icon import:**
```typescript
import { Lock } from 'lucide-vue-next'
```

---

### `src/6-shared/ui/ProgressBar.vue` (ui, transform) — EXTEND

**Current file** (`src/6-shared/ui/ProgressBar.vue`, lines 1–15):
```vue
<script setup lang="ts">
defineProps<{
  value: number // 0–100 percent
}>()
</script>

<template>
  <div class="h-1 w-full rounded-full bg-neutral-800">
    <div
      class="h-1 rounded-full bg-orange-500 transition-all duration-300"
      :style="{ width: `${value}%` }"
    />
  </div>
</template>
```

**Extension:** Add `size` prop with values `'sm'` (default, existing `h-1`) and `'md'` (new, `h-2`). Use `cva` or conditional class binding:

```vue
<script setup lang="ts">
withDefaults(defineProps<{
  value: number
  size?: 'sm' | 'md'
}>(), { size: 'sm' })
</script>

<template>
  <div :class="['w-full rounded-full bg-neutral-800', size === 'md' ? 'h-2' : 'h-1']">
    <div
      :class="['rounded-full bg-orange-500 transition-all duration-300', size === 'md' ? 'h-2' : 'h-1']"
      :style="{ width: `${value}%` }"
    />
  </div>
</template>
```

Existing callers pass no `size` prop → default `'sm'` maintains backward compatibility.

---

### `src/6-shared/lib/format.ts` (utility, transform) — EXTEND

**Existing pattern** (`src/6-shared/lib/format.ts`, lines 1–11):
```typescript
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} сек`
  // ...
}
```

**Add three helpers** (RESEARCH.md Pattern 4, lines 421–449) — append to the bottom of the file, matching the existing JSDoc comment style:

```typescript
/** Format a 0–100 percent value, e.g. 73.5 → "73,5%" */
export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(1).replace('.', ',')}%`
}

/** Format a numeric score, e.g. score=7.5, total=10 → "7,5 из 10" */
export function formatScore(score: number | null, totalQuestions: number): string {
  if (score === null) return '—'
  const s = score % 1 === 0 ? score.toFixed(0) : score.toFixed(1).replace('.', ',')
  return `${s} из ${totalQuestions}`
}

/** Format a timestamptz ISO string to Russian short date+time, e.g. "17 мая, 14:32" */
export function formatShortDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('ru-RU', {
    day:    'numeric',
    month:  'long',
    hour:   '2-digit',
    minute: '2-digit',
  }).replace(' г.', '').replace(/(\d+\s+\w+)/, '$1,')
}
```

Note: `formatScore` in `QuizResultPage.vue` (lines 23–26) is a local inline implementation — these shared helpers supersede it but leave the page's local copy intact for now (it is functionally equivalent).

---

### `supabase/migrations/013_quiz_stats_rpc.sql` (migration, CRUD)

**Analog:** `supabase/migrations/009_phase2_schema.sql` (owner RLS policies pattern) and `supabase/migrations/012_ai_jobs.sql` (SECURITY DEFINER function pattern).

**Migration naming convention:** `013_quiz_stats_rpc.sql` — sequential number, snake_case noun describing the change.

**RPC function pattern** (RESEARCH.md Pattern 1, lines 176–283) — copy both `get_quiz_stats` and `get_quiz_accuracy` functions verbatim. Key structural requirements:

```sql
CREATE OR REPLACE FUNCTION get_quiz_stats(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Authorization check MUST be first statement (Pitfall 2)
  SELECT owner_id INTO v_owner_id
  FROM quizzes WHERE id = p_quiz_id;

  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  -- ... aggregation body ...
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_stats(uuid) TO authenticated;
```

Include `totalQuestions` in `get_quiz_stats` return payload (RESEARCH open question #1):
```sql
'totalQuestions', (SELECT COUNT(*) FROM questions WHERE quiz_id = p_quiz_id),
```

---

### `src/1-app/router/index.ts` (config, request-response) — MODIFY

**Existing route pattern** (`src/1-app/router/index.ts`, lines 19–21):
```typescript
{ path: '/my',       component: () => import('@pages/MyQuizListPage.vue'), meta: { requiresAuth: true } },
{ path: '/editor/:id', component: () => import('@pages/QuizEditorPage.vue'), meta: { requiresAuth: true } },
```

**Add after the `/editor/:id` route:**
```typescript
{ path: '/quiz/:id/stats', component: () => import('@pages/QuizStatsPage.vue'), meta: { requiresAuth: true } },
```

Route param is `:id` (not `:quizId`) — the store reads `route.params.id as string`. See RESEARCH Pitfall 6.

---

### `src/3-widgets/QuizEditorHeader.vue` (widget, request-response) — MODIFY

**Existing Button pattern** (`src/3-widgets/QuizEditorHeader.vue`, lines 31–39):
```vue
<Button
  variant="outline"
  size="sm"
  @click="router.push('/ai-wizard')"
>
  <Sparkles class="h-4 w-4" />
  Создать с ИИ
</Button>
```

**Add "Статистика" button** in the `ml-auto flex items-center gap-3` row (lines 30–51), before the existing "Создать с ИИ" button:
```vue
<Button
  v-if="editorStore.quiz"
  variant="outline"
  size="sm"
  @click="router.push(`/quiz/${editorStore.quiz.id}/stats`)"
>
  <BarChart3 class="h-4 w-4" />
  Статистика
</Button>
```

Add `BarChart3` to the `lucide-vue-next` import on line 3.

---

### `src/5-entities/quiz/ui/QuizCard.vue` (component, request-response) — MODIFY

**Existing actions row pattern** (`src/5-entities/quiz/ui/QuizCard.vue`, lines 64–85):
```vue
<div
  v-if="showActions"
  class="mt-auto flex items-center gap-1 border-t border-neutral-800 pt-2"
>
  <Button
    variant="ghost"
    size="sm"
    class="flex-1"
    @click="router.push('/editor/' + quiz.id)"
  >
    <Pencil class="h-3.5 w-3.5" />
    Изменить
  </Button>
  <Button variant="ghost" size="sm" ...>
    <Trash2 class="h-3.5 w-3.5" />
  </Button>
</div>
```

**Add "Статистика" button** between Изменить and Trash2:
```vue
<Button
  variant="ghost"
  size="sm"
  class="flex-1"
  @click="router.push(`/quiz/${quiz.id}/stats`)"
>
  <BarChart3 class="h-3.5 w-3.5" />
  Статистика
</Button>
```

Add `BarChart3` to the `lucide-vue-next` import on line 3. `useRouter` is already imported via the existing `const router = useRouter()` (line 17). Adjust the `flex-1` split between Изменить and Статистика as needed — both buttons share the available space; the Trash2 icon-only button stays at the end.

---

## Shared Patterns

### Authentication Guard
**Source:** `src/1-app/router/index.ts`, lines 28–35
**Apply to:** `/quiz/:id/stats` route registration
```typescript
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.init()
  const requiresAuth = to.matched.some(r => r.meta.requiresAuth)
  if (requiresAuth && !authStore.user) {
    return { path: '/auth', query: { returnUrl: to.fullPath } }
  }
})
```
The guard is already in place — adding `meta: { requiresAuth: true }` to the new route is sufficient.

### Async Load Error Handling (toast.error + finally)
**Source:** `src/4-features/quiz-share/model/useQuizShareStore.ts`, lines 18–27
**Apply to:** `useQuizStatsStore.loadStats()`, `useQuizStatsStore.loadProStatus()`
```typescript
isLoading.value = true
try {
  // ... supabase call
} catch {
  toast.error('Не удалось загрузить ...')
} finally {
  isLoading.value = false
}
```

### Supabase RPC Call
**Source:** `src/4-features/quiz-share/model/useQuizShareStore.ts` line 41 (Edge Function invoke pattern; RPC is analogous)
**Apply to:** `useQuizStatsStore.ts`
```typescript
const { data, error } = await supabase.rpc('get_quiz_stats', { p_quiz_id: quizId })
if (error) throw error
```

### Empty State Component Pattern
**Source:** `src/4-features/quiz-list/ui/EmptyState.vue`, lines 11–38
**Apply to:** empty-state block inside `QuizStatsWidget.vue`
```vue
<div class="flex min-h-[400px] flex-col items-center justify-center">
  <BarChart3 class="h-12 w-12 text-neutral-600" />
  <h2 class="mt-6 text-xl font-semibold text-neutral-50">Пока никто не проходил тест</h2>
  <p class="mt-2 max-w-sm text-center text-base text-neutral-400">
    Поделитесь ссылкой на тест — здесь появится статистика по попыткам и результатам.
  </p>
</div>
```

### Page Shell Layout
**Source:** `src/2-pages/MyQuizListPage.vue`, lines 54–57
**Apply to:** `QuizStatsWidget.vue` outer shell
```vue
<div class="min-h-[100dvh] bg-neutral-950">
  <AppHeader />
  <main class="mx-auto max-w-5xl px-4 py-12">
    <!-- content -->
  </main>
</div>
```
Note: `max-w-5xl` (stats page) vs `max-w-7xl` (MyQuizListPage) per UI-SPEC.

### Loading Skeleton
**Source:** RESEARCH.md Pattern 3 (animate-pulse pattern)
**Apply to:** `SummaryCards.vue`, `ResultsTable.vue`, `AccuracySection.vue` while `isLoading` is true
```vue
<div class="animate-pulse rounded-xl bg-neutral-800 h-28 w-full" />
```

---

## No Analog Found

All files have close analogs in the codebase.

---

## Metadata

**Analog search scope:** `src/2-pages/`, `src/3-widgets/`, `src/4-features/`, `src/5-entities/`, `src/6-shared/`, `supabase/migrations/`
**Files scanned:** 18 source files + 12 migration files
**Pattern extraction date:** 2026-05-17
