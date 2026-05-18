# Phase 6: Landing Page — Service Overview, Public Quiz Carousel & Recently Updated Quizzes — Research

**Researched:** 2026-05-18
**Domain:** Vue 3 / Tailwind v4 marketing landing page, CSS scroll-snap carousel, FSD layer composition
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Landing page becomes `/`. `QuizListPage` moves to `/quizzes`. "Смотреть все" link on landing routes there.
- **D-02:** Logged-in users see the same landing page — no redirect. CTA and header adapt to auth state (reuse `useAuthStore().user`).
- **D-03:** Primary CTA for unauthenticated visitor → `/auth` ("Начать бесплатно"). Secondary link to `/quizzes` acceptable.
- **D-04:** Section order: Hero → "Как это работает" → Quiz Carousel → Pricing Teaser.
- **D-05:** Russian copy drafted by Claude during execution (grounded in PROJECT.md / SPEC.md). User reviews after. Treat as first draft.
- **D-06:** No product screenshots or mockup imagery. Visual interest from typography, gradient accents, live quiz cards.
- **D-07:** Carousel: all `is_published = true`, sorted `updated_at DESC`, capped 10–12 items. "Смотреть все" → `/quizzes`.
- **D-08:** Carousel and "recently updated" merged into ONE block — no separate recently-updated grid.
- **D-09:** Carousel auto-scrolls, manual prev/next, hover-pause. No heavy library dependency if CSS/JS suffices.

### Claude's Discretion
- Exact Russian copy for hero, "Как это работает", pricing teaser, empty states.
- Carousel implementation approach: pure CSS scroll-snap vs. small library; auto-advance interval; arrow vs. dot navigation.
- Exact catalog route name (`/quizzes` is the working choice; `/catalog` acceptable).
- Empty-state handling when no published quizzes.
- Whether to reuse `fetchPublishedQuizzes` with sort/limit or add a dedicated fetcher.
- Pricing-teaser layout (compact two-column summary vs. simple feature highlights).

### Deferred Ideas (OUT OF SCOPE)
- Separate "recently updated" grid (merged into carousel, D-08).
- Quiz search / categories / filtering on the catalog.
- Product screenshots / illustrated mockups (D-06).
- "Most popular" sorting by attempt count.
- User-specific "continue working" surface for logged-in users.
- SEO / meta-tags / OG tags for the landing.
</user_constraints>

---

## Summary

Phase 6 is a **pure-frontend phase** — no DB migrations, no Edge Functions. It introduces a public marketing landing page at `/`, moves the existing quiz catalog to `/quizzes`, and adds an auto-scrolling carousel of published quizzes as the product's "live demo" visual.

The existing codebase provides everything needed: `fetchPublishedQuizzes` (needs a minor extension to sort by `updated_at` and add a LIMIT), `QuizCard.vue` (drops in unchanged as a carousel item), `AppHeader.vue` / `AppFooter.vue` (shared chrome, both need link updates from `/` to `/quizzes`). The carousel will be implemented with CSS scroll-snap for baseline behavior and a minimal JS auto-advance timer — no third-party carousel library.

The main planning concerns are: (1) the route rebinding — `/` gets a new `LandingPage.vue`, the existing `QuizListPage.vue` gets a second route `/quizzes`; (2) all internal `to="/"` nav links that currently mean "quiz list" must be updated to `to="/quizzes"`; (3) the carousel's translate-based slide mechanism requires careful handling of index bounds and timer cleanup on unmount.

