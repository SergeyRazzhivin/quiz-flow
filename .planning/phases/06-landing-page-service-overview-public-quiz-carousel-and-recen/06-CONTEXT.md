# Phase 6: Landing Page — Service Overview, Public Quiz Carousel & Recently Updated Quizzes - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 delivers a **public marketing landing page** as the new site entry point (`/`). It introduces:

1. **Service overview** — a hero section (headline + CTA), a "Как это работает" block, and a pricing teaser linking to `/billing`.
2. **Public quiz showcase** — a single auto-scrolling, manually-navigable carousel of published quizzes (sorted newest-first by `updated_at`).

The existing all-quizzes list (`QuizListPage`, "Все тесты") moves off `/` to a dedicated catalog route (`/quizzes`).

**NOT in this phase:** new quiz-discovery capabilities (search, categories, filtering), product screenshots/imagery, blog/content pages, user-specific "continue working" surfaces. The carousel and "recently updated" idea from the phase title are **deliberately merged into one block** (see D-08) — there is no separate recently-updated grid.
</domain>

<decisions>
## Implementation Decisions

### Routing & `/` Fate
- **D-01:** The landing page **becomes `/`**. The existing `QuizListPage` ("Все тесты") moves to a new dedicated route — `/quizzes` (the public catalog). A "Все тесты"/"Смотреть все" link on the landing routes there.
- **D-02:** Logged-in users see the **same landing page** at `/` — no redirect. The CTA and header **adapt to auth state**: instead of "Регистрация"/"Начать бесплатно", an authenticated user sees "Мои тесты" / "Создать тест". Header already varies by auth elsewhere; reuse that mechanism.
- **D-03:** The primary landing CTA for an unauthenticated visitor leads to **registration (`/auth`)** — "Начать бесплатно". A secondary link to the public catalog (`/quizzes`) is acceptable but the hero's primary action is sign-up.

### Service Overview (Hero & Marketing)
- **D-04:** Landing sections, in order: **Hero** (headline + subhead + primary CTA) → **"Как это работает"** (3 steps) → public quiz carousel → **pricing teaser** (Free vs Pro summary with a CTA linking to `/billing`).
- **D-05:** Russian marketing copy (headlines, step descriptions, teaser text) is **drafted by Claude** during execution, grounded in `PROJECT.md` / `SPEC.md` core value ("загружаешь текст — AI генерирует готовый тест за секунды"). The user will review and edit the copy afterward — treat it as a first draft, not final.
- **D-06:** **No product screenshots or mockup imagery.** The visual interest comes from typography, the existing gradient accents (`from-violet-600 to-indigo-600`), and the live quiz cards in the carousel acting as the "real" product visual.

### Public Quiz Carousel (merged showcase block)
- **D-07:** Carousel contents — **all published quizzes** (`is_published = true`), sorted **`updated_at` DESC** (freshest first), capped at **10–12** items. A "Смотреть все" affordance links to `/quizzes`.
- **D-08:** **Carousel and "recently updated" are merged into ONE block.** On a young service, "published by `created_at`" and "published by `updated_at`" produce near-identical card sets; two blocks would duplicate content. The single block IS the carousel, ordered by `updated_at` DESC. There is no separate recently-updated grid — this consolidates the two components named in the phase title.
- **D-09:** Carousel behavior — **auto-scrolls** with **manual controls** (prev/next arrows and/or swipe/drag). Auto-advance pauses on hover. No new heavy carousel dependency required if a lightweight CSS/JS approach suffices — library choice is Claude's discretion.

### Claude's Discretion
- Exact Russian copy for hero, "Как это работает" steps, pricing teaser, and any empty states.
- Carousel implementation approach — pure CSS scroll-snap vs. a small library; auto-advance interval; arrow vs. dot navigation.
- Exact catalog route name (`/quizzes` is the working choice; `/catalog` acceptable if it reads better).
- Empty-state handling when there are no published quizzes (the carousel block should degrade gracefully — likely hidden or shown with a friendly message).
- Whether the data fetch reuses `fetchPublishedQuizzes` with an added sort/limit or gets a dedicated fetcher.
- Pricing-teaser layout (compact two-column summary vs. simple feature highlights).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs & requirements
- `.planning/ROADMAP.md` — Phase 6 entry (goal currently "[To be planned]" — this CONTEXT.md defines the scope).
- `SPEC.md` (project root) — routes table, design language ("Дизайн" section: promto.ai-inspired clean cards, gradient CTA `from-violet-600 to-indigo-600`, Inter font), core value statement.
- `.planning/PROJECT.md` — core value / positioning, source for marketing copy (D-05).
- `CLAUDE.md` — FSD layer rules; landing page is a thin `2-pages` assembler (~80 lines max).

