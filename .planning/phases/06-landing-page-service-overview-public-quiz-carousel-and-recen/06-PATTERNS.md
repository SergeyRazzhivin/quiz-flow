# Phase 6: Landing Page — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 9 (5 new, 4 modified)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/2-pages/LandingPage.vue` | page (assembler) | request-response | `src/2-pages/QuizListPage.vue` | exact |
| `src/3-widgets/HeroSection.vue` | widget | request-response | `src/3-widgets/AppHeader.vue` (auth branching) | role-match |
| `src/3-widgets/HowItWorksSection.vue` | widget | static | `src/3-widgets/AppFooter.vue` (static widget) | role-match |
| `src/3-widgets/QuizCarousel.vue` | widget | CRUD + event-driven | `src/2-pages/QuizListPage.vue` (fetch + QuizCard render) | role-match |
| `src/3-widgets/PricingTeaserSection.vue` | widget | static | `src/4-features/payment/ui/PricingCards.vue` | data-flow-match |
| `src/1-app/router/index.ts` | config | — | self (existing file) | exact |
| `src/3-widgets/AppHeader.vue` | widget | request-response | self (existing file) | exact |
| `src/3-widgets/AppFooter.vue` | widget | static | self (existing file) | exact |
| `src/2-pages/QuizResultPage.vue` | page | request-response | self (existing file) | exact |
| `src/5-entities/quiz/api.ts` | entity API | CRUD | self (existing file) | exact |

---

## Pattern Assignments

### `src/2-pages/LandingPage.vue` (page, assembler)

**Analog:** `src/2-pages/QuizListPage.vue` (lines 1–58)

**Imports pattern** (lines 1–8):
```vue
<script setup lang="ts">
import AppHeader from '@widgets/AppHeader.vue'
import AppFooter from '@widgets/AppFooter.vue'
```

**Core page-assembler pattern** (lines 24–57):
```vue
<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <!-- widget slots -->
    </main>
    <AppFooter />
  </div>
</template>
```

**Key constraint:** Page must stay ~80 lines. No data fetching, no business logic — all moved into child widgets. Follow `QuizListPage.vue` literally: `flex min-h-screen flex-col` wrapper, `AppHeader` + `AppFooter` bookends, `max-w-6xl mx-auto px-6` inner container.

**LandingPage deviation:** The landing has no `<main>` wrapper restricting widgets to `max-w-6xl` — each section widget controls its own max-width so full-bleed tinted bands (`bg-neutral-900/50`) are possible. Replace the single `<main>` with bare section widget composition:

```vue
<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <HeroSection />
    <HowItWorksSection />
    <QuizCarousel />
    <PricingTeaserSection />
    <AppFooter />
  </div>
</template>
```

---

### `src/3-widgets/HeroSection.vue` (widget, request-response)

**Analog:** `src/3-widgets/AppHeader.vue` (lines 1–101) — auth-state branching pattern

**Imports pattern** (lines 1–8):
```vue
<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import Button from '@shared/ui/Button.vue'

const authStore = useAuthStore()
```

**Auth-state branching pattern** (lines 62–97 of AppHeader.vue):
```vue
<template v-if="authStore.user">
  <!-- authenticated state -->
  <RouterLink to="/my">
    <Button variant="default" size="sm">Мои тесты</Button>
  </RouterLink>
</template>
<template v-else>
  <!-- unauthenticated state -->
  <RouterLink to="/auth">
    <Button variant="outline" size="sm">Войти</Button>
  </RouterLink>
</template>
```

**Gradient CTA button pattern** (from `PricingCards.vue` line 156):
```vue
<button
  type="button"
  class="h-10 cursor-pointer rounded-lg bg-linear-to-r from-violet-600 to-indigo-600 px-8 text-sm font-medium text-white transition-opacity hover:opacity-90"
>
  Начать бесплатно
</button>
```

