# Phase 6: Landing Page — Service Overview, Public Quiz Carousel & Recently Updated Quizzes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 06-landing-page-service-overview-public-quiz-carousel-and-recen
**Areas discussed:** Routing & `/` fate, Service overview (hero), Public quiz carousel, Recently updated quizzes

---

## Routing & `/` Fate

### Where the landing page lives

| Option | Description | Selected |
|--------|-------------|----------|
| Landing becomes `/`, list → `/quizzes` | `/` becomes the landing; QuizListPage moves to a dedicated route | ✓ |
| Landing at `/`, no full list at all | Landing fully replaces `/`; only carousel + recent on it | |
| Landing on a separate route | `/` stays the quiz list; landing lives at `/about` or `/welcome` | |

**User's choice:** Landing becomes `/`, list → `/quizzes`

### What a logged-in user sees at `/`

| Option | Description | Selected |
|--------|-------------|----------|
| Same landing | Guest and authenticated see identical landing | |
| Landing, but CTA/header adapt | Same landing, CTA shows "Мои тесты"/"Создать тест" | ✓ |
| Redirect to `/my` | Authenticated users redirected to their quizzes | |

**User's choice:** Landing, but CTA/header adapt

### Primary CTA destination

| Option | Description | Selected |
|--------|-------------|----------|
| Registration (`/auth`) | Primary CTA "Начать бесплатно" → auth page | ✓ |
| AI wizard | CTA → AI wizard (still needs auth → redirects to `/auth`) | |
| Two CTAs | Primary → registration + secondary → catalog | |

**User's choice:** Registration (`/auth`)

---

## Service Overview (Hero)

### Landing sections

| Option | Description | Selected |
|--------|-------------|----------|
| Hero + how-it-works + pricing | Hero, "Как это работает" (3 steps), pricing teaser → `/billing` | ✓ |
| Hero only | Compact: hero + CTA, then straight to carousel/recent | |
| Hero + benefits | Hero + 3–4 benefit cards, no pricing teaser | |

**User's choice:** Hero + how-it-works + pricing

### Copy source

| Option | Description | Selected |
|--------|-------------|----------|
| Claude drafts copy | Claude writes RU copy from PROJECT.md/SPEC.md, user edits later | ✓ |
| User provides texts | User supplies finished copy | |

**User's choice:** Claude drafts copy

### Product visual

| Option | Description | Selected |
|--------|-------------|----------|
| No screenshots | Text + gradient accents + live quiz cards as the visual | ✓ |
| Placeholder illustration | CSS mockup / abstract graphic in hero | |

**User's choice:** No screenshots

---

## Public Quiz Carousel

### Selection criteria

| Option | Description | Selected |
|--------|-------------|----------|
| All published, newest first | All `is_published=true`, sorted `created_at` DESC | ✓ (refined to `updated_at` — see merge below) |
| Random sample | Random N published quizzes each load | |
| Most popular | By number of attempts (needs aggregation/RPC) | |

**User's choice:** All published, newest first

### Carousel behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Manual scroll | Arrows / swipe, no auto-advance | |
| Auto-scroll + manual | Auto-advances, pauses on hover, has arrows | ✓ |
| Horizontal strip | Plain overflow-x scrollable row, no carousel JS | |

**User's choice:** Auto-scroll + manual

### Item count

| Option | Description | Selected |
|--------|-------------|----------|
| Up to 10–12 | Limited sample; "Смотреть все" → `/quizzes` | ✓ |
| Up to 20 | Larger strip | |

**User's choice:** Up to 10–12

---

## Recently Updated Quizzes

### Source

| Option | Description | Selected |
|--------|-------------|----------|
| Public by `updated_at` DESC | All published quizzes sorted by last-modified | ✓ |
| My recent (for logged-in) | Current user's recently updated quizzes | |

**User's choice:** Public by `updated_at` DESC

### Layout & count

The user noted the recently-updated block and the carousel overlap heavily ("что то одно, карусель или сетка"). A follow-up question was asked to resolve the duplication.

| Option | Description | Selected |
|--------|-------------|----------|
| One block — carousel by `updated_at` | Merge into a single carousel sorted `updated_at` DESC, no separate block | ✓ |
| Two separate blocks | Carousel (`created_at`) + recently-updated grid (`updated_at`) | |
| Carousel + grid, different selections | Carousel = random/rotating, grid = strict `updated_at` | |

**User's choice:** One block — carousel by `updated_at`

**Notes:** The phase title names both a "public quiz carousel" and "recently updated quizzes" as separate components. The user decided to merge them: on a young service the two orderings produce near-identical card sets, so two blocks would duplicate content. The single carousel (auto-scroll + manual, 10–12 items, sorted `updated_at` DESC) serves both purposes.

---

## Claude's Discretion

- Exact Russian copy for hero, "Как это работает" steps, pricing teaser, empty states.
- Carousel implementation approach (CSS scroll-snap vs. small library), auto-advance interval, arrow vs. dot navigation.
- Catalog route name (`/quizzes` working choice).
- Empty-state handling when no published quizzes exist.
- Whether the carousel fetch reuses `fetchPublishedQuizzes` or gets a dedicated fetcher.
- Pricing-teaser layout.

## Deferred Ideas

- Separate "recently updated" grid — merged into the single carousel.
- Quiz search / categories / filtering — own future phase.
- Product screenshots / illustrated mockups — out of scope.
- "Most popular" sorting by attempt count — needs aggregation, not this phase.
- User-specific "continue working" surface — out of scope.
- SEO / meta / OG tags for the landing — possible small follow-up.
