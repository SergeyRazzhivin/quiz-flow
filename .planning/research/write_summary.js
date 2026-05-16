const fs = require('fs');
const path = 'd:/projects/quiz-flow/.planning/research/SUMMARY.md';

const content = `# Research Summary: Quiz Flow

**Synthesized:** 2026-05-16
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md

---

## Executive Summary

Quiz Flow is a quiz/test SaaS targeting the Russian-speaking market with a clear competitive gap: no existing Russian tool combines AI generation from documents, per-person access control with statistics, and ruble pricing. The product follows a freemium model (Free: 3 quizzes, 1 AI gen/month; Pro: 490 rub/month) and differentiates through frictionless quiz-taking (no platform registration for takers) plus a 4-step AI wizard that generates targeted questions from uploaded text.

The architecture has two fundamentally distinct user types -- owners (Supabase Auth) and quiz-takers (no auth, token-based) -- which drives the most complex design decisions. All guest session writes are mediated by Edge Functions using the service_role key; the client-facing anon role has read-only access to published content only. This dual-track access model must be implemented correctly in Phase 1 or it poisons every subsequent phase.

The most consequential risks are: RLS policy design for the dual-user model (Phase 1), timer drift and answer loss during quiz-taking (Phase 2), AI timeout handling and malformed JSON (Phase 3), and idempotent webhook processing (Phase 4). The stack is fully fixed by specification -- the research focus is on correct usage patterns, not technology selection.

---

## Key Stack Choices

- **vue-draggable-plus@^0.6.1** -- only actively maintained Vue 3 wrapper for SortableJS; vue.draggable.next is abandoned. Use component mode with :key bound to question.id (never array index).
- **vee-validate@^4.15.1 + @vee-validate/zod** -- use defineField composable pattern only; the Field component approach is deprecated in v4.
- **Tailwind CSS v4** -- breaking changes: no tailwind.config.js, @tailwind directives removed, dark mode via @custom-variant dark in CSS. Plugin via @tailwindcss/vite, not PostCSS.
- **OpenAI gpt-4o-mini + Structured Outputs** -- correct model for structured extraction (15x cheaper than gpt-4o, 100% schema adherence). Use stream: false; always check message.refusal before parsing. Cap input at 12,000 chars.
- **YooKassa via raw fetch** -- official SDK is not Deno-compatible; raw fetch with Basic Auth is safer. Webhook verification is IP allowlist (not HMAC). Idempotency key required on every payment creation.
- **Steiger** (FSD linter) in CI from day one -- prevents layer violations and feature-to-feature imports before they accumulate.

---

## Table Stakes Features (must ship)

1. Single and multiple choice questions with auto-grading (score = correct / total)
2. Result page with score shown immediately on submission
3. Shareable per-person access links (token + login + password, no platform account required)
4. Countdown timer with auto-submit on expiry; turns red in final 20% of time
5. Navigation controls (next/previous) with owner-controlled allow-back toggle
6. Basic statistics for owners: total attempts, completion rate, average score, per-person result table
7. Published/unpublished toggle -- prevents premature sharing
8. Quiz title, description, and cover image -- shown on pre-quiz landing
9. Drag-and-drop question reordering (order persisted to DB immediately on drop)
10. Mobile-responsive quiz-taking (100dvh layout, Tailwind responsive classes)

**Critical schema gap to fix:** shuffle_answers is missing. Add as quizzes.settings.shuffle_answers boolean (default false).

---

## Top Differentiators

1. **AI generation from documents** -- 4-step wizard (topic => upload text => refinement controls => progress => redirect to editor). Refinement controls (question count 5-30, difficulty easy/medium/hard, focus area text field) produce targeted questions vs. generic recall. No Russian competitor offers this.
2. **Per-person access tokens without platform registration** -- takers land on /q/:token, enter owner-assigned login+password, done. Identity without friction. Fills the gap between open link (no identity) and platform account required.
3. **Per-question accuracy stats gated behind Pro** -- blurred preview + upgrade CTA is the single strongest upgrade trigger. Free tier shows summary stats; Pro unlocks per-question accuracy, drop-off by question, score distribution.
4. **Ruble pricing via YooKassa** -- no USD exposure, no VPN needed, supports SBP/YooMoney. 490 rub/month sits correctly in the 299-999 rub/month Russian EdTech SaaS cluster.

---

## Critical Architectural Decisions

1. **Dual-track RLS: two separate policy families** -- TO authenticated (owner, checks auth.uid() = owner_id) and TO anon (read-only published content). password_hash and is_correct must never be SELECTable by anon. quiz_access table has no anon policy at all -- all credential validation in Edge Functions only.

2. **Guest writes are Edge Function-only** -- five Edge Functions mediate all guest interaction: verify-quiz-access, start-quiz-session, submit-quiz-answers, get-quiz-result, generate-quiz. Guest token is a short-lived custom JWT (1 hour) stored in sessionStorage (not localStorage). Service role key never reaches the client.

3. **FSD layer discipline enforced by tooling** -- Pinia stores live in 4-features/*/model/, entities have no store. 5-entities holds data shapes and API fetchers with no business logic. 3-widgets is the only layer allowed to compose multiple features. Pages are thin assemblers under 80 lines. Steiger linter runs in CI.

4. **AI generation is async, not synchronous** -- Edge Function inserts an ai_jobs row with status=pending, returns job ID in under 200ms, then runs the OpenAI call in EdgeRuntime.waitUntil(). Client polls or subscribes via Supabase Realtime. Prevents the 25-second wall timeout. Step 4 of the wizard is a loading state with deterministic CSS progress animation.

---

## Top 5 Pitfalls (by severity)

**1. RLS policy collision between anon and authenticated roles (CRITICAL -- Phase 1)**
Writing USING (auth.uid() = owner_id) as the only policy means takers see nothing. Both role families must be explicit with the TO clause. Wrap auth.uid() in a subquery to trigger Postgres initPlan optimization. Apply required indexes (owner_id, token, quiz_access_id) from migration 007.

**2. Timer drift when browser tab goes to background (HIGH -- Phase 2)**
Chrome throttles setInterval in background tabs to once per minute after 5 minutes. Always compute (started_at + time_limit_sec) - Date.now() on every tick and recalculate on visibilitychange. Server also enforces deadline on submit.

**3. Answer loss on page refresh (HIGH -- Phase 2)**
Storing answers only in Pinia and submitting on finish means a page refresh loses all progress. Upsert each answer to session_answers immediately on selection. On mount: if session_id exists in sessionStorage, restore from DB and resume timer from server started_at.

**4. AI Edge Function synchronous timeout (HIGH -- Phase 3)**
OpenAI calls can take 5-30 seconds. Use async job pattern: return job ID immediately, process in waitUntil(). Cap input at 12,000 chars, use Structured Outputs (not JSON mode), validate with Zod before inserting rows. Check message.refusal before JSON.parse.

**5. Duplicate YooKassa webhook processing (HIGH -- Phase 4)**
YooKassa retries for 24 hours on non-200 responses. Check yookassa_payment_id before any state change; use ON CONFLICT DO UPDATE. Verify IP allowlist; re-fetch payment from YooKassa API to confirm status -- never trust webhook payload alone.

**Honourable mentions:** is_correct exposed to anon during quiz-taking; AI usage counter race condition (needs atomic upsert); order_index gaps after deletion; array reference replacement conflicting with SortableJS during active drag.

---

## Implied Phase Structure

| Phase | Scope | Key Deliverables | Research Flag |
|-------|-------|-----------------|---------------|
| 1 | Foundation | DB migrations 001-007 + RLS, 6-shared, 5-entities, FSD tooling | None -- patterns documented |
| 2 | Auth + Editor | Owner auth, quiz editor with DnD, cover upload, publish toggle | None |
| 3 | Quiz-taking | Guest EFs (verify/start/submit/result), timer + answer persistence, QuizSharePage, result page | Verify bcrypt on Deno |
| 4 | Sharing | Per-person access link UI, link expiry, label display | None |
| 5 | AI Wizard | generate-quiz EF (async job), 4-step wizard UI, file parsing, freemium AI counter | File parsing UNRESOLVED -- needs decision before planning |
| 6 | Statistics | Stats feature, per-question accuracy (Pro gate), blurred upgrade CTA | None -- N+1 pattern documented |
| 7 | Billing | yookassa-webhook EF, payment UI, plan enforcement via DB trigger, pg_cron expiry | None -- patterns documented |

**Key dependency:** Guest EFs (Phase 3) must have deployable skeletons with mock responses before end-to-end quiz-taking UI development starts.

---

## Critical Gaps and Open Questions

1. **File parsing in AI wizard (BLOCKING for Phase 5):** PDF/DOCX text extraction server-side is not resolved. Options: pdf-parse (Node, needs ESM shim in Deno), LlamaIndex, OpenAI Files API. Decision required before Phase 5 planning.

2. **AI per-run question cap:** Currently only run-count is gated. A per-run question cap (10 on Free, 30 on Pro) is a stronger upgrade lever and reduces costs. Recommend adding to Phase 5 scope.

3. **Quiz result page after tab close:** Guest token is in sessionStorage -- closing tab makes result inaccessible. Need graceful session-expired handling on /q/:token/result.

4. **shuffle_answers missing from schema:** Add to quizzes.settings JSONB before Phase 2 ships.

5. **Supabase Storage RLS for cover images:** Public read + owner write policy is not in migration 007. Namespace paths as covers/{owner_id}/{quiz_id}/{uuid}.{ext}.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (library choices, versions) | HIGH | Confirmed on npm registry and official docs |
| RLS design patterns | HIGH | Official Supabase docs; policy SQL verified |
| FSD layer mapping | HIGH | Official FSD docs + steiger tooling |
| OpenAI Structured Outputs | HIGH | Production-ready, official docs |
| YooKassa webhook (IP allowlist) | HIGH | Official YooKassa developer docs |
| Guest JWT via custom Edge Function | MEDIUM | Documented pattern; needs local integration test |
| Edge Functions npm specifier + bcrypt | MEDIUM | Announced as recommended; verify deno.json pinning |
| File parsing strategy (PDF/DOCX) | LOW | Not researched; open question |
| steiger with numbered FSD prefixes | MEDIUM | Verify handles 1-app, 2-pages, etc. |
`;

fs.writeFileSync(path, content, 'utf8');
console.log('written ok, bytes:', content.length);