**Primary recommendation:** Implement the carousel with a `translateX` + `transition-transform` track approach driven by a `currentIndex` ref, an `auto-advance` `setInterval` started in `onMounted` and cleared in `onUnmounted`, paused via `mouseenter` / `mouseleave`. Do NOT reach for a carousel library — the UI-SPEC is fully specified and the implementation is straightforward.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Landing page assembly | `2-pages` (LandingPage.vue) | — | Thin assembler, ~80 lines, composes widgets |
| Hero section (markup, CTA) | `3-widgets` (HeroSection.vue) | — | Large reusable UI block; composes auth state from `4-features/auth` |
| "Как это работает" steps | `3-widgets` (HowItWorksSection.vue) | — | Static content block; no business logic |
| Quiz carousel display + timer | `3-widgets` (QuizCarousel.vue) | `5-entities/quiz/api.ts` | Widget consumes entity API; auto-advance timer lives in the widget |
| Pricing teaser | `3-widgets` (PricingTeaserSection.vue) | — | Display-only summary; links to `/billing` |
| Published quiz fetching (carousel) | `5-entities/quiz/api.ts` | — | Entity API fetcher; extend existing `fetchPublishedQuizzes` |
| Auth state check (CTA switching) | `4-features/auth/model/useAuthStore` | — | Already used by AppHeader; same composable |
| Routing (`/`, `/quizzes`) | `1-app/router/index.ts` | — | Route table; `/` rebinds, `/quizzes` added |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 (script setup) | Already in project | Component authoring | Project stack |
| TypeScript | Already in project | Type safety | Project stack |
| Tailwind CSS v4 | Already in project | Styling | Project stack |
| Pinia | Already in project | Auth store (`useAuthStore`) | Project stack |
| Vue Router 4 | Already in project | Routing, `RouterLink` | Project stack |
| `lucide-vue-next` | Already in project | ChevronLeft/Right arrow icons | Already used project-wide |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CVA (`class-variance-authority`) | Already in project | Variant-based class composition | Already used in `Button.vue`; not needed for new components unless adding variants |

### No New Dependencies

This phase introduces **zero new npm packages**. All carousel behavior is implemented with native Vue 3 + Tailwind CSS v4 primitives (CSS `transition-transform`, JS `setInterval`, `ref`, `onMounted`, `onUnmounted`).

---

## Package Legitimacy Audit

No new packages are installed in this phase.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none)* | — | — | — | — | — | — |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser request to /
        │
        ▼
Vue Router → LandingPage.vue (2-pages)
        │
        ├── AppHeader.vue (3-widgets)  [sticky, h-14]
        │     └── useAuthStore()  →  nav link "Все тесты" → /quizzes
        │
        ├── HeroSection.vue (3-widgets)
        │     └── useAuthStore().user  →  CTA variant switch
        │
        ├── HowItWorksSection.vue (3-widgets)
        │     └── static 3-step copy  (no data dependency)
        │
        ├── QuizCarousel.vue (3-widgets)
        │     ├── fetchPublishedQuizzes({ orderBy: 'updated_at', limit: 12 })
        │     │       └── supabase.from('quizzes').select(…).eq('is_published',true)
        │     │                                   .order('updated_at', desc)
        │     │                                   .limit(12)
        │     ├── QuizCard.vue (5-entities)  [× 10-12, showActions=false]
        │     └── JS auto-advance timer  (setInterval 4000ms, hover-pause)
        │
        ├── PricingTeaserSection.vue (3-widgets)
        │     └── static Free/Pro summary, CTA → /billing
        │
        └── AppFooter.vue (3-widgets)
              └── "Все тесты" link → /quizzes  (updated)

Browser request to /quizzes
        │
        ▼
Vue Router → QuizListPage.vue (2-pages)  [unchanged, new route only]
```

### Recommended Project Structure

```
src/
├── 2-pages/
│   └── LandingPage.vue              # NEW — thin assembler
├── 3-widgets/
│   ├── HeroSection.vue              # NEW
│   ├── HowItWorksSection.vue        # NEW
│   ├── QuizCarousel.vue             # NEW — carousel + timer
│   ├── PricingTeaserSection.vue     # NEW
│   ├── AppHeader.vue                # MODIFY — "Все тесты" link → /quizzes
│   └── AppFooter.vue                # MODIFY — "Все тесты" link → /quizzes
├── 5-entities/quiz/
│   └── api.ts                       # MODIFY — extend fetchPublishedQuizzes
└── 1-app/router/
    └── index.ts                     # MODIFY — / → LandingPage, /quizzes → QuizListPage
