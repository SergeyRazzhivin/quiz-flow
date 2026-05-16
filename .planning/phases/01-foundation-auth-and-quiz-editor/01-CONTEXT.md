# Phase 1: Foundation, Auth & Quiz Editor - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Authenticated owner can register, log in, create a quiz, build it out with questions/answer-options, reorder via drag-and-drop, configure navigation settings, upload a cover image, and publish/unpublish — the full editorial surface ready for sharing.

**Requirements covered:** AUTH-01–03, QUIZ-01–07, EDIT-01–08, NAV-01–02 (20 requirements)

**NOT in this phase:** quiz-taking by guests, access link creation, AI generation, statistics, billing.

</domain>

<decisions>
## Implementation Decisions

### Auth Flow
- **D-01:** After successful login OR registration → redirect to `/` (public quiz list, not `/my`)
- **D-02:** AuthPage is a single route `/auth` with a toggle (tabs or switch link) between login and register modes — not separate routes
- **D-03:** Unauthenticated user accessing `/my` or `/editor/:id` → route guard redirects to `/auth?returnUrl=...`; after successful auth → return to original destination
- **D-04:** Auth form is minimal: email + password + submit button only. No `full_name` field, no "Remember me" checkbox, no OAuth

### Quiz Creation & Lists
- **D-05:** "New Quiz" button on `/my` → immediately `INSERT INTO quizzes` (default title `"Без названия"`) → `router.push('/editor/:id')`. No modal or intermediate form
- **D-06:** Both `/` (public published quizzes) and `/my` (owner's quizzes) use the same card grid layout with a shared `QuizCard` component. `/my` cards have edit/delete actions; `/` cards do not
- **D-07:** Delete quiz → custom confirmation dialog before executing `DELETE`. `window.confirm` is acceptable for v1
- **D-08:** Empty state on `/my` for new users (no quizzes yet): illustration/icon + "У вас пока нет тестов" text + "Создать первый тест" CTA button

### Question Editor UX
- **D-09:** Questions in the editor are always expanded (never collapsible). Scrollable body section handles overflow
- **D-10:** "Add question" → new question appended to end of list, page auto-scrolls to it, `textarea` for question text receives focus
- **D-11:** Delete question → confirmation dialog. Delete individual answer option → no confirmation (immediate)
- **D-12:** All error and success feedback uses a toast notification system, consistent across the entire app (auth errors, save errors, publish success, etc.)
- **D-13:** Question validation (min 2 answer options, at least 1 marked correct) is enforced at **publish time**, not at auto-save time. Quiz can be saved in any state

### Cover Image Upload
- **D-14:** Cover upload zone supports both click-to-open file picker and drag-and-drop
- **D-15:** When no cover is uploaded: placeholder zone with an icon + "Добавить обложку" label text (no gradient placeholder background)
- **D-16:** After file selection → upload immediately to Supabase Storage, save `cover_url` to quiz. No preview-then-confirm step
- **D-17:** Accepted formats: JPEG, PNG, WebP. Max file size: 5 MB. Resize to max 1280px wide on the client before uploading (original not stored). Storage path: `covers/{owner_id}/{quiz_id}/{uuid}.{ext}`

### Component Library
- **D-18:** Use **shadcn-vue** as the UI component foundation. Components are copied into the project (no vendor lock-in). Tailwind CSS v4 compatible. Provides: Button, Dialog, Tabs, Input, Select, Toggle, Tooltip, Toast out of the box

### Claude's Discretion
- Auto-save debounce interval for quiz metadata (research recommends 500ms)
- Exact toast library choice (radix-vue's own toast or vue-sonner — both work with shadcn-vue)
- Specific icon set (Lucide is standard with shadcn-vue)
- Whether publish toggle uses a `<Toggle>` or `<Switch>` from shadcn-vue

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements & Scope
- `.planning/ROADMAP.md` — phase goals, success criteria, requirement IDs per phase
- `.planning/REQUIREMENTS.md` — full v1 requirement list with all 48 requirements
- `SPEC.md` — project specification: tech stack, all page routes with auth requirements, DB schema (all 7 tables), migration file list, freemium limits

### Architecture & Patterns
- `.planning/research/ARCHITECTURE.md` — FSD layer mapping (which code goes where), Pinia store patterns for `useQuizEditorStore`, component hierarchy for `QuizEditorPage`, `100dvh` grid layout, build order

### Pitfalls to Avoid
- `.planning/research/PITFALLS.md` — Phase 1 specific pitfalls: RLS dual-policy pattern (Pitfall 1.1–1.4), DnD pitfalls (6.1–6.4), Storage filename collision (7.4), FSD drift (4.1–4.3)

### Research Context
- `.planning/research/STACK.md` — tech stack rationale and library versions
- `.planning/research/FEATURES.md` — feature-level research context

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — greenfield project. `src/` and `supabase/` directories do not exist.

### Established Patterns
- All FSD patterns must be established fresh per `.planning/research/ARCHITECTURE.md`
- Steiger (FSD linter) must be set up from day one in CI per PITFALLS.md §4

### Integration Points
- Supabase project: credentials to be configured in `6-shared/api/supabase.ts`
- Supabase Storage bucket `covers` must be created alongside migrations
- Route guard (`beforeEach`) wired in `1-app/router/index.ts`

</code_context>

<specifics>
## Specific Ideas

- **Design reference:** app.promto.ai — minimalism, clean cards, hover effects
- **Brand accent:** gradient CTA buttons `from-violet-600 to-indigo-600`
- **Font:** Inter (Google Fonts)
- **Component library:** shadcn-vue (source-copy approach, not npm import)
- **DnD library:** vue-draggable-plus (already decided in SPEC.md)
- **Quiz editor layout:** CSS Grid `grid-template-rows: auto 1fr auto; height: 100dvh` — fixed header, scrollable body, fixed footer (per ARCHITECTURE.md)
- **Publish validation:** Can publish only if quiz has ≥1 question, each question has ≥2 options with ≥1 correct

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 1-Foundation, Auth & Quiz Editor*
*Context gathered: 2026-05-16*
