# Phase 2: Quiz Taking & Sharing — Research

**Researched:** 2026-05-17
**Domain:** Supabase Edge Functions (Deno), guest JWT auth, bcrypt, server-anchored timer, partial-credit scoring, Vue 3 + Pinia quiz-taking flow
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `/q/:token` shows quiz intro (title, description, cover, question count, time limit) AND the login/password form together on one screen.
- **D-02:** The `quiz_session` and timer start on an explicit "Начать" button — not on login.
- **D-03:** Owner-configurable `allow_retake` flag in `quizzes.settings` JSONB; EXT-04 is in Phase 2 scope.
- **D-04:** Re-opening `/q/:token` — resume in-progress, auto-submit expired, show result if finished + single-attempt, offer new attempt if finished + multi-attempt, fresh start if no session.
- **D-05:** Sticky header on taking screen — progress "Вопрос X из Y" + progress bar (left), countdown timer (right).
- **D-06:** "Стоп" (early finish) → confirmation dialog → score → result page.
- **D-07:** Required questions (`is_required`) block "Вперёд" navigation until answered.
- **D-08:** Timer expiry → "Время вышло" notice → automatic submit → result page.
- **D-09:** Timer is conditional on `time_limit_sec`; if null, no timer rendered, no auto-submit.
- **D-10:** Result page shows score + percentage ("8 из 10 (80%)"), taker's `quiz_access.label`, neutral message.
- **D-11:** Result page shows total only — no per-question breakdown (v2).
- **D-12:** Result page includes link to `/` (soft promo).
- **D-13:** Owner manages access links via a **modal** opened from editor header ("Ссылки доступа" button).
- **D-14:** Login and password are **auto-generated**; owner sets only `label`.
- **D-15:** After creating a link, UI shows a single copyable block (link + login + password). Plaintext password shown **only at creation** — only `password_hash` stored.
- **D-16:** Link list shows label, login, expiry, delete action — **no completion status**.
- **D-17:** Partial credit for multiple-answer questions: `max(0, (correct_selected − incorrect_selected) / total_correct_options)`. Quiz total = sum of per-question fractions.
- **D-18:** `quiz_sessions.score` → `numeric` (Phase 2 migration). Result page shows "X.X из N".
- **D-19:** Access via `/q/:token` is **independent of `is_published`**. No-question quiz shows graceful "тест пока не готов" state.

### Claude's Discretion

- Exact Russian copy for guest-facing messages, dialogs, and notices.
- Visual styling details within the established dark theme + orange accent design system.
- Internal structure of the Edge Functions and the guest-token (custom JWT) handling.
- Progress-bar visual treatment and the "timer turns red in the final 20%" exact styling.

### Deferred Ideas (OUT OF SCOPE)

- Per-question breakdown / showing correct answers on result page (v2, QA-02).
- Pass/fail threshold on result page.
- Completion status in the access-link list (Phase 4).
- Multiple-attempt aggregation (Phase 4).
- Pro-gating of access links (Phase 5).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAKE-01 | Тестируемый может открыть тест по токен-ссылке без авторизации | New public routes `/q/:token`; `verify-quiz-access` EF validates token+credentials |
| TAKE-02 | Тестируемый вводит логин и пароль для доступа к тесту | `GuestLoginForm.vue` in `4-features/quiz-taking`; POST to `verify-quiz-access` EF |
| TAKE-03 | Тестируемый видит название, описание и обложку теста перед началом | Quiz metadata served on intro screen from `verify-quiz-access` response |
| TAKE-04 | Тестируемый отвечает на вопросы по одному с навигацией | `useQuizTakingStore` manages `currentQuestionIndex`, `allow_back` from `quiz.settings` |
| TAKE-05 | Тестируемый видит прогресс и оставшееся время | Sticky header with "Вопрос X из Y" progress + countdown; timer from server `started_at` |
| TAKE-06 | Тестируемый может завершить тест досрочно | "Стоп" button → confirmation dialog → `submit-quiz-answers` EF (D-06) |
| TAKE-07 | Ответы сохраняются немедленно при выборе | Upsert to `session_answers` via `submit-answer` EF on every selection (or immediate upsert EF) |
| TAKE-08 | После завершения тестируемый видит результат | `QuizResultPage.vue` — score + percentage from `get-quiz-result` EF |
| TAKE-09 | Таймер основан на серверном `started_at` | Compute `(started_at + time_limit_sec) - Date.now()` on every tick; `visibilitychange` recompute |
| TAKE-10 | Тест автоматически отправляется по истечении времени | Timer reaches 0 → `finishSession()` store action → `submit-quiz-answers` EF |
| SHARE-01 | Владелец может создать индивидуальную ссылку с логином и паролем | `useQuizShareStore.createLink()` → `create-quiz-access` EF; auto-generate credentials |
| SHARE-02 | Владелец может установить срок действия ссылки | `expires_at` field in creation form (optional); `quiz_access.expires_at` already in schema |
| SHARE-03 | Владелец может просматривать и удалять ссылки доступа | `AccessLinkList.vue` + `deleteLink()` — owner deletes via authenticated Supabase client |
| EXT-04 | Повторные попытки по той же ссылке | `allow_retake` toggle in editor's `NavigationSettings.vue`; D-04 resume/retry logic |
</phase_requirements>

---

## Summary

Phase 2 is architecturally the most complex phase because it introduces Supabase Edge Functions — the project's first server-side code — and a guest authentication model that bypasses Supabase Auth entirely. Everything a guest taker does (verify credentials, start a session, save answers, submit, view results) flows through Edge Functions using the `service_role` key. The Vue client never touches `quiz_access.password_hash`, `answer_options.is_correct`, or any session write directly.

The four-function Edge Function set (`verify-quiz-access`, `start-quiz-session`, `upsert-session-answer`, `submit-quiz-answers`) issues and validates a custom short-lived JWT stored in `sessionStorage`. This JWT carries `{ quiz_access_id, quiz_id, session_id }` and is verified by every subsequent EF call, replacing the need for Supabase Auth on the guest side.

The timer implementation is the most common source of bugs in quiz products. The store must compute remaining time as `(started_at + time_limit_sec) - Date.now()` on every `setInterval` tick and recompute on `visibilitychange` to handle tab-backgrounding throttling. Storing seconds-remaining as a decrementing integer is wrong and will drift.

Scoring (D-17) is done inside `submit-quiz-answers` using the service_role client to read `answer_options.is_correct` (which the anon client can never see). The formula `max(0, correct_selected − incorrect_selected) / total_correct` is implemented in pure TypeScript in the EF, then the result stored as `numeric` in `quiz_sessions.score`.

The Phase 2 migration must: (1) alter `quiz_sessions.score` from `int` to `numeric`, (2) add `allow_retake` default to `quizzes.settings` JSONB, (3) add a UNIQUE partial index on `quiz_sessions(quiz_access_id) WHERE finished_at IS NULL` to prevent duplicate active sessions.

**Primary recommendation:** Build in wave order — migrations first, then Edge Functions with stub responses for local dev, then store logic, then UI. The EF must exist (even as stubs) before the frontend store can be tested end-to-end.

---

## Project Constraints (from CLAUDE.md)