```

### Pattern 1: Route Rebinding

The existing `QuizListPage.vue` stays **byte-for-byte unchanged**. Only the router table changes:

```typescript
// src/1-app/router/index.ts — BEFORE
{ path: '/', component: () => import('@pages/QuizListPage.vue') }

// AFTER
{ path: '/',         component: () => import('@pages/LandingPage.vue') },
{ path: '/quizzes',  component: () => import('@pages/QuizListPage.vue') },
```

[VERIFIED: Vue Router 4 docs — multiple routes to the same component are valid]

### Pattern 2: Carousel Fetcher Extension

`fetchPublishedQuizzes` currently orders by `created_at` DESC with no LIMIT and selects 5 columns (no `question_count` aggregate). The carousel needs `updated_at` DESC + LIMIT 12 + `question_count` for card chips.

**Recommended approach:** Add a dedicated `fetchCarouselQuizzes` function in `src/5-entities/quiz/api.ts` rather than mutating the existing fetcher, to keep `QuizListPage.vue` unaffected:

```typescript
// Source: existing api.ts pattern, extended [ASSUMED — training knowledge, pattern is standard]
export async function fetchCarouselQuizzes(limit = 12): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, title, description, cover_url, time_limit_sec, updated_at, question_count:questions(count)')
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => {
    const { question_count, ...rest } = row as Record<string, unknown>
    const agg = question_count as Array<{ count: number }> | null
    return { ...rest, question_count: agg?.[0]?.count ?? 0 }
  }) as unknown as Quiz[]
}
```

### Pattern 3: Carousel Auto-Advance (CSS translate + JS timer)

The UI-SPEC mandates a `translateX`-based slide approach (not CSS `scroll-snap` scrollLeft). The track is a `flex` container; each card is `w-64 shrink-0`. Advance is computed as `currentIndex * (cardWidth + gap)`.

```typescript
// QuizCarousel.vue — core logic [ASSUMED — training knowledge / UI-SPEC derived]
const currentIndex = ref(0)
const cardWidthPx = 256   // w-64
const gapPx = 16          // gap-4
let timer: ReturnType<typeof setInterval> | null = null

const trackStyle = computed(() => ({
  transform: `translateX(-${currentIndex.value * (cardWidthPx + gapPx)}px)`
}))

function prev() {
  if (currentIndex.value > 0) currentIndex.value--
}
function next() {
  if (currentIndex.value < props.quizzes.length - visibleCount.value) currentIndex.value++
}
function startTimer() {
  timer = setInterval(() => {
    if (currentIndex.value >= props.quizzes.length - visibleCount.value) {
      currentIndex.value = 0   // wrap around
    } else {
      currentIndex.value++
    }
  }, 4000)
}
function stopTimer() {
  if (timer) { clearInterval(timer); timer = null }
}

onMounted(startTimer)
onUnmounted(stopTimer)
```

Pause / resume on hover:
```html
<div @mouseenter="stopTimer" @mouseleave="startTimer">
```

[ASSUMED — standard Vue 3 lifecycle + JS pattern; UI-SPEC defines the visual contract]

### Pattern 4: Auth-State Adaptive CTA (HeroSection)

Same pattern as `AppHeader.vue` — inject `useAuthStore()`, branch on `.user`:

```vue
<script setup lang="ts">
import { useAuthStore } from '@features/auth/model/useAuthStore'
const authStore = useAuthStore()
</script>

<template>
  <!-- Primary CTA -->
  <RouterLink v-if="!authStore.user" to="/auth">
    <button class="bg-linear-to-r from-violet-600 to-indigo-600 text-white ...">
      Начать бесплатно
    </button>
  </RouterLink>
  <RouterLink v-else to="/my">
    <Button variant="default">Мои тесты</Button>
  </RouterLink>

  <!-- Secondary CTA (both states) -->
  <RouterLink to="/quizzes">
    <Button variant="outline">Смотреть тесты</Button>
  </RouterLink>