### Existing code to reuse / modify
- `src/2-pages/QuizListPage.vue` — current `/` page; this file's route changes to `/quizzes` (D-01).
- `src/1-app/router/index.ts` — route table; `/` rebinds to the new landing page, `/quizzes` added.
- `src/5-entities/quiz/api` — `fetchPublishedQuizzes`; carousel fetch reuses or extends it (sort by `updated_at`, limit 10–12).
- `src/5-entities/quiz/ui/QuizCard.vue` — card component reused inside the carousel.
- `src/3-widgets/AppHeader.vue`, `src/3-widgets/AppFooter.vue` — shared chrome; header CTA adapts to auth (D-02).

### Prior phase context
- `.planning/phases/05-billing/05-CONTEXT.md` — `/billing` pricing page (D-15/D-16: two-card Free/Pro layout, 490 ₽/мес + 4 490 ₽/год). The landing pricing teaser links here and should stay visually consistent.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QuizCard.vue` (`src/5-entities/quiz/ui/`) — published-quiz card; drop into the carousel directly.
- `fetchPublishedQuizzes` (`src/5-entities/quiz/api`) — published-quiz fetcher; extend with `updated_at` sort + limit.
- `AppHeader.vue` / `AppFooter.vue` — shared page chrome; landing reuses both.
- Design tokens — dark theme, gradient CTA `from-violet-600 to-indigo-600`, Inter font, promto.ai-inspired clean cards (`SPEC.md` "Дизайн").

### Established Patterns
- FSD discipline (steiger-enforced): landing page is a thin `2-pages` assembler; carousel/hero blocks belong in `3-widgets`; no domain logic in pages.
- `2-pages` files stay ~80 lines (see `QuizListPage.vue` — 58 lines).
- Header already conditionally renders by auth state — reuse for the adaptive CTA (D-02).

### Integration Points
- `src/1-app/router/index.ts` — `/` → new `LandingPage.vue`; `/quizzes` → existing `QuizListPage.vue` (both public, no auth guard).
- New page `src/2-pages/LandingPage.vue`.
- New widget(s) in `src/3-widgets/` — hero, "Как это работает", quiz carousel, pricing teaser (or composed into one `LandingWidget`).
- Any internal links pointing at `/` for the all-quizzes list must be updated to `/quizzes`.
- Pricing teaser links to `/billing` (Phase 5).

</code_context>

<specifics>
## Specific Ideas

- Single merged showcase block: an auto-scrolling carousel of QuizCards, `updated_at` DESC, 10–12 items, with prev/next controls and hover-pause.
- Hero with gradient-accented primary CTA; no screenshots — live quiz cards are the product visual.
- Pricing teaser kept consistent with the Phase 5 `/billing` two-card Free/Pro design.
- Landing follows the established dark theme + promto.ai-inspired clean-card aesthetic.

</specifics>

<deferred>
## Deferred Ideas

- **Separate "recently updated" grid** — merged into the single carousel (D-08); revisit only if the catalog grows enough that `created_at` vs `updated_at` orderings meaningfully diverge.
- **Quiz search / categories / filtering on the catalog** — new discovery capability; its own future phase.
- **Product screenshots / illustrated mockups** — would need asset production; out of scope (D-06).
- **"Most popular" sorting (by attempt count)** — needs aggregation/RPC; not in this phase.
- **User-specific "continue working" surface for logged-in users** — out of scope; logged-in users see the same landing (D-02).
- **SEO / meta-tags / OG tags for the landing** — not discussed; can be a small follow-up if needed.

None of the above blocks this phase.

</deferred>

---

*Phase: 6-landing-page-service-overview-public-quiz-carousel-and-recen*
*Context gathered: 2026-05-18*