**Core HeroSection pattern** (derived from UI-SPEC + AppHeader auth pattern):
```vue
<template>
  <section class="py-16 text-center md:py-20">
    <div class="mx-auto max-w-3xl px-6">
      <h1 class="text-4xl font-semibold leading-[1.15] text-neutral-50 md:text-5xl">
        Создавай тесты с AI за секунды
      </h1>
      <p class="mt-4 text-base leading-relaxed text-neutral-400">
        Загрузи текст — нейросеть сгенерирует готовый тест. Сразу отправляй участникам и смотри результаты.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <!-- Primary CTA — unauthenticated -->
        <RouterLink v-if="!authStore.user" to="/auth">
          <button class="h-10 cursor-pointer rounded-lg bg-linear-to-r from-violet-600 to-indigo-600 px-8 text-sm font-medium text-white transition-opacity hover:opacity-90">
            Начать бесплатно
          </button>
        </RouterLink>
        <!-- Primary CTA — authenticated -->
        <RouterLink v-else to="/my">
          <Button variant="default">Мои тесты</Button>
        </RouterLink>
        <!-- Secondary CTA — both states -->
        <RouterLink to="/quizzes">
          <Button variant="outline">Смотреть тесты</Button>
        </RouterLink>
      </div>
    </div>
  </section>
</template>
```

---

### `src/3-widgets/HowItWorksSection.vue` (widget, static)

**Analog:** `src/3-widgets/AppFooter.vue` (static widget, no data dependencies) + `PricingCards.vue` (card grid + Check icon)

**Imports pattern:**
```vue
<script setup lang="ts">
// No imports beyond RouterLink if needed — fully static content
</script>
```

**Card grid pattern** (from `PricingCards.vue` lines 88–130):
```vue
<!-- Step cards: 1-col mobile → 3-col sm -->
<div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
    <!-- step counter badge + title + body -->
  </div>
</div>
```

**Step counter badge** (UI-SPEC — gradient circle):
```vue
<div class="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-violet-600 to-indigo-600 text-sm font-semibold text-white">
  1
</div>
```

**Full section wrapper pattern** (tinted band — UI-SPEC):
```vue
<section class="bg-neutral-900/50 py-12">
  <div class="mx-auto max-w-6xl px-6">
    <h2 class="mb-8 text-xl font-semibold text-neutral-50">Как это работает</h2>
    <!-- grid of step cards -->
  </div>
</section>
```

**Step copy** (from UI-SPEC copywriting contract — first draft):
1. "Загрузи текст" — "Скопируй материал или загрузи файл PDF/DOCX — любой объём"
2. "AI создаёт тест" — "Нейросеть за секунды генерирует вопросы с вариантами ответов"
3. "Поделись и проверяй" — "Отправь ссылку участникам и сразу смотри результаты"

---

### `src/3-widgets/QuizCarousel.vue` (widget, CRUD + event-driven)

**Analog:** `src/2-pages/QuizListPage.vue` (fetch pattern + QuizCard render) + carousel JS from RESEARCH.md Pattern 3

**Imports pattern:**
```vue
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { fetchCarouselQuizzes } from '@entities/quiz/api'
import type { Quiz } from '@entities/quiz/model'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import QuizCard from '@entities/quiz/ui/QuizCard.vue'
import Button from '@shared/ui/Button.vue'
```

**Fetch + loading pattern** (from `QuizListPage.vue` lines 9–20):
```typescript
const quizzes = ref<Quiz[]>([])
const isLoading = ref(true)
const error = ref(false)

onMounted(async () => {
  try {
    quizzes.value = await fetchCarouselQuizzes(12)
  } catch {
    error.value = true
  } finally {
    isLoading.value = false
  }
})
```

**Carousel auto-advance timer pattern** (RESEARCH.md Pattern 3 — verified approach):
```typescript
const currentIndex = ref(0)
const CARD_WIDTH = 256   // w-64
const GAP = 16           // gap-4

let timer: ReturnType<typeof setInterval> | null = null

const maxIndex = computed(() =>
  Math.max(0, quizzes.value.length - visibleCount.value)
)

const trackStyle = computed(() => ({
  transform: `translateX(-${currentIndex.value * (CARD_WIDTH + GAP)}px)`
}))

function prev() {
  if (currentIndex.value > 0) currentIndex.value--
}
function next() {
  if (currentIndex.value < maxIndex.value) currentIndex.value++
}
function startTimer() {
  timer = setInterval(() => {
    if (currentIndex.value >= maxIndex.value) {
      currentIndex.value = 0
    } else {
      currentIndex.value++
    }
  }, 4000)
}
function stopTimer() {
  if (timer) { clearInterval(timer); timer = null }
}

// visibleCount derived from window.innerWidth — recomputed on resize
const visibleCount = ref(getVisibleCount())
function getVisibleCount() {
  if (typeof window === 'undefined') return 4
  if (window.innerWidth >= 1024) return 4
  if (window.innerWidth >= 768) return 3
  return 1
}

onMounted(() => {
  visibleCount.value = getVisibleCount()
  window.addEventListener('resize', () => { visibleCount.value = getVisibleCount() })
  startTimer()
})
onUnmounted(() => {
  stopTimer()
  window.removeEventListener('resize', () => { visibleCount.value = getVisibleCount() })
})
```

