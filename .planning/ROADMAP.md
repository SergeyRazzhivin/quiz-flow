# Roadmap: Quiz Flow

**Project:** Quiz Flow
**Total phases:** 7 (v1.0: Phases 1–6 complete · v1.1: Phase 7 active)
**Requirements coverage:** 48/48 v1 requirements mapped ✓ · 3/3 v1.1 requirements mapped ✓

---

## Phases

### Milestone v1.0 (complete)

- [x] **Phase 1: Foundation, Auth & Quiz Editor** — Owner can register, log in, create and fully edit a quiz with DnD question ordering
- [x] **Phase 2: Quiz Taking & Sharing** — Guest can open a quiz by token link, authenticate, take it with a live timer, and see their score; owner can generate and manage per-person access links (completed 2006-05-17)
- [x] **Phase 3: AI Wizard** — Owner can generate a complete quiz from uploaded text in 4 steps via an async Edge Function + OpenAI pipeline (completed 2006-05-17)
- [x] **Phase 4: Statistics** — Owner can view attempt totals and per-person results (Free) and per-question accuracy (Pro) (completed 2006-05-17)
- [x] **Phase 5: Billing** — Owner can subscribe to Pro via YooKassa; freemium limits are enforced at DB/Edge Function level
- [x] **Phase 6: Landing page** — Public marketing landing at `/` (hero, "Как это работает", latest-quizzes grid, pricing teaser); catalog moved to `/quizzes`

### Milestone v1.1 (active)

- [ ] **Phase 7: Password Recovery** — Owner who forgot the password can request a recovery email from /forgot-password and set a new one on /reset-password via a one-time Supabase recovery link

### Phase 6: Landing page — service overview, public quiz carousel, and recently updated quizzes

**Goal:** A visitor landing on `/` sees a marketing overview of Quiz Flow — hero with an auth-adaptive CTA, a 3-step "how it works" explainer, an auto-scrolling carousel of freshly published quizzes, and a pricing teaser — while the existing quiz catalog moves to a dedicated `/quizzes` route
**Requirements**: None mapped — scope defined by CONTEXT.md decisions D-01..D-09
**Depends on:** Phase 5
**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Carousel fetcher (fetchCarouselQuizzes) + AppHeader/AppFooter nav-link rebinding to /quizzes

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02-PLAN.md — Landing widgets (Hero, How-it-works, QuizCarousel, PricingTeaser) + LandingPage assembler + router rebinding

---

## Phase Details

### Phase 1: Foundation, Auth & Quiz Editor

**Goal:** An authenticated owner can create, configure, and publish a quiz with questions, options, cover image, and navigation settings — the full editorial surface ready for sharing
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** AUTH-01, AUTH-02, AUTH-03, QUIZ-01, QUIZ-02, QUIZ-03, QUIZ-04, QUIZ-05, QUIZ-06, QUIZ-07, EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, NAV-01, NAV-02
**Success Criteria**:

1. A new user can register with email + password and immediately land in their dashboard
2. A returning user can log in, refresh the browser, and remain authenticated; they can log out from any page
3. An owner can create a quiz with title, description, time limit, and cover image (uploaded to Supabase Storage)
4. An owner can add, edit, reorder (drag-and-drop), and delete questions and their answer options; correct answers are marked and question type (single/multiple) is selectable
5. An owner can toggle navigation permissions (allow back, show stop button) and publish or unpublish the quiz; published quizzes appear on the home page list

**Plans**: 4 plans across 4 waves

**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: scaffold + 7 migrations + RLS + auth slice (AUTH-01–03)

**Wave 2**

- [x] 01-02-PLAN.md — Quiz lists: home /, my quizzes /my, create/delete, app header (QUIZ-04–06, NAV-01)

**Wave 3**

- [x] 01-03-PLAN.md — Quiz editor shell: metadata, cover upload, publish, navigation settings (QUIZ-01–03, QUIZ-07, EDIT-08, NAV-01–02)

**Wave 4**

- [x] 01-04-PLAN.md — Question editor: question/option CRUD, DnD reorder, publish validation (EDIT-01–07, QUIZ-03)

**Cross-cutting constraints:**

- All tables: `ENABLE ROW LEVEL SECURITY` + dual-policy (TO authenticated + TO anon)
- steiger runs in every task verify step
- Editor layout: `100dvh` (never `100vh`)
- All async ops: try/catch with `toast.error`

**UI hint**: yes

### Phase 2: Quiz Taking & Sharing

**Goal:** A guest taker can open a quiz by token URL, authenticate with their assigned credentials, complete the quiz under a live timer, and immediately see their score; the owner can create, view, and delete per-person access links
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** TAKE-01, TAKE-02, TAKE-03, TAKE-04, TAKE-05, TAKE-06, TAKE-07, TAKE-08, TAKE-09, TAKE-10, SHARE-01, SHARE-02, SHARE-03, EXT-04
**Success Criteria**:

