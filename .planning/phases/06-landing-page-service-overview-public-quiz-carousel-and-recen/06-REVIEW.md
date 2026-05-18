---
phase: 06-landing-page
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/5-entities/quiz/api.ts
  - src/3-widgets/AppHeader.vue
  - src/3-widgets/AppFooter.vue
  - src/3-widgets/HeroSection.vue
  - src/3-widgets/HowItWorksSection.vue
  - src/3-widgets/QuizCarousel.vue
  - src/3-widgets/PricingTeaserSection.vue
  - src/2-pages/LandingPage.vue
  - src/1-app/router/index.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues-found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-18
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues-found

## Summary

Phase 6 is a pure-frontend landing page addition with no DB migrations. The carousel timer lifecycle is handled correctly (named handler for resize, double-start guard, onUnmounted cleanup). FSD layer imports are all valid. The primary critical defect is an incomplete route rebinding in `QuizResultPage.vue` — a file outside the reviewed set that the research document explicitly identified as requiring two link changes, and those changes were not made. Four warnings cover a reactivity flaw in the carousel that can produce stuck arrows, a missing `cursor-pointer` on the Free card (project-wide rule), timer activity during the loading/error/empty states, and the mobile "1.5 peek" spec not matching the implemented "1 full card" behaviour. Two info items cover a duplicate label badge in PricingTeaserSection and a silent `question_count = 0` chip edge case.

---

## Critical Issues

### CR-01: QuizResultPage `to="/"` links not rebound to `/quizzes` — navigation broken for quiz takers

**File:** `src/2-pages/QuizResultPage.vue:49` and `:86`

**Issue:** The research document (RESEARCH.md Pitfall 1) and the existing codebase audit both explicitly identify two `to="/"` links in `QuizResultPage.vue` that carry the semantic meaning "go to quiz list / home" and that **must** be updated to `to="/quizzes"` after the route rebinding. Both links remain unchanged — they both read `to="/"`. After Phase 6, `/` renders `LandingPage.vue` (the marketing hero), not the quiz catalog. A guest taker who clicks "Перейти на Quiz Flow" after finishing a quiz is silently deposited on the landing page instead of the quiz catalog. This is an incorrect navigation outcome that affects every guest quiz result flow.

Note: `QuizResultPage.vue` was not listed in `files_to_review`, but because it is directly broken by a change that was made (route rebinding in `router/index.ts`) it is a blocker that must be documented here.

**Fix:**
```vue
<!-- line 49 — invalid session state -->
<RouterLink
  to="/quizzes"
  class="mt-4 inline-block text-sm text-orange-500 hover:underline"
>
  Перейти на Quiz Flow
</RouterLink>

<!-- line 86 — normal result card -->
<RouterLink
  to="/quizzes"
  class="mt-6 inline-block text-sm text-orange-500 hover:underline"
>
  Перейти на Quiz Flow
</RouterLink>
```

---

## Warnings

### WR-01: `currentIndex` compared directly to `ref` value inside `:class` bindings — reactivity works but the disabled-state condition for the Next button is subtly wrong when quizzes count equals visibleCount

**File:** `src/3-widgets/QuizCarousel.vue:183` and `:196`

**Issue:** The Prev button's disabled class uses `:class="currentIndex === 0"` but `currentIndex` is a `ref<number>` — in Vue 3 template expressions refs are auto-unwrapped, so this correctly reads `.value`. However the Next button uses `currentIndex >= maxIndex`. When `quizzes.value.length === visibleCount.value` (e.g. exactly 4 quizzes on desktop), `maxIndex` computes to `Math.max(0, 4 - 4) = 0`. `currentIndex` starts at `0`, so `0 >= 0` is immediately `true` — the Next button renders permanently disabled even though auto-advance is still running and will wrap `currentIndex` back to 0 via the timer, which never actually advances anywhere. The carousel will cycle with a permanently-disabled Next arrow and a blinking Prev arrow, confusing the user. The real guard should be `quizzes.value.length <= visibleCount.value` (disable both arrows entirely) before rendering the carousel track at all.

**Fix:** Add a computed guard and conditionally render the navigation controls:
```typescript
const hasOverflow = computed(() => quizzes.value.length > visibleCount.value)
```
Then in the template, render Prev/Next buttons only when `hasOverflow`, and also stop the timer when `!hasOverflow` (no scrolling needed). Alternatively, clamp the timer wrap logic to skip the auto-advance when `maxIndex === 0`.

---

### WR-02: Auto-advance timer started unconditionally in `onMounted` regardless of fetch outcome — timer runs during loading, error, and empty states

**File:** `src/3-widgets/QuizCarousel.vue:68-79`

**Issue:** In `onMounted`, `startTimer()` is called at the end of the block regardless of whether the fetch succeeded or returned data. During the loading phase the timer starts immediately and increments `currentIndex` on a hidden skeleton. If the fetch errors or returns 0 quizzes, the timer continues firing indefinitely against `maxIndex = 0`, causing `currentIndex` to repeatedly reset to `0` — a no-op but wasteful. The timer should only start after quizzes are confirmed to have loaded with at least one card.

