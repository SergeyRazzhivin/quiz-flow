# Walking Skeleton — Quiz Flow

**Phase:** 1
**Generated:** 2026-05-16

## Capability Proven End-to-End

A new user can register with email + password on a deployed Vite/Vue app, the Supabase `handle_new_user` trigger creates their `profiles` row, the auth session persists across a browser refresh, and they land on the home page (`/`) which performs a real anon SELECT against the `quizzes` table — proving scaffold → routing → auth → DB read/write → UI all work together.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Vite + Vue 3.5 (script setup, Composition API) + TypeScript | Project constraint (CLAUDE.md, SPEC.md) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` plugin; `@theme` in `main.css`, no `tailwind.config.js` | v4 is the locked stack; v3 config syntax does not work (RESEARCH.md Pitfall 7) |
| Architecture | FSD with numeric prefixes `1-app` … `6-shared`; path aliases `@app`…`@shared`; steiger linter in CI from day one | Project constraint; prevents layer drift (RESEARCH.md Pitfall 4) |
| State | Pinia 3 (Composition API stores, `defineStore('name', () => {})`) | Project constraint |
| Routing | Vue Router 4 with global `beforeEach` guard for `/my` and `/editor` | Project constraint; D-03 |
| Data layer | Supabase (PostgreSQL + Auth + Storage); all 7 migrations applied in Phase 1 for schema completeness | SPEC.md migration list; future phases need the full schema |
| Auth | Supabase Auth email + password; `onAuthStateChange` for session sync; `profiles` row auto-created by `handle_new_user` trigger | RESEARCH.md Pattern 2; ASVS V2/V3 |
| RLS | Dual-policy per table: `TO authenticated` (owner via `(SELECT auth.uid())`) + `TO anon` (published content only); `answer_options_public` view excludes `is_correct` | RESEARCH.md Pattern 5; CLAUDE.md constraint |
| Storage | Public `covers` bucket; INSERT policy restricts path prefix to `auth.uid()` | RESEARCH.md Open Question 4 |
| UI components | shadcn-vue source-copied into `6-shared/ui/`; lucide-vue-next icons; vue-sonner toasts | D-18; UI-SPEC.md |
| Deployment target | Local dev: `npm run dev` against a hosted Supabase project (URL + anon key in `.env`); migrations applied via `supabase db push` | No hosting provider chosen for Phase 1; full stack runs locally against real Supabase |
| Directory layout | `src/1-app … 6-shared` for frontend; `supabase/migrations/*.sql` for schema | SPEC.md / ARCHITECTURE.md |

## Stack Touched in Phase 1

- [x] Project scaffold — Vite + Vue + TS + Tailwind v4 + Pinia + Vue Router + ESLint + steiger + vitest (Plan 01)
- [x] Routing — `/`, `/auth`, `/my`, `/editor/:id` with `beforeEach` auth guard (Plan 01)
- [x] Database — 7 migrations + RLS pushed via `supabase db push`; real anon SELECT on `quizzes`, real authenticated INSERT/UPDATE/DELETE (Plans 01–04)
- [x] UI — auth form wired to `supabase.auth`, register → DB trigger → redirect (Plan 01); quiz CRUD UI (Plans 02–04)
- [x] Deployment — `npm run dev` runs the full stack against a hosted Supabase project; documented in `README` / `.env.example`

## Out of Scope (Deferred to Later Slices)

- Quiz taking by guests, token links, live timer — Phase 2
- Per-person access link creation/management — Phase 2
- AI quiz generation wizard + Edge Functions — Phase 3
- Statistics pages — Phase 4
- YooKassa billing, freemium limit enforcement at DB level — Phase 5
- Dark mode (tokens defined now, light mode only ships in Phase 1)
- Mobile editor layout (editor shows a desktop-only notice below 768px)
- Password reset, email verification, OAuth (D-04)
- Production hosting / CI deployment pipeline (local dev run is the Phase 1 target)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: A guest takes a quiz by token link under a live timer and sees their score; owner manages access links
- Phase 3: An owner generates a full quiz from text in a 4-step wizard via an async Edge Function
- Phase 4: An owner views attempt statistics and per-question accuracy
- Phase 5: An owner subscribes to Pro via YooKassa; freemium limits enforced at DB/Edge Function level