**Template pattern** (RESEARCH.md Code Examples + UI-SPEC QuizCarousel section):
```vue
<template>
  <section class="py-12">
    <div class="mx-auto max-w-6xl px-6">
      <!-- Section header row -->
      <div class="mb-6 flex items-end justify-between">
        <div>
          <h2 class="text-xl font-semibold text-neutral-50">Свежие тесты</h2>
          <p class="text-sm text-neutral-400">Последние публикации · обновлено недавно</p>
        </div>
        <RouterLink to="/quizzes" class="text-sm text-orange-400 underline-offset-2 hover:text-orange-300 hover:underline">
          Смотреть все
        </RouterLink>
      </div>

      <!-- Loading skeletons -->
      <div v-if="isLoading" class="flex gap-4 overflow-hidden">
        <div v-for="n in 4" :key="n" class="h-52 w-64 shrink-0 animate-pulse rounded-2xl bg-neutral-800" />
      </div>

      <!-- Error state -->
      <p v-else-if="error" class="text-sm text-neutral-400">
        Не удалось загрузить тесты. Попробуй обновить страницу.
      </p>

      <!-- Empty state -->
      <div v-else-if="quizzes.length === 0" class="py-12 text-center">
        <p class="text-sm font-semibold text-neutral-300">Тестов пока нет</p>
        <p class="mt-2 text-sm text-neutral-500">Опубликованные тесты появятся здесь. Создай первый — это займёт минуту.</p>
        <RouterLink v-if="authStore.user" to="/editor/new">
          <Button class="mt-6">Создать тест</Button>
        </RouterLink>
        <RouterLink v-else to="/auth">
          <Button class="mt-6">Начать бесплатно</Button>
        </RouterLink>
      </div>

      <!-- Carousel -->
      <div
        v-else
        class="relative overflow-hidden"
        @mouseenter="stopTimer"
        @mouseleave="startTimer"
      >
        <!-- Track -->
        <div
          class="flex gap-4 transition-transform duration-300 ease-in-out"
          :style="trackStyle"
        >
          <QuizCard
            v-for="quiz in quizzes"
            :key="quiz.id"
            :quiz="quiz"
            class="w-64 shrink-0"
          />
        </div>

        <!-- Prev arrow -->
        <button
          type="button"
          aria-label="Предыдущий"
          :class="['absolute left-0 top-1/2 -translate-y-1/2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-50',
            currentIndex === 0 ? 'opacity-40 pointer-events-none' : '']"
          @click="prev"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>

        <!-- Next arrow -->
        <button
          type="button"
          aria-label="Следующий"
          :class="['absolute right-0 top-1/2 -translate-y-1/2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-50',
            currentIndex >= maxIndex ? 'opacity-40 pointer-events-none' : '']"
          @click="next"
        >
          <ChevronRight class="h-5 w-5" />
        </button>
      </div>
    </div>
  </section>
</template>
```

**QuizCard usage note:** Pass `class="w-64 shrink-0"` from carousel — `QuizCard.vue` has no fixed width internally (verified line 20–121). Do NOT pass `showActions` (omit entirely; defaults to falsy).

---

### `src/3-widgets/PricingTeaserSection.vue` (widget, static)

**Analog:** `src/4-features/payment/ui/PricingCards.vue` (lines 61–164) — Free/Pro card structure

**Imports pattern:**
```vue
<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Check } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
</script>
```

**Free card pattern** (from `PricingCards.vue` lines 91–129):
```vue
<div class="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
  <h3 class="text-xl font-semibold text-neutral-50">Free</h3>
  <p class="mt-3 text-2xl font-semibold text-neutral-50">0 ₽</p>
  <ul class="mb-6 mt-6 space-y-3">
    <li v-for="f in freeFeatures" :key="f" class="flex items-start gap-2 text-sm text-neutral-300">
      <Check class="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
      {{ f }}
    </li>
  </ul>
</div>
```