1. A taker who opens /q/:token sees the quiz title, description, and cover image; entering the correct owner-assigned login + password grants access
2. A taker can navigate questions (next/previous per allow_back setting), see "Question X of Y" progress and a countdown timer, and stop early; each answer is saved immediately to the DB on selection
3. The timer counts down based on the server's started_at timestamp; the quiz auto-submits when time expires; the timer turns red in the final 20% of remaining time
4. After submission the taker sees a result page with their score and percentage
5. An owner can create a per-person access link (token + login + password + optional expiry), view all links for a quiz, and delete individual links

**Plans**: 5 plans across 4 waves

**Wave 1**

- [x] 02-01-PLAN.md — Migration 009 + Edge Function foundation: cors/jwt helpers, bcrypt probe, verify-quiz-access (TAKE-01–03)

**Wave 2**

- [x] 02-02-PLAN.md — Owner access-link slice: create-quiz-access EF, quiz-share store/UI, editor modal (SHARE-01–03)
- [x] 02-03-PLAN.md — Guest entry slice: /q/:token routes, intro + login, start-quiz-session, allow_retake toggle (TAKE-01–03, EXT-04)

**Wave 3**

- [x] 02-04-PLAN.md — Quiz-taking slice: answering, immediate upsert, server-anchored timer, navigation (TAKE-04–07, TAKE-09–10)

**Wave 4**

- [x] 02-05-PLAN.md — Submit + scoring + result slice: partial-credit scoring, result page, D-04 re-entry (TAKE-06, TAKE-08, TAKE-10, EXT-04)

**UI hint**: yes

### Phase 3: AI Wizard

**Goal:** An owner can generate a full quiz from a text source in 4 steps; the Edge Function runs the OpenAI call asynchronously and redirects the owner to the completed quiz in the regular editor
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07
**Success Criteria**:

1. An owner can open the AI wizard, enter a quiz title (step 1), paste text or upload a PDF/DOCX file (step 2), and set question count, difficulty, and focus area (step 3)
2. On step 4 the UI shows a progress indicator with Russian-language status messages while the Edge Function processes; the owner is never left on a blank screen
3. The Edge Function inserts an ai_jobs row, processes the OpenAI response in waitUntil(), and the client polls until the job completes — the overall request returns in under 200 ms
4. After generation completes the owner is automatically redirected to the standard quiz editor with all generated questions, options, and correct-answer flags pre-populated

**Plans**: 3 plans across 3 waves

**Wave 1**

- [x] 03-01-PLAN.md — Server foundation: migration 012 (ai_jobs + RLS), _shared AI helpers, ai-generate-quiz Edge Function (AI-05)

**Wave 2**

- [x] 03-02-PLAN.md — AI-wizard frontend slice: ai-job entity, 4-step wizard store + polling, step UI, /ai-wizard route, editor redirect (AI-01–04, AI-06–07)

**Wave 3**

- [x] 03-03-PLAN.md — Entry-point buttons (/my + editor header) and the AI-SPEC §5 evals harness (AI-01)

**UI hint**: yes

### Phase 4: Statistics

**Goal:** An owner can view attempt totals, completion rate, average score, and a per-person result table for any quiz; Pro owners can also see per-question accuracy broken down for every question
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** STATS-01, STATS-02, STATS-03
**Success Criteria**:

1. A Free-tier owner can open any quiz's statistics page and see total attempts, completion rate (%), and average score
2. A Free-tier owner can see a table of individual results: taker name, score, and completion timestamp
3. A Pro owner can see per-question accuracy (% of takers who answered correctly) for every question; a Free owner sees this section blurred with an upgrade CTA

**Plans**: 2 plans across 2 waves

**Wave 1**

- [x] 04-01-PLAN.md — Migration 013 stats RPCs (get_quiz_stats, get_quiz_accuracy) + shared format/ProgressBar helpers

**Wave 2**

- [x] 04-02-PLAN.md — quiz-stats feature slice: store, summary cards, results table, Pro-gated accuracy section, page/route, entry buttons

**UI hint**: yes

### Phase 5: Billing

**Goal:** An owner can view plan tiers, subscribe to Pro via YooKassa, and have freemium limits enforced automatically at the DB/Edge Function level; Pro access is revoked automatically on cancellation or expiry
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** PAY-01, PAY-02, PAY-03, PAY-04, PAY-05
**Success Criteria**:

