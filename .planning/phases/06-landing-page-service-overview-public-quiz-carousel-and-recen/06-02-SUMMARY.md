---
phase: 06
plan: "02"
subsystem: landing-page, routing
tags: [widget, page, router, carousel, hero, pricing]
dependency_graph:
  requires: [fetchCarouselQuizzes, /quizzes nav rebinding]
  provides: [LandingPage, HeroSection, HowItWorksSection, QuizCarousel, PricingTeaserSection, route /]
  affects: [src/1-app/router/index.ts, src/2-pages/LandingPage.vue, src/3-widgets/*]
tech_stack:
  added: []
  patterns: [auth-state-branching, translateX-carousel, named-resize-handler, tinted-band-section, fsd-widget-composition]
key_files:
  created:
    - src/3-widgets/HeroSection.vue
    - src/3-widgets/HowItWorksSection.vue
    - src/3-widgets/QuizCarousel.vue
    - src/3-widgets/PricingTeaserSection.vue
    - src/2-pages/LandingPage.vue
  modified:
    - src/1-app/router/index.ts
decisions:
  - "LandingPage has no <main> max-w wrapper — each section widget owns its width so tinted bands are full-bleed"
  - "QuizCarousel uses named handleResize function (not arrow) so removeEventListener detaches the exact handler (RESEARCH Pitfall 3)"
  - "startTimer guards against double-start: if timer already set, returns early"
  - "/ route rebound to LandingPage; /quizzes added for QuizListPage; both public (no requiresAuth)"
metrics:
  duration: "15m"
  completed: "2026-05-18"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 6
---

# Phase 06 Plan 02: Landing Page Widgets & Assembly Summary

**One-liner:** Landing page assembled from four section widgets (hero, how-it-works, quiz carousel, pricing teaser) with auth-adaptive CTAs, auto-advancing carousel, and router rebinding of / to LandingPage and /quizzes to the existing catalog.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Build HeroSection, HowItWorksSection, PricingTeaserSection | 4638e1d | src/3-widgets/HeroSection.vue, HowItWorksSection.vue, PricingTeaserSection.vue |
| 2 | Build QuizCarousel widget | 2d7853e | src/3-widgets/QuizCarousel.vue |
| 3 | Assemble LandingPage and rebind routes | 0e22f15 | src/2-pages/LandingPage.vue, src/1-app/router/index.ts |

## Verification

- `npx vue-tsc --noEmit` — passed after each task
- `npx steiger src --reporter pretty` — no FSD layer violations
- `npm run build` — succeeded (LandingPage-DpjKA4Om.js, 9.20 kB)
- Checkpoint auto-approved (AUTO_MODE active)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Named resize handler instead of anonymous arrow function**
- **Found during:** Task 2
- **Issue:** PATTERNS.md showed `window.removeEventListener('resize', () => { ... })` with an arrow function — this would silently fail to detach the listener (new arrow !== old arrow)
- **Fix:** Extracted `function handleResize()` as a named function; both `addEventListener` and `removeEventListener` reference the same identifier
- **Files modified:** src/3-widgets/QuizCarousel.vue
- **Commit:** 2d7853e

**2. [Rule 2 - Missing guard] startTimer double-start guard**
- **Found during:** Task 2
- **Issue:** On mouseleave after mouseenter, startTimer would create a second interval without clearing the first
- **Fix:** Added early-return guard `if (timer) return` at the top of startTimer
- **Files modified:** src/3-widgets/QuizCarousel.vue
- **Commit:** 2d7853e

## Known Stubs

None. All data is wired to real Supabase calls via `fetchCarouselQuizzes`. Feature lists in PricingTeaserSection are static copy (intentional — teaser is summary only, full list lives on /billing).

## Threat Flags

None. T-06-05 (setInterval cleanup) mitigated via onUnmounted. T-06-03 (carousel data disclosure) mitigated — only is_published=true quizzes are shown via fetchCarouselQuizzes explicit select list. T-06-04 accepted — / and /quizzes are intentionally public, auth-gated routes unchanged.

## Self-Check: PASSED

- src/3-widgets/HeroSection.vue — FOUND
- src/3-widgets/HowItWorksSection.vue — FOUND
- src/3-widgets/QuizCarousel.vue — FOUND
- src/3-widgets/PricingTeaserSection.vue — FOUND
- src/2-pages/LandingPage.vue — FOUND
- src/1-app/router/index.ts — MODIFIED (/ → LandingPage, /quizzes → QuizListPage)
- Commit 4638e1d — FOUND
- Commit 2d7853e — FOUND
- Commit 0e22f15 — FOUND