</template>
```

[ASSUMED — pattern directly mirrors AppHeader.vue auth-branching already in the codebase]

### Anti-Patterns to Avoid

- **Redirect logged-in users away from `/`** — D-02 explicitly forbids this. No `router.beforeEach` guard for the landing route.
- **Using `router.push('/')` as "go to quiz list"** — all such calls must use `/quizzes` after the route rebinding.
- **Putting carousel data-fetch inside `LandingPage.vue`** — it belongs in `QuizCarousel.vue` (3-widgets), keeping the page assembler thin.
- **`scrollLeft` manipulation** — UI-SPEC specifies `translateX` on the track, not `scrollLeft`. Mixing the two causes jitter.
- **Carousel timer not cleared on unmount** — always `clearInterval` in `onUnmounted` to avoid memory leaks when navigating away.
- **`showActions` prop on QuizCard** — must remain `false` (default) in the carousel; action buttons (edit, delete, stats) are owner-only.
- **`fetchPublishedQuizzes` mutation** — do not change the existing function; `QuizListPage.vue` depends on it ordering by `created_at`. Add `fetchCarouselQuizzes` instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gradient CTA button | Custom CSS class | Inline Tailwind `bg-linear-to-r from-violet-600 to-indigo-600` | Already used in `PricingCards.vue`; one-liner |
| Auth-state branching in hero | New composable | `useAuthStore().user` — already provided | Same pattern as AppHeader; zero new code |
| Card skeleton shimmer | Custom keyframe | `animate-pulse bg-neutral-800` Tailwind class | Tailwind v4 ships `animate-pulse`; no custom CSS needed |
| Carousel library (Swiper, etc.) | — | Pure CSS + JS per UI-SPEC D-09 | No new dependency; spec already resolved this |

---

## Runtime State Inventory

Not applicable — this is a greenfield frontend phase. No renames, no migrations, no runtime state affected.

---

## Common Pitfalls

### Pitfall 1: Internal Links to `/` for the Quiz List

**What goes wrong:** After route rebinding, clicking "Все тесты" in AppHeader, AppFooter, or result page still navigates to the new landing page instead of the quiz catalog.

**Why it happens:** Four places in the existing codebase use `to="/"` with the semantic meaning "go to quiz list":
- `src/3-widgets/AppHeader.vue` — logo link (should stay `/`); nav "Все тесты" (must change to `/quizzes`)
- `src/3-widgets/AppFooter.vue` — "Все тесты" (must change to `/quizzes`)
- `src/2-pages/QuizResultPage.vue` (2 occurrences) — "Все тесты" / home button (must change to `/quizzes`)

**How to avoid:** Audit every `to="/"` occurrence before or during the route rebinding task. The logo link in AppHeader is the only `to="/"` that should stay pointing to `/` (the landing).

**Warning signs:** If "Все тесты" in the header opens the hero/marketing page instead of the quiz grid, a link was missed.

### Pitfall 2: Carousel Index Out-of-Bounds

**What goes wrong:** With 10 cards and 4 visible, the maximum valid `currentIndex` is 6 (not 9). If the timer or next-button increments past 6, cards slide off-screen showing empty space.

**Why it happens:** `visibleCount` depends on viewport width (1 on mobile, 3 on tablet, 4 on desktop). `currentIndex` bounds must account for the current `visibleCount`, which is reactive.

**How to avoid:** Compute `maxIndex = Math.max(0, quizzes.length - visibleCount)`. Both the next button's disabled state and the auto-advance wrap check must use `maxIndex`. Use a `ResizeObserver` or a reactive breakpoint composable to track `visibleCount`, or simply derive it from CSS breakpoint classes.

**Warning signs:** Empty grey space after the last card; carousel never wrapping around.

### Pitfall 3: Timer Not Cleaned Up

**What goes wrong:** Navigating away from the landing page and back causes multiple timers to accumulate, each advancing the carousel index — resulting in rapid uncontrolled scrolling.

**Why it happens:** `setInterval` must be explicitly cancelled in `onUnmounted`. If `startTimer` is called without pairing with `onUnmounted(() => stopTimer())`, the interval survives the component teardown.

**How to avoid:** Always pair `onMounted(startTimer)` with `onUnmounted(stopTimer)`. Consider wrapping the timer in a `watchEffect` cleanup pattern for robustness.

### Pitfall 4: `question_count` Missing in Carousel Cards

**What goes wrong:** `QuizCard.vue` renders a `question_count` chip only when the prop is defined. If the carousel fetcher uses the same lean select as `fetchPublishedQuizzes` (which omits `question_count`), chips disappear.

**Why it happens:** `fetchPublishedQuizzes` currently selects only 5 columns with no aggregate join. The `question_count` field on the `Quiz` model is optional (`question_count?: number`).

**How to avoid:** `fetchCarouselQuizzes` must include the `question_count:questions(count)` join and flatten it (same pattern as `fetchMyQuizzes`).

### Pitfall 5: Carousel visibleCount Mismatch Between CSS and JS

**What goes wrong:** CSS shows 4 cards (desktop), but JS `visibleCount = 3` — so prev/next buttons disable one step too early.

**Why it happens:** Hardcoding `visibleCount` as a constant rather than deriving it reactively.

**How to avoid:** Use `window.innerWidth` (or a `ResizeObserver`) to derive the step: `>= 1024 → 4`, `>= 768 → 3`, else `1`. This must be reactive — recomputed on resize. Alternatively, always advance one card at a time and let CSS handle the clip (simpler, avoids the mismatch entirely).

---

## Code Examples

### Carousel track template skeleton

```vue
<!-- QuizCarousel.vue — template excerpt -->
<div class="relative overflow-hidden" @mouseenter="stopTimer" @mouseleave="startTimer">
  <!-- Track -->
  <div
    class="flex gap-4 transition-transform duration-300 ease-in-out"
    :style="{ transform: `translateX(-${currentIndex * (256 + 16)}px)` }"
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
    :class="['absolute left-0 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-neutral-800 border border-neutral-700 ...', currentIndex === 0 ? 'opacity-40 pointer-events-none' : '']"
    @click="prev"
  >
    <ChevronLeft class="h-5 w-5" />
  </button>

  <!-- Next arrow -->
  <button
    type="button"
    aria-label="Следующий"
    :class="['absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 ...', currentIndex >= maxIndex ? 'opacity-40 pointer-events-none' : '']"
    @click="next"
  >
    <ChevronRight class="h-5 w-5" />
  </button>