| Directive | Category | Constraint |
|-----------|----------|------------|
| OpenAI never called from client | Security | Not relevant to Phase 2 (no AI), but pattern confirmed |
| Quiz-takers have no Supabase Auth | Architecture | All guest reads/writes via Edge Functions with service_role key |
| RLS must cover both owner and guest roles | Security | Existing Phase 1 RLS covers owners; Phase 2 adds no anon policies for sessions (EF-only) |
| Freemium limits enforced at DB/Edge level | Architecture | Access links are built ungated (Phase 5 enforces Pro gate) |
| FSD layer discipline enforced | Architecture | steiger runs in CI; new slices follow established layer structure |
| Stack is fixed | Stack | Vite + Vue 3 + TypeScript + Tailwind CSS v4 + Pinia + Vue Router 4 + Supabase + FSD |
| Numeric FSD prefixes | Architecture | `1-app` through `6-shared` |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Guest credential verification (bcrypt) | Edge Function (`verify-quiz-access`) | — | Password hash must never reach browser; service_role key server-only |
| Guest JWT issuance + verification | Edge Function (all guest EFs) | `sessionStorage` (storage only) | JWT is a server artifact; client only stores/passes the opaque string |
| Quiz session creation | Edge Function (`start-quiz-session`) | — | `quiz_sessions` INSERT must use service_role (no anon RLS policy) |
| Immediate answer upsert | Edge Function (`upsert-session-answer`) | `4-features/quiz-taking` store | Store calls EF on every answer selection; EF does DB write |
| Quiz submission + scoring | Edge Function (`submit-quiz-answers`) | — | Scoring reads `is_correct` (service_role); sets `finished_at` |
| Result retrieval | Edge Function (`get-quiz-result`) | — | Score + percentage; EF verifies guestToken before returning |
| Timer countdown display | `4-features/quiz-taking` store | Browser `setInterval` + `visibilitychange` | Server-anchored computation in store; UI reads reactive ref |
| Session resume logic (D-04) | `4-features/quiz-taking` store | `sessionStorage` | Store checks sessionStorage for existing guestToken/sessionId on mount |
| Access link CRUD (owner) | `4-features/quiz-share` store | `5-entities/quiz-access/api.ts` | Owner operations are authenticated (standard Supabase client + RLS) |
| Access link creation (bcrypt hash) | Edge Function (`create-quiz-access`) | — | Password must be hashed server-side; plaintext never stored |
| `allow_retake` toggle (editor) | `4-features/quiz-editor` store | `src/4-features/quiz-editor/ui/NavigationSettings.vue` | Extends existing `updateSettings()` pattern; no new infrastructure |
| New routes `/q/:token`, `/q/:token/result` | `1-app/router/index.ts` | `2-pages` | Public routes; no auth guard needed |
| Guest-facing pages | `2-pages` (thin assembly) | `3-widgets/QuizTakingWidget.vue` | Page renders widget based on `sessionStatus` |

---

## Standard Stack

### Core (established from Phase 1 — no changes)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| vue | 3.5.34 | Framework | Installed |
| pinia | 3.0.4 | State management | Installed |
| vue-router | 5.0.7 | Routing | Installed |
| @supabase/supabase-js | 2.105.4 | Supabase client + EF invocation | Installed |
| typescript | 5.8.3 | Type safety | Installed |
| tailwindcss | 4.3.0 | Utility CSS | Installed |
| vue-sonner | 2.0.9 | Toast notifications | Installed |
| lucide-vue-next | 1.0.0 | Icons | Installed |
| primevue | 4.5.5 | UI components | Installed |
| zod | 3.24.0 | Schema validation | Installed |

### New — Edge Function Runtime Dependencies (Deno, not npm)

These are imported inside Edge Function TypeScript files using `npm:` specifiers. They are NOT added to `package.json`.

| Import | Version | Purpose | Trust |
|--------|---------|---------|-------|
| `npm:@supabase/supabase-js@2` | 2.x | service_role client inside EF | [VERIFIED: official Supabase EF docs] |
| `npm:jose@5` | 5.9.6 | Sign + verify guest JWT (HS256) | [VERIFIED: Deno official docs example] |
| `npm:bcryptjs@2` | 2.x | Hash + compare passwords in EF | [ASSUMED — bcryptjs is standard; confirm npm registry before use] |

> **bcryptjs vs bcrypt:** `bcryptjs` is a pure-JavaScript bcrypt implementation with no native bindings. It works in Deno's npm compatibility layer without compilation. `bcrypt` (native) requires Node.js native bindings which Deno's npm compatibility does not support. Use `bcryptjs`. [ASSUMED — based on known Deno npm compatibility characteristics]

### No New npm Packages Required

Phase 2 adds no new `npm install` dependencies to the client project. All new logic lives in Edge Functions (Deno) or extends existing Vue/Pinia patterns.

---

## Package Legitimacy Audit

No new npm packages are being installed in `package.json` for Phase 2. Edge Function Deno imports are validated differently.

**Deno npm: imports used in Edge Functions:**

| Import | npm Registry | Age | Downloads | Source Repo | Disposition |
|--------|-------------|-----|-----------|-------------|-------------|
| `npm:@supabase/supabase-js@2` | npm | ~5 yr | 1M+/wk | github.com/supabase/supabase-js | Approved [VERIFIED: official] |
| `npm:jose@5` | npm | ~8 yr | 25M+/wk | github.com/panva/jose | Approved [VERIFIED: Deno docs] |
| `npm:bcryptjs@2` | npm | ~10 yr | 3M+/wk | github.com/dcodeIO/bcrypt.js | [ASSUMED] — verify before use |

**slopcheck was unavailable at research time.** All three packages are well-established with known source repositories. `bcryptjs` is tagged `[ASSUMED]` because it was identified from training knowledge, not from Context7 or official Supabase docs for Deno.

**Packages removed due to [SLOP]:** none
**Packages flagged [SUS]:** none (but `bcryptjs` is `[ASSUMED]` — planner should confirm against npm registry before implementing)

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Guest Taker)
│
├── GET /q/:token ──────────────────────────────────────────────────────────────┐
│   (public route, no Supabase Auth header)                                     │
│                                                                               │
│   QuizSharePage (2-pages)                                                     │
│   └── sessionStatus = 'idle' → GuestLoginForm (4-features/quiz-taking/ui)    │
│         │                                                                     │
│         │ POST login + password                                                │
│         ▼                                                                     │
│   supabase.functions.invoke('verify-quiz-access', { body: {token,login,pw} })│
│         │                                                                     │
│         ▼                                                                     │
│   Edge Function: verify-quiz-access                                           │
│   ├── service_role SELECT quiz_access WHERE token=? AND login=?               │
│   ├── bcryptjs.compare(password, password_hash)                               │
│   ├── check expires_at                                                        │
│   ├── check quiz has questions (D-19)                                         │
│   ├── service_role SELECT quiz + questions + answer_options_public            │
│   └── SignJWT({ quiz_access_id, quiz_id, exp: +1h }).sign(JWT_SECRET)        │
│         │                                                                     │
│         │ { guestToken, quiz, questions, answerOptions }                      │
│         ▼                                                                     │
│   store.sessionStatus = 'intro'                                               │
│   guestToken saved to sessionStorage                                          │
│   sessionStatus = 'intro' → QuizIntroScreen + "Начать" button                │
│         │                                                                     │
│         │ click "Начать"                                                       │
│         ▼                                                                     │
│   supabase.functions.invoke('start-quiz-session', { guestToken })            │
│         │                                                                     │
│         ▼                                                                     │
│   Edge Function: start-quiz-session                                           │
│   ├── jwtVerify(guestToken, JWT_SECRET) → { quiz_access_id, quiz_id }        │
│   ├── check for existing in-progress session (D-04 resume logic)             │
│   └── service_role INSERT quiz_sessions → { sessionId, started_at }          │
│         │                                                                     │
│         │ { sessionId, started_at }                                           │
│         ▼                                                                     │
│   store.sessionStatus = 'active'; startTimer(started_at, time_limit_sec)     │
│   QuizTakingWidget (3-widgets) renders                                        │
│         │                                                                     │
│         │ For each answer selection:                                           │
│         ▼                                                                     │
│   supabase.functions.invoke('upsert-session-answer', {                       │
│     guestToken, sessionId, questionId, selectedOptionIds                      │
│   })                                                                          │
│         │                                                                     │
│         ▼                                                                     │
│   Edge Function: upsert-session-answer                                        │
│   ├── jwtVerify(guestToken, JWT_SECRET)                                       │
│   └── service_role UPSERT session_answers (session_id, question_id) conflict │
│         │                                                                     │
│         │ (timer reaches 0 OR user clicks "Стоп" + confirms OR last question) │
│         ▼                                                                     │
│   supabase.functions.invoke('submit-quiz-answers', { guestToken, sessionId })│
│         │                                                                     │
│         ▼                                                                     │
│   Edge Function: submit-quiz-answers                                          │
│   ├── jwtVerify(guestToken, JWT_SECRET)                                       │
│   ├── service_role SELECT session_answers for session                         │
│   ├── service_role SELECT answer_options (WITH is_correct) for quiz          │
│   ├── compute partial-credit score (D-17 formula)                            │
│   └── service_role UPDATE quiz_sessions SET finished_at=NOW(), score=result  │
│         │                                                                     │
│         │ { score, totalQuestions, percentage }                               │
│         ▼                                                                     │
│   router.push('/q/:token/result')                                             │
│                                                                               │
│                                                                               │
└── GET /q/:token/result ────────────────────────────────────────────────────── │
    QuizResultPage (2-pages)                                                    │
    └── reads score + percentage from store (set after submit)                  │
        OR calls get-quiz-result EF if arriving via direct URL                  │