**Pro card pattern** (from `PricingCards.vue` lines 132–161):
```vue
<div class="flex flex-col rounded-2xl border border-violet-600/40 bg-neutral-900 p-6 ring-1 ring-violet-600/20">
  <div class="flex items-center gap-2">
    <h3 class="text-xl font-semibold text-neutral-50">Pro</h3>
    <span class="rounded-full bg-linear-to-r from-violet-600 to-indigo-600 px-2 py-0.5 text-xs text-white">PRO</span>
  </div>
  <p class="mt-3"><span class="text-2xl font-semibold text-neutral-50">490 ₽</span><span class="text-sm text-neutral-400">/мес</span></p>
  <ul class="mb-6 mt-6 space-y-3">
    <li v-for="f in proFeatures" :key="f" class="flex items-start gap-2 text-sm text-neutral-300">
      <Check class="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
      {{ f }}
    </li>
  </ul>
  <RouterLink to="/billing">
    <Button variant="outline" class="w-full mt-4">Подробнее о Pro</Button>
  </RouterLink>
</div>
```

**Section wrapper** (tinted band — mirrors HowItWorksSection):
```vue
<section class="bg-neutral-900/50 py-12">
  <div class="mx-auto max-w-6xl px-6">
    <h2 class="text-xl font-semibold text-neutral-50">Простые тарифы</h2>
    <p class="mt-2 text-sm text-neutral-400">Начни бесплатно — перейди на Pro когда нужно</p>
    <div class="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
      <!-- Free card -->
      <!-- Pro card -->
    </div>
  </div>
</section>
```

**Teaser feature lists** (compact 3 items each — from UI-SPEC PricingTeaserSection):
- Free: "3 теста", "10 вопросов на тест", "10 AI-генераций в месяц"
- Pro: "Неограниченно тестов и вопросов", "30 AI-генераций в месяц", "Индивидуальные ссылки доступа"

---

### `src/5-entities/quiz/api.ts` (entity API, CRUD) — MODIFY

**Analog:** self — `fetchMyQuizzes` (lines 8–20) provides the `question_count` aggregate flatten pattern

**Add after existing functions — do NOT modify `fetchPublishedQuizzes`:**
```typescript
export async function fetchCarouselQuizzes(limit = 12): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, title, description, cover_url, time_limit_sec, updated_at, question_count:questions(count)')
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  // Same flatten pattern as fetchMyQuizzes (lines 15-19)
  return (data ?? []).map((row) => {
    const { question_count, ...rest } = row as Record<string, unknown>
    const agg = question_count as Array<{ count: number }> | null
    return { ...rest, question_count: agg?.[0]?.count ?? 0 }
  }) as unknown as Quiz[]
}
```

**Critical:** `fetchPublishedQuizzes` (lines 22–30) stays byte-for-byte unchanged — `QuizListPage.vue` depends on it.

---

### `src/1-app/router/index.ts` (config) — MODIFY

**Analog:** self (lines 1–37)

**Change line 14 and add new route:**
```typescript
// BEFORE (line 14):
{ path: '/',                    component: () => import('@pages/QuizListPage.vue') },

// AFTER:
{ path: '/',                    component: () => import('@pages/LandingPage.vue') },
{ path: '/quizzes',             component: () => import('@pages/QuizListPage.vue') },
```

No auth guard on either route — both are public. All other routes unchanged.

---

### `src/3-widgets/AppHeader.vue` (widget) — MODIFY

**Analog:** self (lines 38–44)

**Change one `to="/"` → `to="/quizzes"` (line 40–43). Logo link on line 31 stays `to="/"`.**

```vue
<!-- BEFORE (line 39-43): -->
<RouterLink
  to="/"
  class="text-sm text-neutral-300 hover:text-neutral-50"
>
  Все тесты
</RouterLink>

<!-- AFTER: -->
<RouterLink
  to="/quizzes"
  class="text-sm text-neutral-300 hover:text-neutral-50"
>
  Все тесты
</RouterLink>
```

Logo `RouterLink to="/"` on line 31–34 is intentionally unchanged — it correctly points to the landing.

---

### `src/3-widgets/AppFooter.vue` (widget) — MODIFY

**Analog:** self (lines 18–23)