</div>
```

### Skeleton loading cards

```html
<!-- 4 skeleton cards while loading -->
<div v-if="isLoading" class="flex gap-4 overflow-hidden">
  <div
    v-for="n in 4"
    :key="n"
    class="h-52 w-64 shrink-0 animate-pulse rounded-2xl bg-neutral-800"
  />
</div>
```

### Empty state

```html
<div v-else-if="quizzes.length === 0" class="py-12 text-center">
  <p class="text-sm font-semibold text-neutral-300">Тестов пока нет</p>
  <p class="mt-2 text-sm text-neutral-500">
    Опубликованные тесты появятся здесь. Создай первый — это займёт минуту.
  </p>
  <RouterLink v-if="authStore.user" to="/editor/new">
    <Button class="mt-6">Создать тест</Button>
  </RouterLink>
  <RouterLink v-else to="/auth">
    <Button class="mt-6">Начать бесплатно</Button>
  </RouterLink>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS `scroll-snap` + `scrollLeft` | `translateX` track with JS index | UI-SPEC mandate | Gives full control over prev/next, disabled states, and auto-advance without fighting browser scroll snapping |
| Single `/` route for quiz list | `/` = landing, `/quizzes` = catalog | Phase 6 | Standard SaaS landing page pattern; quiz list moves to dedicated catalog route |