1. An owner can visit a pricing page that clearly shows Free vs. Pro limits and features
2. An owner can click "Subscribe" and complete payment in rubles via YooKassa without leaving the core flow; on success they immediately gain Pro access
3. Free-tier limits (3 quizzes, 10 questions/quiz, 10 AI generations/month, no sharing links) are enforced at the DB or Edge Function level — bypassing the UI does not circumvent them
4. When a Pro subscription expires or is cancelled, Pro features become inaccessible automatically without manual intervention

**Plans**: 3 plans across 3 waves

**Wave 1**

- [x] 05-01-PLAN.md — DB enforcement: migration 015 (ai_generations, get_effective_plan, BEFORE INSERT triggers, get_usage RPC) (PAY-01, PAY-04, PAY-05)

**Wave 2**

- [x] 05-02-PLAN.md — Edge Functions: create-payment, public yookassa-webhook, AI limit gate in ai-generate-quiz (PAY-03, PAY-04, PAY-05)

**Wave 3**

- [x] 05-03-PLAN.md — Billing frontend slice: payment store, PricingCards, ProStatusBanner, BillingWidget/Page, /billing route, header link, limit upsell toast (PAY-01, PAY-02, PAY-03, PAY-05)

**UI hint**: yes

### Phase 6: Landing page — service overview, public quiz carousel, and recently updated quizzes

**Goal:** A visitor landing on `/` sees a marketing overview of Quiz Flow — hero with an auth-adaptive CTA, a 3-step "how it works" explainer, an auto-scrolling carousel of freshly published quizzes, and a pricing teaser — while the existing quiz catalog moves to a dedicated `/quizzes` route
**Mode:** standard
**Depends on:** Phase 5
**Requirements:** None mapped — scope defined by CONTEXT.md decisions D-01..D-09
**Success Criteria**:

1. Visiting `/` renders the landing page with sections in order: Hero → "Как это работает" → quiz carousel → pricing teaser (D-04)
2. The hero CTA adapts to auth state — "Начать бесплатно" → /auth for visitors, "Мои тесты" → /my for logged-in users; logged-in users see the same landing, no redirect (D-02, D-03)
3. The carousel shows published quizzes newest-first by updated_at, auto-advances every 4s with hover-pause, and has bounded prev/next controls (D-07, D-08, D-09)
4. The existing quiz catalog is reachable at `/quizzes`; all "Все тесты" links route there; both `/` and `/quizzes` are public (D-01)

**Plans**: 2 plans across 2 waves

**Wave 1**

- [x] 06-01-PLAN.md — Carousel fetcher (fetchCarouselQuizzes) + AppHeader/AppFooter nav-link rebinding to /quizzes (D-01, D-07, D-08)

**Wave 2**

- [ ] 06-02-PLAN.md — Landing widgets (Hero, How-it-works, QuizCarousel, PricingTeaser) + LandingPage assembler + router rebinding (D-01..D-09)

**UI hint**: yes

---

## Milestone v1.1: Password Recovery

### Phase 7: Password Recovery

**Goal:** An owner who has forgotten the password can request a recovery email from a dedicated `/forgot-password` page and set a new password on `/reset-password` after clicking the one-time Supabase recovery link, all without leaking whether a given email is registered
**Mode:** standard
**Depends on:** Phase 6 (reuses AuthPage + 4-features/auth store)
**Requirements:** AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):

1. From the sign-in form, an owner can click "Забыли пароль?" and arrive on `/forgot-password`, where submitting an email triggers `supabase.auth.resetPasswordForEmail` with `redirectTo` pointing at the production `/reset-password` route on GitHub Pages
2. A user who entered a wrong or unregistered email on `/forgot-password` still sees the same generic success message — the UI never confirms whether an email exists in the database
3. After clicking the link in the recovery email, the user lands on `/reset-password`, the client establishes a recovery session via the Supabase `PASSWORD_RECOVERY` auth event, and a new password set through `supabase.auth.updateUser({ password })` immediately allows sign-in on the next visit
4. An expired, reused, or tampered recovery link on `/reset-password` shows a clear Russian-language error state with a link back to `/forgot-password`, and never silently logs the user in with a stale session

**Plans:** 1 plan across 1 wave

Plans:
**Wave 1**

- [ ] 07-01-PLAN.md — Auth store recovery methods + tests, /forgot-password and /reset-password pages, "Забыли пароль?" link in LoginForm, public routes (AUTH-04, AUTH-05, AUTH-06)

**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Auth & Quiz Editor | 4/4 | Complete | 2026-05-17 |
| 2. Quiz Taking & Sharing | 5/5 | Complete | 2026-05-17 |
| 3. AI Wizard | 3/3 | Complete | 2026-05-17 |
| 4. Statistics | 2/2 | Complete | 2026-05-17 |
| 5. Billing | 3/3 | Complete | 2026-05-18 |
| 6. Landing page | 2/2 | Complete | 2026-05-21 |
| 7. Password Recovery | 0/1 | Planning | — |