**Change one `to="/"` → `to="/quizzes"` (line 19):**

```vue
<!-- BEFORE (line 19-22): -->
<RouterLink
  to="/"
  class="transition-colors hover:text-neutral-300"
>

<!-- AFTER: -->
<RouterLink
  to="/quizzes"
  class="transition-colors hover:text-neutral-300"
>
```

---

### `src/2-pages/QuizResultPage.vue` (page) — MODIFY

**Analog:** self — two `to="/"` occurrences at lines 49 and 85

**Both have the semantic meaning "go to quiz list / service home". Per RESEARCH.md Pitfall 1, the logo `to="/"` in AppHeader stays, but these result-page links mean "catalog" not "landing".**

**Line 49** (invalid/not-found state):
```vue
<!-- BEFORE: -->
<RouterLink to="/" class="mt-4 inline-block text-sm text-orange-500 hover:underline">
  Перейти на Quiz Flow
</RouterLink>

<!-- AFTER: stays as to="/" — this is a general "go home" link, landing page is correct -->
```

**Line 85** (result card, D-12 home link):
```vue
<!-- BEFORE: -->
<RouterLink to="/" class="mt-6 inline-block text-sm text-orange-500 hover:underline">
  Перейти на Quiz Flow
</RouterLink>

<!-- AFTER: stays as to="/" — "Перейти на Quiz Flow" IS the landing page -->
```

**Decision:** Both `to="/"` links in `QuizResultPage.vue` are "Перейти на Quiz Flow" — the landing page IS the correct destination. No change needed. RESEARCH.md Pitfall 1 mentions these but the copy confirms they mean the service home, not the quiz catalog. Verify this during planning.

---

## Shared Patterns

### Auth-State Branching
**Source:** `src/3-widgets/AppHeader.vue` lines 62–97
**Apply to:** `HeroSection.vue`, `QuizCarousel.vue` (empty state CTA)
```vue
<template v-if="authStore.user">
  <!-- authenticated branch -->
</template>
<template v-else>
  <!-- unauthenticated branch -->
</template>
```
Always inject via `useAuthStore()` from `@features/auth/model/useAuthStore`.

### Gradient CTA Button
**Source:** `src/4-features/payment/ui/PricingCards.vue` line 156
**Apply to:** `HeroSection.vue` (unauthenticated primary CTA), `PricingTeaserSection.vue` (Pro card highlight)
```vue
class="h-10 cursor-pointer rounded-lg bg-linear-to-r from-violet-600 to-indigo-600 px-8 text-sm font-medium text-white transition-opacity hover:opacity-90"
```

### Section Container
**Source:** `src/3-widgets/AppHeader.vue` line 30, `src/2-pages/QuizListPage.vue` line 26
**Apply to:** All new widget sections
```vue
<div class="mx-auto max-w-6xl px-6">
```

### Section Heading
**Source:** `src/2-pages/QuizListPage.vue` line 27
**Apply to:** All new section widgets (HowItWorksSection, QuizCarousel, PricingTeaserSection)
```vue
<h2 class="text-xl font-semibold text-neutral-50">...</h2>
```

### Error Handling (fetch)
**Source:** `src/2-pages/QuizListPage.vue` lines 12–20
**Apply to:** `QuizCarousel.vue`
```typescript
try {
  quizzes.value = await fetchCarouselQuizzes(12)
} catch {
  error.value = true
} finally {
  isLoading.value = false
}
```

### Skeleton Loading
**Source:** RESEARCH.md Code Examples (Tailwind v4 built-in)
**Apply to:** `QuizCarousel.vue` loading state
```vue
<div class="h-52 w-64 shrink-0 animate-pulse rounded-2xl bg-neutral-800" />
```

### Card Style
**Source:** `src/5-entities/quiz/ui/QuizCard.vue` line 22, `src/4-features/payment/ui/PricingCards.vue` line 91
**Apply to:** `HowItWorksSection.vue` step cards, `PricingTeaserSection.vue` plan cards
```vue
class="rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
```

---

## No Analog Found

All files have analogs. No entries.

---

## Metadata

**Analog search scope:** `src/2-pages/`, `src/3-widgets/`, `src/4-features/payment/ui/`, `src/5-entities/quiz/`, `src/1-app/router/`
**Files read:** 8
**Pattern extraction date:** 2026-05-18
