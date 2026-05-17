# Phase 2: Quiz Taking & Sharing - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 32 new/modified files
**Analogs found:** 24 / 32 (8 are Edge Function files — greenfield, no codebase analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/009_phase2_schema.sql` | migration | batch | `supabase/migrations/005_sessions.sql` | role-match |
| `supabase/config.toml` (modify) | config | — | existing `supabase/config.toml` | exact |
| `supabase/functions/_shared/cors.ts` | utility | request-response | none — greenfield EF | no analog |
| `supabase/functions/_shared/jwt.ts` | utility | request-response | none — greenfield EF | no analog |
| `supabase/functions/verify-quiz-access/index.ts` | service | request-response | none — greenfield EF | no analog |
| `supabase/functions/start-quiz-session/index.ts` | service | request-response | none — greenfield EF | no analog |
| `supabase/functions/upsert-session-answer/index.ts` | service | request-response | none — greenfield EF | no analog |
| `supabase/functions/submit-quiz-answers/index.ts` | service | request-response | none — greenfield EF | no analog |
| `supabase/functions/get-quiz-result/index.ts` | service | request-response | none — greenfield EF | no analog |
| `supabase/functions/create-quiz-access/index.ts` | service | request-response | none — greenfield EF | no analog |
| `src/1-app/router/index.ts` (modify) | config | request-response | `src/1-app/router/index.ts` | exact |
| `src/6-shared/types/index.ts` (modify) | model | — | `src/6-shared/types/index.ts` | exact |
| `src/6-shared/ui/ProgressBar.vue` | component | transform | `src/6-shared/ui/Button.vue` | partial |
| `src/6-shared/ui/TimerDisplay.vue` | component | event-driven | `src/6-shared/ui/Button.vue` | partial |
| `src/5-entities/quiz-access/model.ts` | model | — | `src/5-entities/quiz/model.ts` | exact |
| `src/5-entities/quiz-access/api.ts` | service | CRUD | `src/5-entities/answer-option/api.ts` | exact |
| `src/5-entities/quiz-session/model.ts` | model | — | `src/5-entities/quiz/model.ts` | exact |
| `src/5-entities/quiz-session/api.ts` | service | CRUD | `src/5-entities/answer-option/api.ts` | role-match |
| `src/4-features/quiz-taking/model/useQuizTakingStore.ts` | store | event-driven | `src/4-features/quiz-editor/model/useQuizEditorStore.ts` | role-match |
| `src/4-features/quiz-taking/ui/GuestLoginForm.vue` | component | request-response | `src/4-features/auth/ui/LoginForm.vue` | exact |
| `src/4-features/quiz-taking/ui/QuizIntroScreen.vue` | component | request-response | `src/4-features/auth/ui/LoginForm.vue` | partial |
| `src/4-features/quiz-taking/ui/QuestionTaker.vue` | component | event-driven | `src/4-features/quiz-editor/ui/AnswerOptionEditor.vue` | role-match |
| `src/4-features/quiz-taking/ui/NavigationControls.vue` | component | event-driven | `src/4-features/quiz-editor/ui/NavigationSettings.vue` | partial |
| `src/4-features/quiz-share/model/useQuizShareStore.ts` | store | CRUD | `src/4-features/quiz-editor/model/useQuizEditorStore.ts` | role-match |
| `src/4-features/quiz-share/ui/AccessLinkForm.vue` | component | request-response | `src/4-features/auth/ui/LoginForm.vue` | role-match |
| `src/4-features/quiz-share/ui/AccessLinkCreated.vue` | component | transform | `src/4-features/quiz-list/ui/EmptyState.vue` | partial |
| `src/4-features/quiz-share/ui/AccessLinkList.vue` | component | CRUD | `src/5-entities/quiz/ui/QuizCard.vue` | partial |
| `src/4-features/quiz-editor/ui/NavigationSettings.vue` (modify) | component | event-driven | `src/4-features/quiz-editor/ui/NavigationSettings.vue` | exact |
| `src/3-widgets/QuizTakingWidget.vue` | component | event-driven | `src/3-widgets/QuizEditorWidget.vue` | exact |
| `src/3-widgets/QuizTakingHeader.vue` | component | event-driven | `src/3-widgets/QuizEditorHeader.vue` | role-match |
| `src/3-widgets/AccessLinksModal.vue` | component | CRUD | `src/4-features/quiz-list/ui/DeleteQuizDialog.vue` | role-match |
| `src/2-pages/QuizSharePage.vue` | page | request-response | `src/2-pages/QuizEditorPage.vue` | exact |
| `src/2-pages/QuizResultPage.vue` | page | request-response | `src/2-pages/QuizListPage.vue` | role-match |

---

## Pattern Assignments

---

### `supabase/migrations/009_phase2_schema.sql` (migration, batch)

**Analog:** `supabase/migrations/005_sessions.sql`

**Core migration pattern** (005_sessions.sql lines 1–29):
```sql
-- Header comment: migration number + description
-- ALTER existing table (score int → numeric), no DROP
ALTER TABLE quiz_sessions ALTER COLUMN score TYPE numeric;

-- Add allow_retake default to JSONB settings via UPDATE (not column ALTER)
UPDATE quizzes
  SET settings = settings || '{"allow_retake": false}'::jsonb
  WHERE settings IS NOT NULL;

-- UNIQUE partial index to prevent duplicate active sessions (D-18, Pitfall 3)
CREATE UNIQUE INDEX ON quiz_sessions (quiz_access_id) WHERE finished_at IS NULL;
```

**Column-level grants pattern** (from 007_rls_policies.sql — reference intent):
```sql
-- Revoke sensitive columns from anon role (never let is_correct or password_hash reach guest)
REVOKE SELECT (is_correct) ON answer_options FROM anon;
REVOKE SELECT (password_hash) ON quiz_access FROM anon;
```

---

### `supabase/config.toml` (modify, config)

**Analog:** existing `supabase/config.toml` (lines 1–30 read above)

**Append pattern** (from RESEARCH.md Pattern 8):
```toml
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

# create-quiz-access: omit → defaults to verify_jwt = true (owner JWT required)
```

---

### `supabase/functions/_shared/cors.ts` (utility, request-response)

**Analog:** none — greenfield. Source patterns from RESEARCH.md.

**CORS constant pattern** (RESEARCH.md Pattern 1):
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

---

### `supabase/functions/_shared/jwt.ts` (utility, request-response)

**Analog:** none — greenfield. Source patterns from RESEARCH.md Pattern 2.

**Full JWT helper pattern** (RESEARCH.md Pattern 2, lines 430–462):
```typescript
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

export async function signGuestToken(
  payload: Omit<GuestTokenPayload, 'iat' | 'exp'>
): Promise<string> {
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

---

### `supabase/functions/verify-quiz-access/index.ts` (service, request-response)

**Analog:** none — greenfield. Source from RESEARCH.md Pattern 1 (Deno.serve skeleton) + Pattern 3 (bcryptjs).

**Full EF structure** (RESEARCH.md Pattern 1, lines 357–420):
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2'
import { signGuestToken } from '../_shared/jwt.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { token, login, password } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    // SELECT quiz_access (never expose password_hash in response)
    // bcrypt.compare(password, access.password_hash)
    // check expires_at
    // check quiz has questions (D-19)
    // SELECT quiz + questions using answer_options_public view (not table)
    // signGuestToken({ quiz_access_id, quiz_id })
    return Response.json({ guestToken, quiz, questions, answerOptions }, { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**bcrypt pattern** (RESEARCH.md Pattern 3):
```typescript
import bcrypt from 'npm:bcryptjs@2'
const valid = await bcrypt.compare(candidatePassword, access.password_hash)
if (!valid) return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
  status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})
```

---

### `supabase/functions/start-quiz-session/index.ts` (service, request-response)

**Analog:** none — greenfield. This is the fully worked example in RESEARCH.md Pattern 1 (lines 357–420).

**Complete verified pattern** (RESEARCH.md Pattern 1 — copy verbatim):
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyGuestToken } from '../_shared/jwt.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { guestToken } = await req.json()
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
    // D-04: check for existing open session first
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
    return Response.json(
      { sessionId: session.id, started_at: session.started_at, resumed: false },
      { headers: corsHeaders }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

---

### `supabase/functions/upsert-session-answer/index.ts` (service, request-response)

**Analog:** none — greenfield. Same Deno.serve skeleton + verifyGuestToken + service_role client.

**Core upsert pattern** (RESEARCH.md Pattern 5 — EF side):
```typescript
// After verifyGuestToken check (same shell as start-quiz-session):
const { sessionId, questionId, selectedOptionIds } = await req.json()
// ...verify guestToken...
const { error } = await supabase
  .from('session_answers')
  .upsert(
    { session_id: sessionId, question_id: questionId, selected_option_ids: selectedOptionIds },
    { onConflict: 'session_id,question_id' }
  )
if (error) throw error
return Response.json({ ok: true }, { headers: corsHeaders })
```

---

### `supabase/functions/submit-quiz-answers/index.ts` (service, request-response)

**Analog:** none — greenfield. Same skeleton + partial-credit scoring formula from RESEARCH.md Pattern 6.

**Scoring formula** (RESEARCH.md Pattern 6, lines 584–612):
```typescript
function scoreQuestion(q: {
  correct_option_ids: string[]
  selected_option_ids: string[]
}): number {
  const totalCorrect = q.correct_option_ids.length
  if (totalCorrect === 0) return 0
  const correctSelected = q.selected_option_ids.filter(id =>
    q.correct_option_ids.includes(id)
  ).length
  const incorrectSelected = q.selected_option_ids.filter(id =>
    !q.correct_option_ids.includes(id)
  ).length
  return Math.max(0, (correctSelected - incorrectSelected) / totalCorrect)
}
// Then: service_role UPDATE quiz_sessions SET finished_at=NOW(), score=totalScore
// is_correct read via service_role — NEVER from answer_options_public view
```

---

### `supabase/functions/get-quiz-result/index.ts` (service, request-response)

**Analog:** none — greenfield. Same Deno.serve skeleton + verifyGuestToken.

**Core pattern:** After verifying guestToken, service_role SELECT quiz_sessions WHERE id = sessionId AND finished_at IS NOT NULL. Return `{ score, totalQuestions, label }`. Never return `is_correct` or `password_hash`.

---

### `supabase/functions/create-quiz-access/index.ts` (service, request-response)

**Analog:** none — greenfield. This EF uses `verify_jwt = true` (owner-authenticated), so it reads `req.headers.get('Authorization')` or lets Supabase validate automatically.

**Owner EF pattern** (RESEARCH.md architecture diagram, lines 271–288):
```typescript
// verify_jwt = true → Supabase validates Authorization header automatically
// Then verify owner owns the quiz:
const { data: { user } } = await supabase.auth.getUser(
  req.headers.get('Authorization')!.replace('Bearer ', '')
)
// generate login = crypto.randomUUID().slice(0, 8)
// generate password (16 chars via crypto.getRandomValues)
// const passwordHash = await bcrypt.hash(password, 10)
// INSERT quiz_access — return { token, login, password } (plaintext password ONCE)
// Never store or re-return the plaintext password
```

---

### `src/1-app/router/index.ts` (modify, config, request-response)

**Analog:** `src/1-app/router/index.ts` (full file read above, lines 1–23)

**Existing route pattern** (lines 1–23) — add two public routes, no guard needed:
```typescript
// Existing routes (lines 8–13):
routes: [
  { path: '/',           component: () => import('@pages/QuizListPage.vue') },
  { path: '/auth',       component: () => import('@pages/AuthPage.vue') },
  { path: '/my',         component: () => import('@pages/MyQuizListPage.vue') },
  { path: '/editor/:id', component: () => import('@pages/QuizEditorPage.vue') },
  // ADD (public routes — no auth guard needed, no entry in PROTECTED_ROUTES):
  { path: '/q/:token',         component: () => import('@pages/QuizSharePage.vue') },
  { path: '/q/:token/result',  component: () => import('@pages/QuizResultPage.vue') },
]
// PROTECTED_ROUTES (line 4) stays unchanged — /q/ routes are explicitly excluded
```

---

### `src/6-shared/types/index.ts` (modify, model)

**Analog:** `src/6-shared/types/index.ts` (full file read, lines 1–8)

**Existing interface pattern** (lines 1–8) — extend `QuizSettings`:
```typescript
// Current (lines 3–8):
export interface QuizSettings {
  allow_back:        boolean
  show_stop_button:  boolean
  shuffle_questions: boolean
  shuffle_answers:   boolean
  // ADD per D-03:
  allow_retake:      boolean
}
```

---

### `src/6-shared/ui/ProgressBar.vue` (component, transform)

**Analog:** `src/6-shared/ui/Button.vue` — shared UI component structure (script setup + props + template).

**Component pattern** — single-responsibility shared UI:
```vue
<script setup lang="ts">
defineProps<{
  value: number   // 0–100 percent
}>()
</script>
<template>
  <!-- UI-SPEC: h-1 track bg-neutral-800 / fill bg-orange-500 / transition-all duration-300 -->
  <div class="w-full h-1 rounded-full bg-neutral-800">
    <div
      class="h-1 rounded-full bg-orange-500 transition-all duration-300"
      :style="{ width: `${value}%` }"
    />
  </div>
</template>
```

---

### `src/6-shared/ui/TimerDisplay.vue` (component, event-driven)

**Analog:** `src/6-shared/ui/Button.vue` — shared UI component, no store dependency.

**Component pattern** — pure display, reactive prop, no store:
```vue
<script setup lang="ts">
import { Clock } from 'lucide-vue-next'
defineProps<{
  seconds: number        // remaining seconds, computed by store
  isAlert: boolean       // true when ≤20% remaining (store.isTimerCritical)
}>()
// Format MM:SS here — not in store; display concern only
function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
</script>
<template>
  <!-- UI-SPEC: pill bg-neutral-800 rounded-full px-3 py-1, tabular-nums -->
  <!-- Normal: text-neutral-400 / Alert: text-red-500 font-semibold -->
  <div class="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1"
       :class="isAlert ? 'text-red-500' : 'text-neutral-400'">
    <Clock class="h-4 w-4" />
    <span class="tabular-nums text-base" :class="{ 'font-semibold': isAlert }">
      {{ formatTime(seconds) }}
    </span>
  </div>
</template>
```

---

### `src/5-entities/quiz-access/model.ts` (model)

**Analog:** `src/5-entities/quiz/model.ts` (lines 1–14)

**Interface pattern** (quiz/model.ts lines 1–14):
```typescript
// quiz/model.ts pattern — plain interface, no logic, types from DB schema
export interface QuizAccess {
  id:            string
  quiz_id:       string
  token:         string
  login:         string
  // password_hash is NEVER in this interface — never fetched by client
  label:         string
  expires_at:    string | null
}
```

---

### `src/5-entities/quiz-access/api.ts` (service, CRUD)

**Analog:** `src/5-entities/answer-option/api.ts` (full file, lines 1–39)

**Imports + fetch + delete pattern** (answer-option/api.ts lines 1–39):
```typescript
import { supabase } from '@shared/api/supabase'
import type { QuizAccess } from './model'

// Owner-authenticated fetch (RLS: owner sees their own quiz_access rows)
export async function fetchAccessLinks(quizId: string): Promise<QuizAccess[]> {
  const { data, error } = await supabase
    .from('quiz_access')
    .select('id, quiz_id, token, login, label, expires_at')  // no password_hash
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as QuizAccess[]
}

export async function deleteAccessLink(id: string): Promise<void> {
  const { error } = await supabase.from('quiz_access').delete().eq('id', id)
  if (error) throw error
}
// Note: createAccessLink is via Edge Function (create-quiz-access), not direct Supabase insert
```

---

### `src/5-entities/quiz-session/model.ts` (model)

**Analog:** `src/5-entities/quiz/model.ts` (lines 1–14)

**Interface pattern**:
```typescript
export interface QuizSession {
  id:             string
  quiz_access_id: string
  quiz_id:        string
  started_at:     string   // ISO — server-authoritative for timer
  finished_at:    string | null
  score:          number | null  // numeric after migration 009
}

export interface SessionAnswer {
  id:                  string
  session_id:          string
  question_id:         string
  selected_option_ids: string[]
}

// Shape of data returned by get-quiz-result EF
export interface SessionResult {
  score:          number
  totalQuestions: number
  percentage:     number
  label:          string  // quiz_access.label (taker name)
}
```

---

### `src/5-entities/quiz-session/api.ts` (service, CRUD)

**Analog:** `src/5-entities/answer-option/api.ts` (lines 1–39)

**Pattern note:** All session WRITE operations go through Edge Functions (no direct Supabase client writes). This file contains only the `supabase.functions.invoke` wrappers — thin API layer.

```typescript
import { supabase } from '@shared/api/supabase'
// All writes via Edge Functions — no direct .from('quiz_sessions').insert()
// Thin invoke wrappers keep EF call signatures typed and centralized
export async function invokeVerifyAccess(token: string, login: string, password: string) {
  const { data, error } = await supabase.functions.invoke('verify-quiz-access', {
    body: { token, login, password },
  })
  if (error) throw error
  return data
}
// Pattern from RESEARCH.md Pattern 9 (lines 678–690):
// Guest EFs: guestToken in body. Owner EFs: supabase client carries auth header automatically.
```

---

### `src/4-features/quiz-taking/model/useQuizTakingStore.ts` (store, event-driven)

**Analog:** `src/4-features/quiz-editor/model/useQuizEditorStore.ts` (full file read, lines 1–328)

**Store structure pattern** (useQuizEditorStore.ts lines 38–47 — defineStore + ref pattern):
```typescript
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { supabase } from '@shared/api/supabase'
import { useRouter } from 'vue-router'
import type { Question } from '@entities/question/model'
// (+ entity model imports for quiz-session, quiz-access)

export const useQuizTakingStore = defineStore('quiz-taking', () => {
  // State refs
  const sessionStatus = ref<'idle' | 'intro' | 'active' | 'finished'>('idle')
  const guestToken = ref<string | null>(null)
  const sessionId = ref<string | null>(null)
  const quiz = ref<...>(null)
  const questions = ref<Question[]>([])
  const answers = ref<Record<string, string[]>>({})   // questionId → selectedOptionIds
  const currentQuestionIndex = ref(0)
  const isLoading = ref(false)
  // ...timer refs (see timer pattern below)
  return { sessionStatus, /* ... */ }
})
```

**Error handling pattern** (useQuizEditorStore.ts lines 52–63 — try/catch + toast.error):
```typescript
// All async operations:
try {
  const { data, error } = await supabase.functions.invoke('...', { body: { ... } })
  if (error) throw error
  // update state
} catch {
  toast.error('Ошибка соединения. Попробуйте снова.')
}
```

**Server-anchored timer pattern** (RESEARCH.md Pattern 4, lines 496–541):
```typescript
const startedAt = ref<string | null>(null)
const timeLimitSec = ref<number | null>(null)
const timeRemainingSeconds = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

function computeRemaining(): number {
  if (!startedAt.value || !timeLimitSec.value) return 0
  const deadline = new Date(startedAt.value).getTime() + timeLimitSec.value * 1000
  return Math.max(0, Math.floor((deadline - Date.now()) / 1000))
}

function startTimer() {
  if (!timeLimitSec.value) return  // D-09: no timer if null
  timeRemainingSeconds.value = computeRemaining()
  timerInterval = setInterval(() => {
    timeRemainingSeconds.value = computeRemaining()
    if (timeRemainingSeconds.value <= 0) {
      stopTimer()
      void finishSession()  // D-08 auto-submit
    }
  }, 1000)
  document.addEventListener('visibilitychange', onVisibilityChange)
}

const isTimerCritical = computed(() =>
  timeLimitSec.value ? timeRemainingSeconds.value <= timeLimitSec.value * 0.2 : false
)
```

**Immediate answer upsert pattern** (RESEARCH.md Pattern 5, lines 551–578):
```typescript
async function selectAnswer(questionId: string, optionId: string, type: 'single' | 'multiple') {
  // Optimistic local update first
  if (type === 'single') {
    answers.value[questionId] = [optionId]
  } else {
    const cur = answers.value[questionId] ?? []
    answers.value[questionId] = cur.includes(optionId)
      ? cur.filter(id => id !== optionId)
      : [...cur, optionId]
  }
  // Then persist immediately — never accumulate
  try {
    const { error } = await supabase.functions.invoke('upsert-session-answer', {
      body: { guestToken: guestToken.value, sessionId: sessionId.value,
              questionId, selectedOptionIds: answers.value[questionId] },
    })
    if (error) toast.error('Ошибка сохранения ответа. Проверьте соединение.')
  } catch {
    toast.error('Ошибка сохранения ответа. Проверьте соединение.')
  }
}
```

**Session resume / init pattern** (RESEARCH.md Pattern 7, lines 619–643):
```typescript
async function init(token: string) {
  const stored = sessionStorage.getItem(`qf_guest_${token}`)
  if (!stored) { sessionStatus.value = 'idle'; return }
  const { guestToken: gt, sessionId: sid } = JSON.parse(stored)
  // Call start-quiz-session EF — handles D-04 state machine
}
```

---

### `src/4-features/quiz-taking/ui/GuestLoginForm.vue` (component, request-response)

**Analog:** `src/4-features/auth/ui/LoginForm.vue` (full file, lines 1–77)

**Form + submit + loading pattern** (LoginForm.vue lines 1–76):
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Loader2 } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
import Input from '@shared/ui/Input.vue'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'

const store = useQuizTakingStore()
const login = ref('')
const password = ref('')
const isSubmitting = ref(false)

async function onStart() {
  if (!login.value || !password.value) return
  isSubmitting.value = true
  try {
    await store.verifyAccess(login.value, password.value)
  } catch {
    toast.error('Неверный логин или пароль.')
    // DO NOT clear fields on wrong credentials (UI-SPEC)
  } finally {
    isSubmitting.value = false
  }
}
</script>
```

**Input label pattern** (LoginForm.vue lines 39–54):
```vue
<!-- label text-sm text-neutral-400 mb-1, Input component full-width -->
<label class="block text-sm text-neutral-400 mb-1">Логин</label>
<Input v-model="login" type="text" autocomplete="username" class="w-full mb-4" />
<label class="block text-sm text-neutral-400 mb-1">Пароль</label>
<Input v-model="password" type="password" autocomplete="current-password" class="w-full mb-6" />
<!-- Button: orange default, full-width, loading state with Loader2 -->
<Button variant="default" class="w-full" :disabled="isSubmitting" @click="onStart">
  <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin mr-2" />
  Начать
</Button>
```

---

### `src/4-features/quiz-taking/ui/QuizIntroScreen.vue` (component, request-response)

**Analog:** `src/4-features/auth/ui/LoginForm.vue` — card + form assembly pattern.

**Card layout pattern** (UI-SPEC section 1):
```vue
<!-- Full page centered: min-h-screen flex flex-col items-center justify-center px-4 py-12 -->
<!-- Card: bg-neutral-900 rounded-2xl p-8 w-full max-w-md shadow-lg -->
<!-- Cover image (conditional): w-full aspect-video object-cover rounded-xl mb-6 -->
<!-- Quiz title: text-xl font-semibold text-neutral-50 mb-2 -->
<!-- Meta row (question count + time): text-sm text-neutral-400 -->
<!-- formatDuration from @shared/lib/format.ts for time display -->
<!-- Description (conditional): text-base text-neutral-400 mb-6 line-clamp-3 -->
<!-- Divider: border-t border-neutral-800 mb-6 -->
<!-- GuestLoginForm embedded below divider -->
```

---

### `src/4-features/quiz-taking/ui/QuestionTaker.vue` (component, event-driven)

**Analog:** `src/4-features/quiz-editor/ui/AnswerOptionEditor.vue` (full file, lines 1–73)

**Radio/checkbox indicator pattern** (AnswerOptionEditor.vue lines 38–56):
```vue
<!-- Single: rounded-full / Multiple: rounded (square) -->
<button
  type="button"
  class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border-2 transition-colors"
  :class="[
    type === 'single' ? 'rounded-full' : 'rounded',
    isSelected ? 'border-orange-500 bg-orange-500' : 'border-neutral-600 bg-neutral-900',
  ]"
  @click="onSelect"
>
  <span v-if="type === 'single' && isSelected" class="h-2 w-2 rounded-full bg-white" />
  <Check v-else-if="type === 'multiple' && isSelected" class="h-3 w-3 text-white" />
</button>
```

**Answer row pattern** (UI-SPEC section 2 — answer option row):
```vue
<!-- Row: min-h-[44px] flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors -->
<!-- Unselected: bg-neutral-800 border border-neutral-700 hover:border-neutral-600 -->
<!-- Selected:   bg-neutral-800 border border-orange-500 -->
<!-- Clicking row = select answer → store.selectAnswer(questionId, optionId, type) -->
```

---

### `src/4-features/quiz-taking/ui/NavigationControls.vue` (component, event-driven)

**Analog:** `src/4-features/quiz-editor/ui/NavigationSettings.vue` (lines 1–30)

**Button row pattern** (UI-SPEC section 2 — Navigation Footer):
```vue
<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
// Props: canGoBack, canGoForward, isLastQuestion, isRequired (blocks forward)
// Emits: back, forward, finish (opens confirm dialog)
</script>
<template>
  <!-- pt-4 flex items-center justify-between mt-auto -->
  <!-- "Назад": variant="outline" + ChevronLeft, disabled on first question or allow_back=false (absent entirely) -->
  <!-- "Вперёд": variant="outline" + ChevronRight, disabled when isRequired && no answer -->
  <!-- "Завершить" (last question only): variant="default" (orange) -->
</template>
```

---

### `src/4-features/quiz-share/model/useQuizShareStore.ts` (store, CRUD)

**Analog:** `src/4-features/quiz-editor/model/useQuizEditorStore.ts` (lines 38–328)

**Store + CRUD + toast pattern** (useQuizEditorStore.ts lines 52–63, 113–124, 144–155):
```typescript
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { supabase } from '@shared/api/supabase'
import { fetchAccessLinks, deleteAccessLink } from '@entities/quiz-access/api'
import type { QuizAccess } from '@entities/quiz-access/model'

export const useQuizShareStore = defineStore('quiz-share', () => {
  const links = ref<QuizAccess[]>([])
  const isLoading = ref(false)
  const isCreating = ref(false)
  const lastCreated = ref<{ token: string; login: string; password: string } | null>(null)

  async function loadLinks(quizId: string) {
    isLoading.value = true
    try {
      links.value = await fetchAccessLinks(quizId)
    } catch {
      toast.error('Не удалось загрузить ссылки. Проверьте соединение.')
    } finally {
      isLoading.value = false
    }
  }

  async function createLink(quizId: string, label: string, expiresAt?: string) {
    if (!label.trim()) { toast.error('Укажите имя тестируемого.'); return }
    isCreating.value = true
    try {
      const { data, error } = await supabase.functions.invoke('create-quiz-access', {
        body: { quizId, label, expiresAt },
      })
      if (error) throw error
      lastCreated.value = data   // { token, login, password } — plaintext password, shown once
      links.value.unshift({ ...data, label, quiz_id: quizId, expires_at: expiresAt ?? null })
      toast.success('Ссылка создана.')
    } catch {
      toast.error('Ошибка создания ссылки. Попробуйте снова.')
    } finally {
      isCreating.value = false
    }
  }

  async function removeLink(id: string) {
    try {
      await deleteAccessLink(id)
      links.value = links.value.filter(l => l.id !== id)
      toast.success('Ссылка удалена.')
    } catch {
      toast.error('Ошибка удаления ссылки.')
    }
  }

  return { links, isLoading, isCreating, lastCreated, loadLinks, createLink, removeLink }
})
```

---

### `src/4-features/quiz-share/ui/AccessLinkForm.vue` (component, request-response)

**Analog:** `src/4-features/auth/ui/LoginForm.vue` (lines 1–77)

**Form submit + loading pattern** (LoginForm.vue lines 25–33):
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Plus } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
import Input from '@shared/ui/Input.vue'
import { useQuizShareStore } from '@features/quiz-share/model/useQuizShareStore'

const props = defineProps<{ quizId: string }>()
const store = useQuizShareStore()
const label = ref('')
const expiresAt = ref('')

async function onCreate() {
  await store.createLink(props.quizId, label.value, expiresAt.value || undefined)
  label.value = ''
  expiresAt.value = ''
}
</script>
<!-- bg-neutral-800 rounded-xl p-4 mb-6 -->
<!-- Input type="text" placeholder="Например: Иван Иванов" for label -->
<!-- Input type="date" for expiresAt (color-scheme: dark via style attr) -->
<!-- Button variant="default" w-full + Plus icon -->
```

---

### `src/4-features/quiz-share/ui/AccessLinkCreated.vue` (component, transform)

**Analog:** `src/4-features/quiz-list/ui/EmptyState.vue` — informational block pattern.

**One-time credential reveal pattern** (UI-SPEC section 7):
```vue
<!-- bg-neutral-800 border border-orange-500 rounded-xl p-4 mb-6 -->
<!-- Heading "Данные для доступа": text-sm font-semibold text-neutral-50 mb-3 -->
<!-- Monospace text block (font-mono, text-sm text-neutral-300, leading-relaxed, select-all) -->
<!-- Password warning: text-sm text-amber-400 mt-2 -->
<!-- "Скопировать" Button variant="default" w-full mt-3 + Copy icon -->
<!-- After copy: button text → "Скопировано", revert after 2s (setTimeout + ref toggle) -->
```

---

### `src/4-features/quiz-share/ui/AccessLinkList.vue` (component, CRUD)

**Analog:** `src/5-entities/quiz/ui/QuizCard.vue` — list-item rendering pattern.

**List row + delete pattern** (UI-SPEC section 7):
```vue
<!-- flex flex-col gap-2 -->
<!-- Each row: bg-neutral-800 rounded-xl px-4 py-3 flex items-center gap-3 -->
<!--   label: text-base text-neutral-50 flex-1 truncate -->
<!--   login: text-sm text-neutral-400 shrink-0 (@{login}) -->
<!--   expires_at: text-sm text-neutral-400 ("до DD.MM.YYYY") or "Бессрочно" text-neutral-600 -->
<!--   delete: Button variant="ghost" size="icon" Trash2 text-neutral-500 hover:text-red-500 -->
<!--   aria-label="Удалить ссылку {label}" -->
<!-- Empty state: text-center py-8, Link2Off icon text-neutral-700, "Ссылки ещё не созданы" -->
<!-- Delete: store.removeLink(link.id) — immediate, no dialog (by design per UI-SPEC) -->
```

---

### `src/4-features/quiz-editor/ui/NavigationSettings.vue` (modify, component, event-driven)

**Analog:** `src/4-features/quiz-editor/ui/NavigationSettings.vue` (full file, lines 1–30)

**Extend with third toggle row** — exact pattern from existing rows (lines 14–23):
```vue
<!-- ADD after existing show_stop_button label (line 23): -->
<label class="flex items-center gap-3">
  <Switch
    :model-value="store.settings.allow_retake"
    @update:model-value="store.updateSettings({ allow_retake: $event })"
  />
  <span class="text-sm text-neutral-200">Разрешить повторное прохождение</span>
</label>
```

---

### `src/3-widgets/QuizTakingWidget.vue` (component, event-driven)

**Analog:** `src/3-widgets/QuizEditorWidget.vue` (full file, lines 1–41)

**100dvh grid layout pattern** (QuizEditorWidget.vue lines 31–41 — style block):
```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'
import QuizTakingHeader from './QuizTakingHeader.vue'
import QuizIntroScreen from '@features/quiz-taking/ui/QuizIntroScreen.vue'
import QuestionTaker from '@features/quiz-taking/ui/QuestionTaker.vue'
// ...

const route = useRoute()
const store = useQuizTakingStore()
onMounted(() => store.init(route.params.token as string))
onUnmounted(() => store.cleanup())
</script>

<template>
  <!-- sessionStatus === 'idle' → QuizIntroScreen (centered card) -->
  <!-- sessionStatus === 'active' → grid header + body (see layout below) -->
  <!-- sessionStatus === 'finished' → redirect handled by store -->
</template>

<style scoped>
/* Pattern from QuizEditorWidget.vue lines 31–41: */
.taking-layout {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100dvh;
  overflow: hidden;
}
.taking-body {
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
```

---

### `src/3-widgets/QuizTakingHeader.vue` (component, event-driven)

**Analog:** `src/3-widgets/QuizEditorHeader.vue` (full file, lines 1–28)

**Sticky header pattern** (QuizEditorHeader.vue lines 12–27):
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { StopCircle } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
import ProgressBar from '@shared/ui/ProgressBar.vue'
import TimerDisplay from '@shared/ui/TimerDisplay.vue'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'

const store = useQuizTakingStore()
</script>
<template>
  <!-- bg-neutral-900 border-b border-neutral-800 px-4 py-3 h-14 flex items-center gap-4 -->
  <!-- Left section (flex-1): "Вопрос X из Y" text-sm text-neutral-400 mb-1 + ProgressBar -->
  <!-- Right section (shrink-0 flex items-center gap-3): TimerDisplay (conditional) + Stop button -->
  <!-- Stop button: Button variant="ghost" size="sm" + StopCircle icon -->
</template>
```

---

### `src/3-widgets/AccessLinksModal.vue` (component, CRUD)

**Analog:** `src/4-features/quiz-list/ui/DeleteQuizDialog.vue` (full file, lines 1–55)

**Dialog pattern** (DeleteQuizDialog.vue lines 1–55 — radix-vue Dialog):
```vue
<script setup lang="ts">
import {
  DialogPortal, DialogOverlay, DialogContent, DialogTitle,
} from 'radix-vue'
import { X, Link } from 'lucide-vue-next'
import Dialog from '@shared/ui/Dialog.vue'
import Button from '@shared/ui/Button.vue'
import AccessLinkForm from '@features/quiz-share/ui/AccessLinkForm.vue'
import AccessLinkCreated from '@features/quiz-share/ui/AccessLinkCreated.vue'
import AccessLinkList from '@features/quiz-share/ui/AccessLinkList.vue'
import { useQuizShareStore } from '@features/quiz-share/model/useQuizShareStore'

defineProps<{ open: boolean; quizId: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <!-- DialogContent: bg-neutral-900 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col -->
      <!-- Positioned: fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 -->
      <DialogContent class="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[80vh] -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-2xl bg-neutral-900 p-6 shadow-lg">
        <div class="flex items-center justify-between mb-4">
          <DialogTitle class="text-xl font-semibold text-neutral-50">Ссылки доступа</DialogTitle>
          <Button variant="ghost" size="icon" @click="emit('update:open', false)">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="overflow-y-auto flex-1">
          <AccessLinkForm :quiz-id="quizId" />
          <AccessLinkCreated v-if="store.lastCreated" />
          <AccessLinkList />
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
```

---

### `src/2-pages/QuizSharePage.vue` (page, request-response)

**Analog:** `src/2-pages/QuizEditorPage.vue` (full file, lines 1–26)

**Thin page pattern** (QuizEditorPage.vue lines 1–26 — ~15 lines, no domain logic):
```vue
<script setup lang="ts">
import { useRoute } from 'vue-router'
import QuizTakingWidget from '@widgets/QuizTakingWidget.vue'

const route = useRoute()
// No AppHeader — guest-only surface (UI-SPEC: no AppHeader on guest screens)
// Widget reads token from route.params.token internally via useRoute
</script>

<template>
  <!-- No AppHeader (guest-only, focused exam flow) -->
  <QuizTakingWidget />
</template>
```

---

### `src/2-pages/QuizResultPage.vue` (page, request-response)

**Analog:** `src/2-pages/QuizListPage.vue` (full file, lines 1–57)

**Page + data display pattern** (QuizListPage.vue lines 1–20):
```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'

const route = useRoute()
const store = useQuizTakingStore()

onMounted(async () => {
  // If arriving by direct URL (not after submit), call get-quiz-result EF
  // store.result is set by finishSession() or loaded here
  if (!store.result) await store.loadResult(route.params.token as string)
})
</script>

<template>
  <!-- No AppHeader. min-h-screen flex flex-col items-center justify-center px-4 py-12 -->
  <!-- Card: bg-neutral-900 rounded-2xl p-8 w-full max-w-md text-center shadow-lg -->
  <!-- Score: text-[28px] font-semibold text-neutral-50 (D-18: Math.round percentage) -->
  <!-- Fraction: text-xl text-neutral-400 (Number.isInteger → no decimal) -->
  <!-- Taker name: text-base text-neutral-400 -->
  <!-- Neutral message + home link as Button variant="link" text-orange-500 -->
</template>
```

---

## Shared Patterns

### Supabase Client Singleton
**Source:** `src/6-shared/api/supabase.ts` (lines 1–5)
**Apply to:** All `src/5-entities/*/api.ts` files, all feature stores
```typescript
import { supabase } from '@shared/api/supabase'
// Guest EF calls: body carries guestToken. Owner calls: client carries auth header automatically.
```

### Error Handling + Toast
**Source:** `src/4-features/quiz-editor/model/useQuizEditorStore.ts` (lines 52–63)
**Apply to:** All store actions, all API functions
```typescript
// Every async operation:
try {
  // ... operation
} catch {
  toast.error('Ошибка соединения. Попробуйте снова.')
}
// On loading states: isLoading.value = true → finally { isLoading.value = false }
```

### Button Loading State
**Source:** `src/4-features/auth/ui/LoginForm.vue` (lines 68–73)
**Apply to:** GuestLoginForm, AccessLinkForm, StopConfirmDialog, QuizResultPage
```vue
<Button :disabled="isSubmitting" variant="default">
  <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin mr-2" />
  {{ isSubmitting ? 'Загрузка...' : 'Начать' }}
</Button>
```

### Pinia Store: defineStore + Composition API
**Source:** `src/4-features/quiz-editor/model/useQuizEditorStore.ts` (lines 38–47)
**Apply to:** `useQuizTakingStore`, `useQuizShareStore`
```typescript
export const useMyStore = defineStore('my-store', () => {
  const state = ref(...)
  async function action() { try { ... } catch { toast.error(...) } }
  return { state, action }
})
```

### radix-vue Dialog
**Source:** `src/4-features/quiz-list/ui/DeleteQuizDialog.vue` (lines 1–55)
**Apply to:** `AccessLinksModal.vue`, `StopConfirmDialog.vue` (stop confirmation)
```vue
import { DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription } from 'radix-vue'
import Dialog from '@shared/ui/Dialog.vue'
// Pattern: Dialog :open + @update:open emit + DialogPortal + DialogOverlay + DialogContent
```

### FSD Import Aliases
**Source:** `src/4-features/quiz-editor/model/useQuizEditorStore.ts` (lines 1–24)
**Apply to:** All new files
```typescript
import { ... } from '@entities/quiz/model'   // 5-entities
import { ... } from '@features/auth/...'      // 4-features
import { ... } from '@widgets/...'            // 3-widgets
import { ... } from '@shared/api/supabase'    // 6-shared
import { ... } from '@pages/...'              // 2-pages
// Feature → only imports from 5-entities and 6-shared (never feature-to-feature)
// Widget → can import from 4-features + 5-entities + 6-shared
```

### FSD Layer Rule Reminder
**Source:** CLAUDE.md
**Critical for Phase 2:**
- `quiz-taking` and `quiz-share` are SEPARATE feature slices — they must NOT import each other
- `AccessLinksModal` belongs in `3-widgets` (it composes `quiz-share` feature components)
- Pages stay ≤80 lines — all logic in stores and widgets

---

## No Analog Found

Files with no close match in the codebase (planner uses RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/functions/_shared/cors.ts` | utility | request-response | No Edge Functions exist yet — project's first |
| `supabase/functions/_shared/jwt.ts` | utility | request-response | No Edge Functions exist yet; no JWT helpers in codebase |
| `supabase/functions/verify-quiz-access/index.ts` | service | request-response | No Edge Functions exist yet |
| `supabase/functions/start-quiz-session/index.ts` | service | request-response | No Edge Functions exist yet |
| `supabase/functions/upsert-session-answer/index.ts` | service | request-response | No Edge Functions exist yet |
| `supabase/functions/submit-quiz-answers/index.ts` | service | request-response | No Edge Functions exist yet |
| `supabase/functions/get-quiz-result/index.ts` | service | request-response | No Edge Functions exist yet |
| `supabase/functions/create-quiz-access/index.ts` | service | request-response | No Edge Functions exist yet |

**All 8 Edge Function files**: Use RESEARCH.md Pattern 1 (Deno.serve skeleton), Pattern 2 (jwt.ts), Pattern 3 (bcryptjs), Pattern 6 (scoring), Pattern 8 (config.toml), Pattern 9 (invoke from client).

---

## Metadata

**Analog search scope:** `src/` (all FSD layers), `supabase/migrations/`
**Files scanned:** 28 source files read
**Pattern extraction date:** 2026-05-17
