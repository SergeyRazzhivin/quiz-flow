---
phase: 3
slug: ai-wizard
status: verified
threats_total: 15
threats_closed: 15
threats_open: 0
asvs_level: 1
created: 2026-05-17
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> AI Wizard — owner-authenticated AI quiz generation via the `ai-generate-quiz`
> Edge Function, the `ai_jobs` tracking table, the 4-step wizard UI, and the
> evals harness.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → `ai-generate-quiz` EF | Owner-supplied request (title, source text/file, generation params) crosses into the server; auth header attached by `supabase.functions.invoke` | Owner JWT, untrusted source text/PDF/DOCX, generation parameters |
| `ai-generate-quiz` EF → OpenAI API | Owner source material is transmitted to a third-party processor (GPT-4o-mini) | Owner source text — third-party processing |
| `ai_jobs` / `quizzes` tables → owner client | Job status and the generated quiz are read back under owner-SELECT RLS (direct PostgREST poll, no status EF) | Job progress, generated quiz content |
| `/ai-wizard` route | Authenticated-only owner view; the `requiresAuth` router guard gates entry | In-app navigation (owner session) |
| evals harness → OpenAI API | The Promptfoo D4-D6 gate calls OpenAI; runs in dev/CI only, never in the shipped app | `OPENAI_API_KEY` (env-only), reference dataset |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01 | Spoofing | `ai-generate-quiz` EF | mitigate | `verify_jwt` defaults true (EF omitted from `config.toml` — confirmed line 112 comment) + in-handler `supabase.auth.getUser(token)`; missing/invalid Authorization → 401. **Evidence:** `config.toml:90-112` (no `[functions.ai-generate-quiz]` block), `ai-generate-quiz/index.ts:209-211, 220-223` | closed |
| T-03-02 | Information Disclosure | `ai_jobs` table (IDOR) | mitigate | `owner_read_ai_jobs` RLS `FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()))`; RLS enabled; no anon policy; no INSERT/UPDATE policy (service_role writes only). **Evidence:** `012_ai_jobs.sql:32, 41-43` | closed |
| T-03-03 | Tampering | `persistQuiz` | mitigate | `quizzes.owner_id` set from the verified `user.id` (passed as `ownerId`), never from the request body (Pitfall 6). **Evidence:** `ai-generate-quiz/index.ts:62` (`owner_id: ownerId`), `:328` (`ownerId: user.id`) | closed |
| T-03-04 | Tampering | OpenAI prompt | mitigate | System/user message-role separation — `SYSTEM_PROMPT` is a const; owner source text only enters the user message via `buildUserPrompt`, never concatenated into the system prompt; system prompt explicitly instructs the model to ignore instructions inside the source. **Evidence:** `quiz-prompt.ts:10-20` (const + ignore-instructions rule line 19), `:64-68` (source in user-prompt body), `openai.ts:60-70` (separate roles) | closed |
| T-03-05 | Denial of Service | `extract-text.ts` | mitigate | Plan-aware raw-byte size check server-side before extraction (Free 1 MB / Pro 5 MB) → throws `FILE_TOO_LARGE`, mapped to HTTP 400; extracted text capped at 12000 chars; CR-02 fix (commit `cd73bd1`) adds a base64-string-length guard *before* `atob()`. **Evidence:** `extract-text.ts:96-100, 19/37-44` (cap), `ai-generate-quiz/index.ts:278-281` (base64 guard), `:293-297` (400 mapping) | closed |
| T-03-06 | Denial of Service | `ai-generate-quiz` EF | mitigate | Unauthenticated requests rejected (T-03-01); `questionCount` validated as a positive integer and capped server-side per plan (Free ≤10 / Pro ≤100) with HTTP 400 `QUESTION_COUNT_EXCEEDED` on overage. **Evidence:** `ai-generate-quiz/index.ts:251-263` | closed |
| T-03-07 | Tampering | `generateQuiz` output | mitigate | OpenAI Structured Outputs `strict: true` JSON schema + Zod `QuizSchema.parse` re-validation before any DB insert; `persistQuiz` runs only after `generateQuiz` succeeds; malformed output triggers one retry, then `runGeneration` sets `ai_jobs.status='failed'` (no `quizzes` row — D-03). **Evidence:** `openai.ts:72-75` (strict), `:91` (`QuizSchema.parse`), `:94-98` (count check), `index.ts:169, 186-200` | closed |
| T-03-08 | Information Disclosure | `OPENAI_API_KEY` / errors | mitigate | Key read via `Deno.env.get('OPENAI_API_KEY')`, never in client code or responses; outer catch returns `GENERIC_500_MESSAGE`, real detail logged server-side via `serializeError`. **Evidence:** `openai.ts:18`, `ai-generate-quiz/index.ts:343-346` | closed |
| T-03-SC | Tampering | npm installs (openai/unpdf/unzipit, promptfoo) | mitigate | Packages hard-pinned: `openai@4.104.0`, `unpdf@0.12.1`, `unzipit@1.4.3`, `zod@3.24.1` in `deno.json` and in every `npm:` import; verified against the official npm registry at the blocking-human checkpoint (plan 03-01 Task 4, orchestrator-approved per SUMMARY). `promptfoo` (03-03) is intentionally CI-only — not added to `devDependencies`. **Evidence:** `ai-generate-quiz/deno.json:2-8`, `openai.ts:13`, `extract-text.ts:16-17`, `quiz-schema.ts:11`, `03-01-SUMMARY.md` (Task 4), `03-03-SUMMARY.md` (promptfoo CI-only) | closed |
| T-03-09 | Spoofing | `/ai-wizard` route | mitigate | Route carries `meta: { requiresAuth: true }`; the existing `beforeEach` guard redirects unauthenticated users to `/auth` with `returnUrl`. **Evidence:** `1-app/router/index.ts:21, 28-35` | closed |
| T-03-10 | Information Disclosure | `fetchAiJob` poll | accept | Polling `ai_jobs` directly via PostgREST is scoped by the `owner_read_ai_jobs` SELECT RLS (T-03-02) — accepted risk. See Accepted Risks Log RISK-03-A. **Evidence:** `5-entities/ai-job/api.ts:45-53`, `012_ai_jobs.sql:41-43` | closed |
| T-03-11 | Tampering | client-side plan limits | accept | The wizard's `planMaxQuestions` / `planMaxFileBytes` checks are UX only; the EF re-validates server-side and returns HTTP 400 on overage (T-03-05 / T-03-06 confirmed) — accepted risk. See Accepted Risks Log RISK-03-B. **Evidence:** `useAiWizardStore.ts:15-16, 92-104` (UX checks), `ai-generate-quiz/index.ts:251-263, 278-281` (server re-validation) | closed |
| T-03-12 | Denial of Service | poll loop | mitigate | `stopPolling` clears the interval on `completed` / `failed` / `cleanup` / `retry` / `backToParams`; the widget's `onUnmounted` calls `cleanup()`; a 90s hard poll deadline (WR-01) fails out an orphaned job — no zombie timer. **Evidence:** `useAiWizardStore.ts:172-177` (`stopPolling`), `:159, 164, 180, 186, 195` (call sites), `:150-154` (deadline), `AiWizardWidget.vue:49-52` (`onUnmounted`) | closed |
| T-03-13 | Information Disclosure | privacy disclosure | mitigate | Step 4 shows the "source text is sent to OpenAI" small-print so the owner is informed source material is sent to a third party. **Evidence:** `4-features/ai-wizard/ui/WizardStep4.vue:62-64` ("Текст материала передаётся в OpenAI для генерации.") | closed |
| T-03-14 | Information Disclosure | evals `OPENAI_API_KEY` | mitigate | The eval run reads `OPENAI_API_KEY` from env / a gitignored `.env`; the key is never committed; the `evals/` harness is dev/CI-only and not bundled into the app. **Evidence:** `evals/promptfooconfig.yaml:42-43`, `.gitignore:7-11` (`.env`, `.env.local`, `supabase/functions/.env`) | closed |
| T-03-15 | Spoofing | entry buttons | accept | The `Создать с ИИ` buttons only `router.push('/ai-wizard')`; the `requiresAuth` guard (T-03-09) and the EF owner-auth (T-03-01) are the real access controls — accepted risk. See Accepted Risks Log RISK-03-C. **Evidence:** `2-pages/MyQuizListPage.vue:70`, `3-widgets/QuizEditorHeader.vue:35` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| RISK-03-A | T-03-10 | The wizard polls `ai_jobs` directly via PostgREST instead of through a dedicated status Edge Function (deliberate AI-SPEC §3 deviation, RESEARCH Assumption A2). The `owner_read_ai_jobs` SELECT RLS scopes every read to `owner_id = auth.uid()` — an owner can only ever read their own jobs, and there is no anon policy. No additional client-side check is needed; the data exposure is bounded by RLS. | gsd-security-auditor (audit, plan-time disposition) | 2026-05-17 |
| RISK-03-B | T-03-11 | The wizard's `planMaxQuestions` / `planMaxFileBytes` checks (`isStepValid`) are UX-only affordances. A bypassed or tampered client cannot exceed plan limits because the `ai-generate-quiz` EF independently re-validates `questionCount` and file/base64 size against `profiles.plan` and returns HTTP 400 on overage (project constraint #4 — freemium limits enforced at the Edge Function level). The client check is convenience, not a control. | gsd-security-auditor (audit, plan-time disposition) | 2026-05-17 |
| RISK-03-C | T-03-15 | The two `Создать с ИИ` entry buttons (`/my`, the `/my` empty state, the editor header) only issue `router.push('/ai-wizard')`. They carry no privilege and create no new attack surface — the `requiresAuth` route guard (T-03-09) and the EF owner-authentication (T-03-01) are the real access controls. A spoofed/injected button click lands on a guarded route. | gsd-security-auditor (audit, plan-time disposition) | 2026-05-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. The three plan SUMMARY files (`03-01`, `03-02`, `03-03`) contain no `## Threat Flags` section; no new attack surface appeared during implementation without a threat mapping. All STRIDE threats were authored at plan time (`register_authored_at_plan_time: true`) and every one resolved against the implemented code.

*Note — non-security defects:* the code review (`03-REVIEW.md`) raised CR-02 (a real file-size-limit bypass on the base64 payload). It was fixed in commit `cd73bd1` — the base64-string-length guard at `ai-generate-quiz/index.ts:278-281` and the `sourceText` cap at `:301-309` are present and verified. CR-01 (difficulty enum mismatch) and the WR-/IN-class findings are functional/robustness defects, not declared threats, and are out of scope for this audit.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-17 | 15 | 15 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-17