```

```
Browser (Owner)
│
└── QuizEditorPage ──► editor header "Ссылки доступа" button
                            │
                            ▼
              Modal (3-widgets or dialog in 4-features/quiz-share/ui)
              └── AccessLinkList + AccessLinkForm
                        │
                        │ create link (owner enters label only)
                        ▼
              supabase.functions.invoke('create-quiz-access', {
                quizId, label, expiresAt?
              })
              │ (authenticated owner — Authorization: Bearer <owner-jwt>)
              ▼
              Edge Function: create-quiz-access   [verify_jwt: true]
              ├── verify owner owns quiz (auth.uid() check)
              ├── generate login = nanoid(8), password = nanoid(16)
              ├── bcryptjs.hash(password, 10)
              └── service_role INSERT quiz_access
                        │
                        │ { token, login, password (plaintext, one-time only) }
                        ▼
              UI shows copyable block:
              Link: /q/{token}
              Логин: {login}
              Пароль: {password}    ← shown ONCE, never retrievable again
```

### Recommended Project Structure (Phase 2 additions)

```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── cors.ts              — corsHeaders constant
│   │   └── jwt.ts               — signGuestToken(), verifyGuestToken() helpers
│   ├── verify-quiz-access/
│   │   └── index.ts             — verify_jwt: false (public endpoint)
│   ├── start-quiz-session/
│   │   └── index.ts             — verify_jwt: false (validates guestToken manually)
│   ├── upsert-session-answer/
│   │   └── index.ts             — verify_jwt: false (validates guestToken manually)
│   ├── submit-quiz-answers/
│   │   └── index.ts             — verify_jwt: false (validates guestToken manually)
│   ├── get-quiz-result/
│   │   └── index.ts             — verify_jwt: false (validates guestToken manually)
│   └── create-quiz-access/
│       └── index.ts             — verify_jwt: true (owner must be authenticated)
└── migrations/
    └── 009_phase2_schema.sql    — score numeric, allow_retake, unique partial index