---

## Existing Codebase Audit (Key Findings)

### `fetchPublishedQuizzes` (src/5-entities/quiz/api.ts)

- Selects: `id, title, description, cover_url, time_limit_sec` — **no `question_count`**, **no `updated_at`**
- Orders by: `created_at DESC` — **must be `updated_at DESC` for carousel**
- No LIMIT — **must add `.limit(12)` for carousel**
- **Action:** Add `fetchCarouselQuizzes` function, do NOT modify the existing one.

### `QuizCard.vue` (src/5-entities/quiz/ui/QuizCard.vue)

- Props: `quiz: Quiz`, `showActions?: boolean` (default: undefined/falsy)
- Card dimensions: `rounded-2xl border border-neutral-800 bg-neutral-900`, cover image `h-32`
- `question_count` chip: only renders when `quiz.question_count != null` — safe to omit
- Width: not fixed by default; caller must supply `w-64 shrink-0` in the carousel context
- `showActions` must be omitted/false in carousel (no edit/delete/stats buttons for public view)

### `AppHeader.vue` (src/3-widgets/AppHeader.vue)

- Logo: `<RouterLink to="/">` — stays `/` (correct, goes to landing)
- Nav "Все тесты": `<RouterLink to="/">` — **must change to `/quizzes`**
- Auth pattern: `authStore.user` conditional — same pattern reused in HeroSection

### `AppFooter.vue` (src/3-widgets/AppFooter.vue)

- "Все тесты" nav link: `to="/"` — **must change to `/quizzes`**

### `QuizResultPage.vue` (src/2-pages/QuizResultPage.vue)

- Two `to="/"` occurrences semantically meaning "go home / see all quizzes" — **both must change to `/quizzes`**

### `src/1-app/router/index.ts`