**Fix:**
```typescript
onMounted(async () => {
  visibleCount.value = getVisibleCount()
  window.addEventListener('resize', handleResize)
  try {
    quizzes.value = await fetchCarouselQuizzes(12)
    if (quizzes.value.length > 0) startTimer()   // only start when there is content
  } catch {
    error.value = true
  } finally {
    isLoading.value = false
  }
})
```

---

### WR-03: Missing `cursor-pointer` on Free plan card — violates project-wide cursor-pointer rule for clickable controls

**File:** `src/3-widgets/PricingTeaserSection.vue:21`

**Issue:** The project's CLAUDE.md memory (`feedback-cursor-pointer.md`) states: "every clickable control must have `cursor-pointer`." The Pro card's CTA `<Button>` has `class="mt-4 w-full cursor-pointer"` (line 64) which is correct. The Free card `<div>` is not clickable itself, so that is fine. However the Free card has no interactive element at all — a user on the free tier reading this teaser has no CTA. The UI-SPEC for PricingTeaserSection does not list a CTA for the Free card, but a "Начать бесплатно → /auth" button for unauthenticated users (or nothing for authenticated free users) would be consistent with the hero section pattern and is a UX gap. This is flagged as a Warning rather than Critical because it is a missing feature/link rather than a broken one.

**Fix:** Add an auth-conditional CTA to the Free card:
```vue
<RouterLink v-if="!authStore.user" to="/auth">
  <Button variant="ghost" class="mt-4 w-full cursor-pointer">
    Начать бесплатно
  </Button>
</RouterLink>
```

---

### WR-04: Mobile carousel visible count is `1` full card but the UI-SPEC mandates `1.5` (peek of next card) — users cannot discover carousel is scrollable

**File:** `src/3-widgets/QuizCarousel.vue:26`

**Issue:** `getVisibleCount()` returns `1` for `window.innerWidth < 768`. The UI-SPEC (QuizCarousel section) specifies "1.5 on mobile (peek)". The peek effect is deliberate UX — it signals to mobile users that more cards exist and can be scrolled. With `visibleCount = 1` and a fully clipped `overflow-hidden` container, there is no visual affordance that the carousel has more content. Additionally `maxIndex = quizzes.length - 1` on mobile, so the user would need to tap Next 11 times to reach the end — the peek approach would naturally hint at this. The translate math for a 1.5 peek requires the container to be ~`384px` wide (1.5 × 256) which works with `max-w-6xl` containers on most phones.

**Fix:** Either return a fractional visible count and adjust the overflow clipping, or use the simpler approach of leaving `overflow-hidden` on the viewport but making the last visible card partially clipped by reducing the clip region:
```typescript
// Simplest approach: keep visibleCount=1 but render the container without full clip
// on mobile so the 2nd card peeks by ~half a card-width.
// Or, per UI-SPEC, expose a containerWidth ref and clip to 1.5 * CARD_WIDTH + GAP.
```
This requires design work to implement correctly, but the current implementation silently deviates from the spec.

---

## Info

### IN-01: PricingTeaserSection Pro card has a redundant badge — plan name "Pro" appears twice

**File:** `src/3-widgets/PricingTeaserSection.vue:43-47`

**Issue:** The Pro card renders `<h3>Pro</h3>` (line 43) and immediately next to it a `<span>PRO</span>` gradient badge (lines 45-47). The user sees "Pro PRO" — a duplicate label. The badge is presumably meant to be an "upgrade nudge" chip like "Популярный" or "Рекомендуем", not a repeat of the plan name.

**Fix:** Change the badge text to something meaningful:
```vue
<span class="rounded-full bg-linear-to-r from-violet-600 to-indigo-600 px-2 py-0.5 text-xs text-white">
  Популярный
</span>
```

---

### IN-02: `question_count = 0` renders a "0 вопросов" chip in carousel cards — publicly visible empty quizzes

**File:** `src/5-entities/quiz/api.ts:43` / `src/5-entities/quiz/ui/QuizCard.vue:69`

**Issue:** The RESEARCH.md Open Question #3 resolved that `question_count = 0` chips should be hidden (`v-if="quiz.question_count != null && quiz.question_count > 0"`). The current `QuizCard.vue` check is only `v-if="quiz.question_count != null"` (line 69). A published quiz with 0 questions (possible if the owner published before adding questions) will show "0 вопросов" in the carousel on the public landing page. This is not a security issue but is a quality/UX defect. The fix belongs in `QuizCard.vue` (not in scope for this review phase) but the root cause is the unresolved discrepancy between the RESEARCH decision and the implementation.

**Fix (in `src/5-entities/quiz/ui/QuizCard.vue:69`):**
```vue
<span
  v-if="quiz.question_count != null && quiz.question_count > 0"
  ...
>
```

---

_Reviewed: 2026-05-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