src/
├── 2-pages/
│   ├── QuizSharePage.vue        — /q/:token (new)
│   └── QuizResultPage.vue       — /q/:token/result (new)
│
├── 3-widgets/
│   ├── QuizTakingWidget.vue     — outer quiz-taking container (new)
│   ├── QuizTakingHeader.vue     — sticky progress + timer (new)
│   └── AccessLinksModal.vue     — owner's link management dialog (new)
│
├── 4-features/
│   ├── quiz-taking/
│   │   ├── model/
│   │   │   └── useQuizTakingStore.ts  — full session state (new)
│   │   └── ui/
│   │       ├── GuestLoginForm.vue     — new
│   │       ├── QuizIntroScreen.vue    — new
│   │       ├── QuestionTaker.vue      — renders question + answer options (new)
│   │       ├── NavigationControls.vue — Назад/Вперёд/Стоп buttons (new)
│   │       └── TimerDisplay.vue       — countdown, turns red at 20% (new)
│   │
│   └── quiz-share/
│       ├── model/
│       │   └── useQuizShareStore.ts   — access link CRUD (new)
│       └── ui/
│           ├── AccessLinkForm.vue     — label + expiry input (new)
│           ├── AccessLinkCreated.vue  — one-time password reveal (new)
│           └── AccessLinkList.vue     — list with delete (new)
│
├── 5-entities/
│   ├── quiz-access/
│   │   ├── model.ts             — QuizAccess interface (new)
│   │   └── api.ts               — fetchAccessLinks, deleteAccessLink (new)
│   └── quiz-session/
│       ├── model.ts             — QuizSession, SessionAnswer, SessionResult (new)
│       └── api.ts               — stubs only; actual writes via EF (new)
```

### Pattern 1: Edge Function Structure (verify_jwt: false)

**What:** All guest-facing Edge Functions disable the built-in JWT check (because guests have no Supabase Auth JWT) and manually verify the custom guest token instead.

**When to use:** `verify-quiz-access`, `start-quiz-session`, `upsert-session-answer`, `submit-quiz-answers`, `get-quiz-result`

```typescript
// Source: [VERIFIED: supabase.com/docs/guides/functions/function-configuration]
// supabase/functions/start-quiz-session/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyGuestToken } from '../_shared/jwt.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { guestToken } = await req.json()

    // Verify the custom guest token (not Supabase Auth JWT)
    const payload = await verifyGuestToken(guestToken)
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Business logic: check for existing session (D-04 resume logic)
    const { data: existing } = await supabase
      .from('quiz_sessions')
      .select('id, started_at, finished_at')
      .eq('quiz_access_id', payload.quiz_access_id)
      .is('finished_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      return Response.json(
        { sessionId: existing.id, started_at: existing.started_at, resumed: true },
        { headers: corsHeaders }
      )
    }

    const { data: session, error } = await supabase
      .from('quiz_sessions')
      .insert({ quiz_access_id: payload.quiz_access_id, quiz_id: payload.quiz_id })
      .select('id, started_at')
      .single()

    if (error) throw error
    return Response.json({ sessionId: session.id, started_at: session.started_at, resumed: false },
      { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

### Pattern 2: Custom Guest JWT — Sign and Verify

**What:** A short-lived HS256 JWT issued after credential verification. Contains `quiz_access_id`, `quiz_id`. The secret is the Supabase JWT secret, stored in `SUPABASE_JWT_SECRET` env var (set in `supabase/functions/.env` for local dev).

**When to use:** Shared helper module `supabase/functions/_shared/jwt.ts`, imported by all guest EFs.

```typescript
// Source: [VERIFIED: docs.deno.com/examples/creating_and_verifying_jwt/]
// supabase/functions/_shared/jwt.ts
import { SignJWT, jwtVerify } from 'npm:jose@5'

export interface GuestTokenPayload {
  quiz_access_id: string
  quiz_id: string
  iat: number
  exp: number
}

function getSecret(): Uint8Array {
  const secret = Deno.env.get('SUPABASE_JWT_SECRET')
  if (!secret) throw new Error('SUPABASE_JWT_SECRET not set')
  return new TextEncoder().encode(secret)
}

export async function signGuestToken(payload: Omit<GuestTokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getSecret())
}

export async function verifyGuestToken(token: string): Promise<GuestTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as GuestTokenPayload
  } catch {
    return null
  }
}
```

**Local dev:** add `SUPABASE_JWT_SECRET=<value-from-supabase-dashboard>` to `supabase/functions/.env` (gitignored). [CITED: supabase.com/docs/guides/functions/secrets]

### Pattern 3: bcryptjs in Deno Edge Function

**What:** Hash the password when creating a link; compare when verifying credentials. Use `bcryptjs` (pure JS, works in Deno's npm compat layer without native bindings).

**When to use:** `create-quiz-access` for hashing, `verify-quiz-access` for comparison.

```typescript
// Source: [ASSUMED — bcryptjs npm:specifier in Deno]
// supabase/functions/verify-quiz-access/index.ts (excerpt)
import bcrypt from 'npm:bcryptjs@2'

// Hash when creating (inside create-quiz-access):
const password = generateSecurePassword()  // random 16-char string
const passwordHash = await bcrypt.hash(password, 10)

// Compare when verifying (inside verify-quiz-access):
const valid = await bcrypt.compare(candidatePassword, access.password_hash)
if (!valid) return new Response('Invalid credentials', { status: 401 })
```

> **Fallback:** If `bcryptjs` has Deno compatibility issues, use `jsr:@std/crypto` with `crypto.subtle.digest` for PBKDF2 hashing. This is a fallback only — bcrypt is preferred for password hashing. [ASSUMED]

### Pattern 4: Server-Anchored Timer in useQuizTakingStore

**What:** The timer computes remaining seconds on every tick from `started_at` and `time_limit_sec`, both from the server. It never stores a "seconds remaining" decrement — always derives from wall clock vs. deadline.

**When to use:** `useQuizTakingStore` — called from `QuizTakingWidget` via `TimerDisplay.vue`.

```typescript
// Source: [CITED: .planning/research/PITFALLS.md §3.1 + ARCHITECTURE.md]
// 4-features/quiz-taking/model/useQuizTakingStore.ts (timer section)

const startedAt = ref<string | null>(null)    // ISO string from server
const timeLimitSec = ref<number | null>(null) // from quiz.time_limit_sec
const timeRemainingSeconds = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

function computeRemaining(): number {
  if (!startedAt.value || !timeLimitSec.value) return 0
  const deadline = new Date(startedAt.value).getTime() + timeLimitSec.value * 1000
  return Math.max(0, Math.floor((deadline - Date.now()) / 1000))
}

function startTimer() {
  if (!timeLimitSec.value) return  // D-09: no timer if time_limit_sec is null
  timeRemainingSeconds.value = computeRemaining()

  timerInterval = setInterval(() => {
    timeRemainingSeconds.value = computeRemaining()
    if (timeRemainingSeconds.value <= 0) {
      stopTimer()
      void finishSession()  // D-08: auto-submit
    }
  }, 1000)

  // Recompute when tab returns to foreground (prevents drift)
  document.addEventListener('visibilitychange', onVisibilityChange)
}

function onVisibilityChange() {
  if (!document.hidden) {
    timeRemainingSeconds.value = computeRemaining()
    if (timeRemainingSeconds.value <= 0) {
      stopTimer()
      void finishSession()
    }
  }
}

// Timer turns red in final 20% (D-05 + ROADMAP SC#3)
const isTimerCritical = computed(() => {
  if (!timeLimitSec.value) return false
  return timeRemainingSeconds.value <= timeLimitSec.value * 0.2
})
```

### Pattern 5: Immediate Answer Upsert via Edge Function

**What:** On every answer selection, the store calls `upsert-session-answer` EF. No local accumulation — this prevents answer loss on refresh (PITFALL 3.2).

**When to use:** `useQuizTakingStore.selectAnswer()` — called from `QuestionTaker.vue`.

```typescript
// Source: [CITED: .planning/research/PITFALLS.md §3.2 + ARCHITECTURE.md]
// 4-features/quiz-taking/model/useQuizTakingStore.ts (selectAnswer action)
async function selectAnswer(questionId: string, optionId: string, type: 'single' | 'multiple') {
  // Update local state immediately (optimistic)
  if (type === 'single') {
    answers.value[questionId] = [optionId]
  } else {
    const cur = answers.value[questionId] ?? []
    answers.value[questionId] = cur.includes(optionId)
      ? cur.filter(id => id !== optionId)
      : [...cur, optionId]
  }

  // Persist immediately — never accumulate to submit only at end
  try {
    const { error } = await supabase.functions.invoke('upsert-session-answer', {
      body: {
        guestToken: guestToken.value,
        sessionId: sessionId.value,
        questionId,
        selectedOptionIds: answers.value[questionId],
      },
    })
    if (error) toast.error('Не удалось сохранить ответ')
  } catch {
    toast.error('Не удалось сохранить ответ')
  }
}
```

### Pattern 6: Partial-Credit Scoring Formula (D-17)

**What:** Server-side TypeScript in `submit-quiz-answers`. Reads `is_correct` via service_role (not exposed to client). Returns `numeric` score.

```typescript
// Source: [CITED: CONTEXT.md D-17]
// supabase/functions/submit-quiz-answers/index.ts (scoring logic)

interface ScoredQuestion {
  question_id: string
  type: 'single' | 'multiple'
  correct_option_ids: string[]
  selected_option_ids: string[]
}

function scoreQuestion(q: ScoredQuestion): number {
  const totalCorrect = q.correct_option_ids.length
  if (totalCorrect === 0) return 0  // malformed question — skip

  const correctSelected = q.selected_option_ids.filter(id =>
    q.correct_option_ids.includes(id)
  ).length
  const incorrectSelected = q.selected_option_ids.filter(id =>
    !q.correct_option_ids.includes(id)
  ).length

  // D-17: max(0, (correct_selected - incorrect_selected) / total_correct)
  return Math.max(0, (correctSelected - incorrectSelected) / totalCorrect)
}

// Total quiz score = sum of per-question fractions (0…N)
// Percentage = (totalScore / totalQuestions) * 100
```

### Pattern 7: Session Resume Logic (D-04)

**What:** On `/q/:token` mount, `useQuizTakingStore.init()` checks `sessionStorage` for a stored `guestToken` and `sessionId` before showing the login form.

**When to use:** `useQuizTakingStore.init()` — called from `QuizSharePage` `onMounted`.

```typescript
// 4-features/quiz-taking/model/useQuizTakingStore.ts
async function init(token: string) {
  const stored = sessionStorage.getItem(`qf_guest_${token}`)
  if (!stored) {
    sessionStatus.value = 'idle'  // show login form
    return
  }

  const { guestToken: gt, sessionId: sid } = JSON.parse(stored)

  // Call start-quiz-session which handles D-04 state machine:
  // - In-progress + time not expired → resume (returns { resumed: true })
  // - In-progress + time expired → auto-submit → mark finished
  // - Finished + allow_retake=false → show result
  // - Finished + allow_retake=true → offer new attempt
  const { data, error } = await supabase.functions.invoke('start-quiz-session', {
    body: { guestToken: gt }
  })
  // ...handle each state
}
```

**Storage key:** `qf_guest_{token}` in `sessionStorage` — scoped to the token URL so multiple quizzes don't collide. Clears on tab close (sessionStorage semantics).

### Pattern 8: config.toml Edge Function Configuration

**What:** Each guest-facing EF has `verify_jwt = false` in `supabase/config.toml`. The owner-facing `create-quiz-access` uses the default `verify_jwt = true`.

```toml
# Source: [VERIFIED: supabase.com/docs/guides/functions/function-configuration]
# supabase/config.toml (append to existing file)

[functions.verify-quiz-access]
verify_jwt = false

[functions.start-quiz-session]
verify_jwt = false

[functions.upsert-session-answer]
verify_jwt = false

[functions.submit-quiz-answers]
verify_jwt = false

[functions.get-quiz-result]
verify_jwt = false

# create-quiz-access: omitted → defaults to verify_jwt = true (owner must be authenticated)
```

### Pattern 9: supabase.functions.invoke from Vue Client

**What:** The Vue client calls Edge Functions through the existing `supabase` singleton. Guest EFs receive the custom `guestToken` in the request body (not the Authorization header).

**When to use:** `4-features/quiz-taking/model/useQuizTakingStore.ts` and `4-features/quiz-share/model/useQuizShareStore.ts`.

```typescript
// Source: [VERIFIED: supabase.com/docs/reference/javascript/functions-invoke]
// Guest EF call (no Authorization header needed — guestToken in body)
const { data, error } = await supabase.functions.invoke('verify-quiz-access', {
  body: { token, login, password },
})

// Owner EF call — supabase client already carries the owner's auth session
const { data, error } = await supabase.functions.invoke('create-quiz-access', {
  body: { quizId, label, expiresAt },
})
// Authorization header is automatically included by the supabase-js client
// because the owner is authenticated
```

### Anti-Patterns to Avoid

- **Decrement-style timer:** Never `timeRemaining--` in `setInterval`. Always compute from `(started_at + time_limit_sec) - Date.now()`. [CITED: PITFALLS.md §3.1]
- **Answers accumulated to submit-only:** Always upsert each answer immediately via EF. [CITED: PITFALLS.md §3.2]
- **Double-click creating two sessions:** The UNIQUE partial index `ON quiz_sessions(quiz_access_id) WHERE finished_at IS NULL` prevents this at DB level. Also disable "Начать" button during EF call. [CITED: PITFALLS.md §3.3]
- **Exposing `is_correct` to guest:** All answer fetching for guests uses `answer_options_public` view (no `is_correct`). Only `submit-quiz-answers` EF reads `is_correct` via service_role. [CITED: PITFALLS.md §3.4]
- **Direct anon writes to `quiz_sessions`/`session_answers`:** These tables have no anon RLS policies. All writes must go through EFs with service_role key. [CITED: ARCHITECTURE.md]
- **`password_hash` in any client-bound response:** `verify-quiz-access` selects `password_hash` for comparison but never includes it in the response body. [CITED: PITFALLS.md §1.4]
- **Using `window.confirm` for "Стоп" dialog:** Use the existing `Dialog.vue` PrimeVue dialog for consistent dark-theme styling. [CITED: CONTEXT.md D-06, CLAUDE.md]
- **Fat QuizSharePage:** Page component must stay under ~80 lines — mounts `QuizTakingWidget`, reads `sessionStatus`. All logic in the store and widgets. [CITED: PITFALLS.md §4.3]
- **Feature-to-feature import (`quiz-taking` ↔ `quiz-share`):** These are separate FSD slices. They must not import each other. [CITED: PITFALLS.md §4.2]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom SHA-256 or MD5 | `npm:bcryptjs@2` in Edge Function | bcrypt is adaptive (cost factor), resistant to GPU attacks; hand-rolled hashing is almost always broken |
| JWT sign + verify | Custom base64 + HMAC | `npm:jose@5` SignJWT + jwtVerify | jose handles edge cases, algorithm confusion attacks, expiry; 25M downloads/week |
| Timer from server time | Client-side `Date.now()` drift tracking | `(started_at + time_limit_sec) - Date.now()` on every tick | Client clock skew is real; only server `started_at` is authoritative |
| CORS headers | Custom per-response headers | `_shared/cors.ts` constant (or `import { corsHeaders } from '@supabase/supabase-js/cors'`) | Consistent headers across all EFs; `@supabase/supabase-js` v2.95.0+ exports them |
| Access token generation | Insecure `Math.random()` | `crypto.randomUUID()` for token; `nanoid` or `crypto.getRandomValues` for login/password | Cryptographically secure; UUID v4 = 122 bits entropy |
| Supabase TypeScript types | Manual interface update | `supabase gen types typescript --local` after migration | Migration 009 changes `quiz_sessions.score` column type; generated types must be regenerated |

**Key insight:** The most dangerous hand-roll in Phase 2 is the timer. Every quiz SaaS that uses `setInterval` with a decrementing counter ends up with 5-minute exam sessions that actually last 4:47 due to background tab throttling. The fix (compute from wall clock and server timestamp) is simple once the problem is understood.

---

## Common Pitfalls

### Pitfall 1: Timer Drift from Background Tab Throttling

**What goes wrong:** The quiz timer shows 5:00 remaining. The guest switches tabs to check their notes. Chrome throttles background `setInterval` to once per minute. When the guest returns, the timer shows 4:00 but actually 3 minutes elapsed. The quiz auto-submits 2 minutes before the server deadline, creating a confusing experience.

**Why it happens:** Storing `timeRemainingSeconds` as a decrement-per-tick value disconnects the timer from reality whenever the browser throttles timers.

**How to avoid:**
- Compute `timeRemainingSeconds = Math.max(0, Math.floor(((new Date(startedAt).getTime() + timeLimitSec * 1000) - Date.now()) / 1000))` on every tick AND on `visibilitychange`.
- Server-side: `submit-quiz-answers` EF ignores client-reported "time expired"; it computes `finished_at` server-side and may reject submission if `started_at + time_limit_sec < NOW()` (or just accept and score anyway — both are valid).

**Warning signs:** Timer jumps backward when returning to tab. Timer reaches 0 before server deadline.

[CITED: PITFALLS.md §3.1]

---

### Pitfall 2: Answer Loss on Page Refresh

**What goes wrong:** Guest is on question 7 of 10. Browser crashes. They reopen `/q/:token`. Questions 1–6's answers are gone because they were only in Vue reactive state, never persisted to `session_answers`.

**Why it happens:** Store accumulates answers locally and sends them only on final submit.

**How to avoid:**
- `selectAnswer()` store action must call `upsert-session-answer` EF immediately.
- On `init()`, if `guestToken` + `sessionId` are in `sessionStorage`, call `get-quiz-result` or a dedicated `get-session-answers` endpoint to restore existing answers.
- UPSERT key: `(session_id, question_id)` — duplicate selections update, not insert.

**Warning signs:** `session_answers` table is empty until the final submit event.

[CITED: PITFALLS.md §3.2]

---

### Pitfall 3: Duplicate Session Creation on Double-Click or Re-Mount

**What goes wrong:** Guest clicks "Начать" twice quickly. Two `quiz_sessions` rows are created for the same `quiz_access_id`. Scoring and result retrieval are now ambiguous.

**Why it happens:** No unique constraint prevents concurrent inserts; no button disable on first click.

**How to avoid:**
- Migration 009: `CREATE UNIQUE INDEX ON quiz_sessions (quiz_access_id) WHERE finished_at IS NULL` — DB-level prevention.
- Store: set `isStarting = true` before the EF call; re-enable only on error or success.
- `start-quiz-session` EF: check for existing open session first and return it (D-04 resume).

**Warning signs:** `quiz_sessions` has two rows with the same `quiz_access_id` and `finished_at IS NULL`.

[CITED: PITFALLS.md §3.3]

---

### Pitfall 4: `is_correct` and `password_hash` Reaching the Guest Client

**What goes wrong:** Developer queries `answer_options` directly (not the `answer_options_public` view) in `verify-quiz-access`. The `is_correct` field is in the response body. Guest sees correct answers before submitting.

OR: `password_hash` is included in the `verify-quiz-access` response and logged by Vue DevTools.

**Why it happens:** The service_role client bypasses RLS — it can read everything. The EF developer must manually exclude sensitive columns.

**How to avoid:**
- `verify-quiz-access` fetches: `questions(*, answer_options_public(*))` — using the view, not the table.
- Never include `password_hash`, `is_correct` in any EF response JSON.
- Type safety: define a `GuestQuizData` TypeScript interface for EF responses that literally cannot contain `is_correct`.

**Warning signs:** Guest browser DevTools Network tab shows `is_correct` in the response body.

[CITED: PITFALLS.md §1.4 + §3.4 + ARCHITECTURE.md]

---

### Pitfall 5: SUPABASE_JWT_SECRET Mismatch Between Local and Production

**What goes wrong:** Local dev uses a different JWT secret than production. Guest tokens signed locally are rejected by production EFs and vice versa. Also: after Supabase's JWT signing key rotation, the legacy HS256 secret may no longer be available as `SUPABASE_JWT_SECRET`.

**Why it happens:** The JWT signing key transition from legacy HS256 to asymmetric keys (announced in Supabase changelog) means `SUPABASE_JWT_SECRET` is only available for projects still on legacy keys.

**How to avoid:**
- For the custom guest token, the secret does NOT have to be the Supabase JWT secret. It can be a separate `GUEST_JWT_SECRET` stored as a Supabase Function Secret (Dashboard → Edge Functions → Secrets). This decouples guest tokens from Supabase's key rotation.
- Set `GUEST_JWT_SECRET` in both `supabase/functions/.env` (local) and Supabase Dashboard secrets (production).
- If using `SUPABASE_JWT_SECRET`: verify it is available by adding a startup log. If not, fall back to `GUEST_JWT_SECRET`.

**Warning signs:** `jwtVerify` throws in production but not locally. EF logs show "SUPABASE_JWT_SECRET not set".

[ASSUMED — based on Supabase's JWT signing key transition documentation]

---

### Pitfall 6: D-19 Edge Case — Quiz With No Questions

**What goes wrong:** An owner creates an access link and shares it before adding questions. The guest opens `/q/:token`, logs in, and `verify-quiz-access` returns an empty `questions` array. The taking screen renders nothing. No graceful error.

**Why it happens:** EF does not validate `questions.length > 0` before issuing the guest token.

**How to avoid:**
- `verify-quiz-access`: if `questions.length === 0`, return HTTP 200 with `{ state: 'not_ready', message: 'Тест пока не готов' }` — not an error (the link is valid; the quiz just has no content yet).
- `QuizSharePage`: handle `state === 'not_ready'` and render a friendly message rather than the login form.

**Warning signs:** Guest sees blank screen or JS error after successful login.

[CITED: CONTEXT.md D-19]

---

### Pitfall 7: `allow_retake` Default Not in Existing JSONB Rows

**What goes wrong:** Migration 009 adds `allow_retake` to the `quizzes.settings` JSONB default, but existing rows (created in Phase 1) don't have this key. `quiz.settings.allow_retake` is `undefined` at runtime. D-04 logic breaks.

**Why it happens:** PostgreSQL JSONB defaults only apply to new rows; existing rows are not backfilled automatically.

**How to avoid:**
- Migration 009 must include an UPDATE to backfill:
  ```sql
  UPDATE quizzes
  SET settings = settings || '{"allow_retake": false}'::jsonb
  WHERE settings->>'allow_retake' IS NULL;
  ```
- Update the `QuizSettings` TypeScript interface in `6-shared/types/index.ts` to include `allow_retake: boolean`.
- `useQuizEditorStore.settings` must be re-initialized with the new default.

**Warning signs:** `quiz.settings.allow_retake` is `undefined` for quizzes created in Phase 1. D-04 branching logic treats it as falsy (treating all quizzes as single-attempt).

[CITED: Phase 1 STATE.md + CONTEXT.md D-03]

---

## Code Examples

### verify-quiz-access — Full Edge Function

```typescript
// Source: [CITED: ARCHITECTURE.md Guest Auth Flow + CONTEXT.md D-01/D-19]
// supabase/functions/verify-quiz-access/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2'
import { signGuestToken } from '../_shared/jwt.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { token, login, password } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Fetch access record — service_role bypasses RLS
  const { data: access, error: accessErr } = await supabase
    .from('quiz_access')
    .select('id, quiz_id, password_hash, expires_at')
    .eq('token', token)
    .eq('login', login)
    .single()

  if (accessErr || !access) {
    return new Response(JSON.stringify({ error: 'Неверный логин или пароль' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (access.expires_at && new Date(access.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'Срок действия ссылки истёк' }), {
      status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const valid = await bcrypt.compare(password, access.password_hash)
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Неверный логин или пароль' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fetch quiz + questions + answer options WITHOUT is_correct
  const { data: quiz } = await supabase
    .from('quizzes')
    .select(`*, questions(*, answer_options_public(*))`)
    .eq('id', access.quiz_id)
    .single()

  // D-19: graceful no-questions state
  const questions = quiz?.questions ?? []
  if (questions.length === 0) {
    return Response.json({ state: 'not_ready' }, { headers: corsHeaders })
  }

  const guestToken = await signGuestToken({
    quiz_access_id: access.id,
    quiz_id: access.quiz_id,
  })

  return Response.json({
    state: 'ready',
    guestToken,
    quiz: { ...quiz, questions: undefined },  // quiz metadata only
    questions,
  }, { headers: corsHeaders })
})
```

### Migration 009: Phase 2 Schema Changes

```sql
-- Source: [CITED: CONTEXT.md D-17, D-18, D-03 + PITFALLS.md §3.3]
-- supabase/migrations/009_phase2_schema.sql

-- D-18: score column to numeric for partial-credit fractions
ALTER TABLE quiz_sessions ALTER COLUMN score TYPE numeric USING score::numeric;

-- D-03: add allow_retake to quizzes.settings
ALTER TABLE quizzes ALTER COLUMN settings SET DEFAULT
  '{"allow_back":true,"show_stop_button":true,"shuffle_questions":false,"shuffle_answers":false,"allow_retake":false}'::jsonb;

-- Backfill existing rows (Phase 1 quizzes don't have allow_retake)
UPDATE quizzes
SET settings = settings || '{"allow_retake":false}'::jsonb
WHERE settings->>'allow_retake' IS NULL;

-- PITFALL 3.3: Prevent duplicate active sessions per access link
CREATE UNIQUE INDEX ON quiz_sessions (quiz_access_id) WHERE finished_at IS NULL;

-- Owner RLS policies for quiz_sessions and session_answers (Phase 1 deferred)
CREATE POLICY "owner_read_sessions"
  ON quiz_sessions FOR SELECT TO authenticated
  USING (
    quiz_id IN (SELECT id FROM quizzes WHERE owner_id = (SELECT auth.uid()))
  );

CREATE POLICY "owner_read_session_answers"
  ON session_answers FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT qs.id FROM quiz_sessions qs
      JOIN quizzes qz ON qz.id = qs.quiz_id
      WHERE qz.owner_id = (SELECT auth.uid())
    )
  );
```

### TimerDisplay.vue — Red at 20% Threshold

```vue
<!-- Source: [CITED: CONTEXT.md D-05, ROADMAP SC#3] -->
<!-- 4-features/quiz-taking/ui/TimerDisplay.vue -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  timeRemainingSeconds: number
  timeLimitSec: number
}>()

const formatted = computed(() => {
  const m = Math.floor(props.timeRemainingSeconds / 60)
  const s = props.timeRemainingSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

// Timer turns red in final 20% of time
const isCritical = computed(() =>
  props.timeRemainingSeconds <= props.timeLimitSec * 0.2
)
</script>

<template>
  <div
    class="font-mono text-sm font-semibold tabular-nums transition-colors"
    :class="isCritical ? 'text-red-400' : 'text-neutral-300'"
  >
    {{ formatted }}
  </div>
</template>
```

### useQuizShareStore — Owner Access Link Management

```typescript
// Source: [CITED: ARCHITECTURE.md FSD Layer Mapping + CONTEXT.md D-13–D-16]
// 4-features/quiz-share/model/useQuizShareStore.ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { supabase } from '@shared/api/supabase'
import type { QuizAccess } from '@entities/quiz-access/model'

export const useQuizShareStore = defineStore('quiz-share', () => {
  const links = ref<QuizAccess[]>([])
  const isLoading = ref(false)
  const createdLink = ref<{ token: string; login: string; password: string } | null>(null)

  async function fetchLinks(quizId: string) {
    isLoading.value = true
    try {
      const { data, error } = await supabase
        .from('quiz_access')
        .select('id, token, login, label, expires_at')
        .eq('quiz_id', quizId)
        .order('created_at', { ascending: false })
      if (error) throw error
      links.value = data
    } catch {
      toast.error('Не удалось загрузить ссылки доступа')
    } finally {
      isLoading.value = false
    }
  }

  async function createLink(quizId: string, label: string, expiresAt?: string) {
    try {
      const { data, error } = await supabase.functions.invoke('create-quiz-access', {
        body: { quizId, label, expiresAt },
      })
      if (error) throw error
      // data = { token, login, password (plaintext, one-time) }
      createdLink.value = data
      await fetchLinks(quizId)  // refresh list
    } catch {
      toast.error('Не удалось создать ссылку доступа')
    }
  }

  async function deleteLink(linkId: string, quizId: string) {
    try {
      const { error } = await supabase.from('quiz_access').delete().eq('id', linkId)
      if (error) throw error
      await fetchLinks(quizId)
    } catch {
      toast.error('Не удалось удалить ссылку')
    }
  }

  return { links, isLoading, createdLink, fetchLinks, createLink, deleteLink }
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import { serve } from 'https://deno.land/std@.../http/server.ts'` | `Deno.serve(async (req) => ...)` | Deno 1.35+ (2023) | Old `serve` import still works but `Deno.serve` is idiomatic; no `import.meta` URL needed |
| `import bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'` | `import bcrypt from 'npm:bcryptjs@2'` | 2024 | `deno.land/x/` imports are deprecated in favor of `npm:` specifiers for npm packages |
| `export default { fetch: handler }` pattern | Both `Deno.serve()` and `export default { fetch }` are valid | 2024 | `export default { fetch }` works across Deno, Cloudflare Workers, Bun; pick one and stay consistent |
| Supabase legacy JWT secret (HS256 shared secret) | New asymmetric signing keys (ES256/RS256) | 2024–2025 | `SUPABASE_JWT_SECRET` may not be set on new projects; prefer a dedicated `GUEST_JWT_SECRET` |
| `@supabase/supabase-js` `import { corsHeaders } from '@supabase/supabase-js/cors'` | Available in v2.95.0+ | 2024 | Simpler than hand-crafting `_shared/cors.ts` if already on v2.95.0+ |

**Deprecated/outdated:**
- `deno.land/x/bcrypt`: use `npm:bcryptjs` instead [CITED: Supabase EF docs — `npm:` over `deno.land/x/`]
- `import { serve } from 'https://deno.land/std/http/server.ts'`: use `Deno.serve()` [CITED: Supabase EF quickstart]

---

## Runtime State Inventory

This is a feature-addition phase (not a rename/refactor), so the full inventory template does not apply. However, one runtime state consideration exists:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `quizzes.settings` JSONB in existing Phase 1 rows lacks `allow_retake` key | UPDATE backfill in migration 009 |
| Stored data | `quiz_sessions.score` column is `int` — must change to `numeric` | `ALTER COLUMN score TYPE numeric` in migration 009 |
| OS-registered state | None | — |
| Secrets/env vars | `GUEST_JWT_SECRET` (new) must be set in both local `.env` and Supabase Dashboard | Manual setup step — document in task |
| Build artifacts | `database.types.ts` will be stale after migration 009 | Regenerate: `supabase gen types typescript --local > src/6-shared/api/database.types.ts` |

---

## Environment Availability

| Dependency | Required By | Available | Notes | Fallback |
|------------|------------|-----------|-------|----------|
| Node.js v20 | Vite build + npm scripts | ✓ | v20.20.2 (Phase 1 verified) | — |
| npm | Package management | ✓ | v10.8.2 (Phase 1 verified) | — |
| Supabase CLI | `supabase functions serve`, `supabase db push` | ? | Not found in PATH at research time; in `devDependencies` as `supabase@^2.98.2` | Use `npx supabase` via devDep |
| Docker | `supabase start` (local DB + EF dev) | [ASSUMED] | Required for local EF testing | Without Docker: test EFs by deploying to Supabase cloud |
| Deno | Edge Function runtime | Not needed locally | EFs run inside Supabase CLI's Docker container | — |

**Supabase CLI via devDependency:** `supabase` is in `devDependencies` at v2.98.2. Commands should be run as `npx supabase functions serve` (or add `supabase` to npm scripts). Do not assume global install.

**Local EF dev commands:**
```bash
npx supabase functions serve verify-quiz-access --no-verify-jwt   # test individual function
npx supabase functions serve                                       # serve all functions
npx supabase functions deploy verify-quiz-access                   # deploy to production
```

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes — guest auth | `bcryptjs.compare` in Edge Function; cost factor 10 |
| V3 Session Management | yes — guest session | Short-lived JWT (1h) in `sessionStorage`; tab-close = session end |
| V4 Access Control | yes | service_role for all guest writes; owner RLS policies for session reads |
| V5 Input Validation | yes | Validate `{ token, login, password }` shape in EF; reject malformed JSON |
| V6 Cryptography | yes — password hashing | `bcryptjs` with cost 10 (never MD5, SHA-1, or plain storage) |

### Known Threat Patterns for Phase 2 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Brute-force on `verify-quiz-access` | Elevation of Privilege | bcrypt cost factor slows attempts; Supabase rate-limits Edge Function calls; return identical error message for "not found" and "wrong password" (timing attack prevention) |
| Token enumeration (`/q/:token` scan) | Information Disclosure | UUID v4 tokens (122 bits entropy) — 2^122 search space makes enumeration infeasible |
| Guest token replay after expiry | Spoofing | `jwtVerify` checks `exp` claim automatically; 1h TTL |
| Guest reads `is_correct` | Information Disclosure | `answer_options_public` view in all guest queries; column-level grant protection |
| Guest reads `password_hash` | Information Disclosure | EF response never includes `password_hash`; no anon RLS on `quiz_access` |
| Owner deletes another owner's access link | Elevation of Privilege | `supabase.from('quiz_access').delete()` uses authenticated owner session + existing RLS `owner_manage_quiz_access` policy |
| Session injection (forged `sessionId` in EF call) | Spoofing | All EFs verify `guestToken` first; then confirm `session.quiz_access_id === payload.quiz_access_id` before any write |
| Score manipulation (client-side) | Tampering | Scoring is entirely server-side in `submit-quiz-answers`; client never submits a score value |

---

## Open Questions (RESOLVED)

1. **`bcryptjs` vs alternative in Deno**
   - What we know: `bcryptjs` is pure JS and works in Deno npm compat; `bcrypt` needs native bindings (not supported)
   - What's unclear: Whether `npm:bcryptjs@2` has been tested against Supabase's specific Deno runtime version (Deno 1.x inside Supabase CLI v2.98.2)
   - Recommendation: Wave 1 task includes a verification step — write a stub EF that calls `bcrypt.hash('test', 10)` and confirm it returns a valid hash. Fallback: PBKDF2 via `crypto.subtle.deriveBits`.
   - **RESOLVED:** Verified by the `_probe-bcrypt` Wave-1 task in plan 02-01 (blocking human checkpoint); if the probe fails the executor switches all password hashing to the documented `crypto.subtle` PBKDF2 fallback.

2. **`SUPABASE_JWT_SECRET` availability on this project**
   - What we know: Supabase is migrating to asymmetric keys; legacy HS256 secret may not be set on new projects created after the migration
   - What's unclear: Whether this project (created during Phase 1 in 2026) has the legacy secret available
   - Recommendation: Use a project-specific `GUEST_JWT_SECRET` env var instead of `SUPABASE_JWT_SECRET`. Add it to `supabase/functions/.env` and Supabase Dashboard before any EF development begins.
   - **RESOLVED:** Use a dedicated `GUEST_JWT_SECRET` env var; `_shared/jwt.ts` reads it exclusively and never touches `SUPABASE_JWT_SECRET` (plan 02-01).

3. **`answer_options_public` view — SECURITY DEFINER status**
   - What we know: Migration 003 created `answer_options_public` as a plain view (no `SECURITY DEFINER`); `supabase functions` query via `service_role` client can read it
   - What's unclear: Whether `service_role` can JOIN through the view or must query the base table directly
   - Recommendation: In EFs that need `is_correct` (scoring), query `answer_options` base table directly (service_role sees all). In guest-facing EFs, query via `answer_options_public` as a safety net even though service_role could bypass it — defense in depth.
   - **RESOLVED:** The scoring EF (`submit-quiz-answers`, plan 02-05) queries the `answer_options` base table directly via service_role; guest-facing EFs query the `answer_options_public` view.

4. **Score display format for fractional scores (D-18)**
   - What we know: D-18 says "X.X из N"; D-17 says total = sum of per-question fractions (0…N)
   - What's unclear: Should "X.X" always show one decimal, or only when the score is fractional (e.g., show "8 из 10" not "8.0 из 10")? 
   - Recommendation: Claude's discretion — show `score % 1 === 0 ? score.toFixed(0) : score.toFixed(1)` for clean formatting.
   - **RESOLVED:** Score is stored and handled as `numeric` per D-18; the result page renders `Number.isInteger(score) ? score : score.toFixed(1)` (plan 02-05).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `npm:bcryptjs@2` works in Supabase Edge Functions' Deno runtime without native binding errors | Standard Stack, Pattern 3 | Medium — if wrong, switch to `crypto.subtle` PBKDF2. Verify in Wave 1 stub task. |
| A2 | A dedicated `GUEST_JWT_SECRET` env var (not `SUPABASE_JWT_SECRET`) should be used for guest tokens | Pattern 2, Pitfall 5 | Low — using a separate secret is strictly safer; if `SUPABASE_JWT_SECRET` is available it also works |
| A3 | `Deno.serve()` is the current standard handler pattern for Supabase EFs (vs `export default { fetch }`) | Pattern 1 | Low — both patterns are confirmed supported; `Deno.serve` is shown in Supabase quickstart |
| A4 | Delete access link operation uses the authenticated Supabase client directly (owner RLS) without a dedicated EF | `useQuizShareStore` | Low — existing `owner_manage_quiz_access` RLS policy covers DELETE; no EF needed |
| A5 | `supabase` CLI is available via `npx supabase` using the devDependency | Environment Availability | Low — would fail immediately and require global install |

---

## Sources

### Primary (HIGH confidence)
- `supabase.com/docs/guides/functions/function-configuration` — `verify_jwt` config, per-function `config.toml` syntax [VERIFIED]
- `supabase.com/docs/guides/functions/secrets` — `SUPABASE_SERVICE_ROLE_KEY` availability, `supabase/functions/.env` local dev [VERIFIED]
- `supabase.com/docs/guides/functions/cors` — exact CORS headers pattern, `_shared/cors.ts` [VERIFIED]
- `docs.deno.com/examples/creating_and_verifying_jwt/` — `npm:jose@5` SignJWT + jwtVerify with HS256 [VERIFIED]
- `supabase.com/blog/introducing-supabase-server` — `export default { fetch }` vs `Deno.serve()` equivalence [VERIFIED]
- `.planning/research/ARCHITECTURE.md` — FSD layer mapping, guest auth flow, component hierarchy, RLS design [HIGH — authored 2026-05-16 from official docs]
- `.planning/research/PITFALLS.md` — Phase 2 pitfall catalogue (timer drift, answer loss, session duplicate, is_correct exposure) [HIGH]
- `.planning/phases/02-quiz-taking-sharing/02-CONTEXT.md` — locked decisions D-01 through D-19 [authoritative]
- Existing migrations `004_quiz_access.sql`, `005_sessions.sql`, `007_rls_policies.sql` — confirmed schema [VERIFIED: codebase]
- `package.json` — confirmed installed versions of all Phase 1 libraries [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `supabase.com/docs/guides/functions/quickstart` — function creation, `supabase functions serve`, deploy commands [VERIFIED]
- `supabase.com/docs/guides/functions/auth` — `verify_jwt` flag behavior, automatically injected env vars [VERIFIED]
- `supabase.com/docs/guides/functions/dependencies` — `npm:` and `jsr:` import patterns, `deno.json` per-function config [VERIFIED]
- `supabase.com/docs/reference/javascript/functions-invoke` — client-side invocation pattern [VERIFIED]
- `supabase.com/docs/guides/auth/jwts` — JWT structure, claim fields, role claim [VERIFIED]

### Tertiary (LOW confidence)
- Training knowledge on `bcryptjs` npm compatibility with Deno — tagged [ASSUMED]; verify in Wave 1

---

## Metadata

**Confidence breakdown:**
- Edge Function structure and config: HIGH — verified against official Supabase docs
- JWT sign/verify pattern: HIGH — verified against official Deno examples with jose
- bcryptjs in Deno: MEDIUM (ASSUMED) — known pattern, not verified against Supabase's specific Deno version
- Timer pattern: HIGH — cited from PITFALLS.md (HIGH confidence, from official sources)
- Scoring formula: HIGH — directly from locked decision D-17 in CONTEXT.md
- Migration changes: HIGH — straightforward SQL verified from PostgreSQL docs + D-18 spec

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (Supabase EF API stable; jose and bcryptjs stable; no breaking changes expected in 30 days)