- Current: `{ path: '/', component: () => import('@pages/QuizListPage.vue') }`
- Change: add `{ path: '/quizzes', component: () => import('@pages/QuizListPage.vue') }`, rebind `/` to `LandingPage.vue`
- `/billing` currently has `meta: { requiresAuth: true }` — the pricing teaser links there; unauthenticated users clicking "Подробнее о Pro" will be redirected to `/auth`. This is acceptable per existing billing page behavior (no change needed).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fetchCarouselQuizzes` with `.order('updated_at', …).limit(12)` is a valid Supabase JS v2 query chain | Standard Stack / Code Examples | Low — Supabase JS chaining is stable and `updated_at` column confirmed in schema |
| A2 | `translateX` carousel with JS index is the correct implementation (not CSS `scroll-snap` scrollLeft) | Architecture Patterns / Pattern 3 | None — UI-SPEC explicitly mandates this in QuizCarousel section |
| A3 | `QuizCard.vue` width is not fixed internally; `w-64 shrink-0` applied by the carousel wrapper | Existing Codebase Audit | Low — verified by reading QuizCard.vue; no fixed width class inside the component |
| A4 | `visibleCount` derivation via window.innerWidth breakpoints (4/3/1) matches UI-SPEC visible card counts | Common Pitfalls | Low — UI-SPEC states "4 on desktop (≥1024px), 3 on tablet (≥768px), 1.5 on mobile" |

---

## Open Questions (RESOLVED)

1. **Carousel visible count: advance by 1 or by N?**
   - What we know: UI-SPEC says 4/3/1.5 visible cards, prev/next arrows.
   - What's unclear: Does clicking Next advance 1 card or a full "page" of visible cards?
   - Recommendation: Advance 1 card at a time. Simpler index math, avoids `visibleCount` reactivity complexity, and feels more fluid for a marketing carousel.
   - **RESOLVED:** Advance by 1 card at a time (simpler index math, per researcher recommendation).

2. **`/billing` auth guard with pricing teaser CTA**
   - What we know: `/billing` has `meta: { requiresAuth: true }`. Unauthenticated users clicking "Подробнее о Pro" in the teaser will be silently redirected to `/auth?returnUrl=/billing`.
   - What's unclear: Is this acceptable UX or should the teaser CTA link to a public pricing page?
   - Recommendation: Leave the auth guard as-is. The redirect is standard SaaS behavior and Phase 5 did not change the guard. The teaser is a secondary CTA; unauthenticated users will land on `/auth` which is the desired primary action anyway.
   - **RESOLVED:** Accept the existing behavior — an unauthenticated click on "Подробнее о Pro" redirects to `/auth` via the existing auth guard. No new returnUrl handling is added in this phase.

3. **`question_count = 0` chip visibility in carousel cards**
   - What we know: `fetchPublishedQuizzes` doesn't fetch `question_count`; `fetchCarouselQuizzes` should.
   - What's unclear: If a quiz has 0 questions (just created), the chip renders "0 вопросов" — is this desirable for the public landing?
   - Recommendation: Use `v-if="quiz.question_count != null && quiz.question_count > 0"` to hide the chip for zero-question quizzes (matches the `!= null` guard already in `QuizCard.vue`).
   - **RESOLVED:** Hide the question-count chip when count is 0, consistent with the existing `!= null` guard in `QuizCard.vue`.

---

## Environment Availability

Step 2.6: SKIPPED — this is a pure frontend phase. No new external tools, services, or CLIs are required beyond the already-installed project toolchain (Node.js, npm, Vite, Supabase JS client already configured).

---

## Validation Architecture

`nyquist_validation: false` in `.planning/config.json` — this section is skipped per protocol.

---

## Security Domain

This phase introduces no authentication flows, no data mutations, no sensitive data display, and no new API endpoints. The carousel read queries `is_published = true` rows via the existing public anon RLS policy (established in Phase 1 migration 007). No ASVS controls are newly introduced.

**Existing protections confirmed as sufficient:**
- `is_correct` columns: never selected by `fetchCarouselQuizzes` — select list is explicit
- `answer_options` table: not touched by this phase
- `quiz_access` / `password_hash`: not touched by this phase

---

## Sources

### Primary (HIGH confidence)
- `src/5-entities/quiz/api.ts` — verified `fetchPublishedQuizzes` signature, select list, ordering
- `src/5-entities/quiz/ui/QuizCard.vue` — verified props, layout, no fixed width
- `src/3-widgets/AppHeader.vue` — verified auth pattern, `to="/"` occurrences
- `src/3-widgets/AppFooter.vue` — verified `to="/"` occurrence
- `src/1-app/router/index.ts` — verified route table, auth guard configuration
- `src/2-pages/QuizResultPage.vue` — verified `to="/"` occurrences (2)
- `src/6-shared/ui/Button.vue` — verified variant/size API
- `src/5-entities/quiz/model.ts` — verified `Quiz` type, `question_count` optionality
- `.planning/phases/06-.../06-CONTEXT.md` — locked decisions D-01 through D-09
- `.planning/phases/06-.../06-UI-SPEC.md` — component inventory, layout contracts, copywriting contract, states matrix

### Secondary (MEDIUM confidence)
- `SPEC.md` — design language, routes table, Supabase schema reference
- `.planning/STATE.md` — confirmed all prior phases complete; no open blockers

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all tools already in project
- Architecture: HIGH — all component locations, props, and API signatures verified from source
- Pitfalls: HIGH — all link occurrences verified by grep; carousel pitfalls are derived from the confirmed implementation approach
- Carousel implementation: MEDIUM — `translateX` + `setInterval` pattern is training knowledge (standard Vue 3 pattern), but UI-SPEC confirms it as the required approach

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable stack — no fast-moving dependencies)
