# Architecture Research: Quiz Flow

**Project:** Quiz Flow
**Researched:** 2026-05-16
**Confidence:** HIGH (RLS patterns, FSD layer mapping, Pinia) / MEDIUM (Edge Function streaming specifics)

---

## RLS Design for Dual-User Model

### The Core Challenge

Two distinct actor types must coexist under RLS:

1. **Owner** — authenticated Supabase Auth user (`auth.uid()` is set, role = `authenticated`)
2. **Guest** — quiz-taker with no Supabase Auth session. Arrives via `/q/:token`, verifies login+password through an Edge Function. Role = `anon`.

### Strategy: Two-Track Access

```
Owner track:  Browser → PostgREST (Authorization: Bearer <supabase-jwt>) → RLS checks auth.uid()
Guest track:  Browser → Edge Function verify-token → service_role client → DB (bypasses RLS)
              Browser → PostgREST (anon) → RLS allows read of published quiz/questions only
```

Guest reads are strictly read-only and constrained to published content. All guest writes are mediated by Edge Functions using the service_role key.

### Policy Design by Table

#### `quizzes`

```sql
-- Owner: full access to own quizzes
create policy "owner_manage_quizzes"
  on quizzes to authenticated
  using  ( owner_id = (select auth.uid()) )
  with check ( owner_id = (select auth.uid()) );

-- Guest: read published quizzes (title/description for quiz-taking page)
create policy "anon_read_published_quizzes"
  on quizzes for select to anon
  using ( is_published = true );
```

#### `questions`

```sql
create policy "owner_manage_questions"
  on questions to authenticated
  using (
    quiz_id in (select id from quizzes where owner_id = (select auth.uid()))
  )
  with check (
    quiz_id in (select id from quizzes where owner_id = (select auth.uid()))
  );

create policy "anon_read_questions_for_published"
  on questions for select to anon
  using (
    quiz_id in (select id from quizzes where is_published = true)
  );
```

#### `answer_options`

**Critical:** `is_correct` must not reach the guest browser.

Preferred approach: create a `SECURITY DEFINER` view `answer_options_public` that excludes `is_correct`, grant `anon` SELECT on the view only, revoke direct table SELECT from `anon`.

Fallback: strip `is_correct` inside the `verify-quiz-access` Edge Function response.

```sql
create policy "owner_manage_answer_options"
  on answer_options to authenticated
  using (
    question_id in (
      select q.id from questions q
      join quizzes qz on qz.id = q.quiz_id
      where qz.owner_id = (select auth.uid())
    )
  );
-- No anon SELECT policy on answer_options directly — use the view
```

#### `quiz_access`

```sql
create policy "owner_manage_quiz_access"
  on quiz_access to authenticated
  using (
    quiz_id in (select id from quizzes where owner_id = (select auth.uid()))
  )
  with check (
    quiz_id in (select id from quizzes where owner_id = (select auth.uid()))
  );
-- No anon policy. Token validation happens inside Edge Function with service_role.
```

#### `quiz_sessions` and `session_answers`

```sql
-- Owner: read sessions for own quizzes
create policy "owner_read_sessions"
  on quiz_sessions for select to authenticated
  using (
    quiz_id in (select id from quizzes where owner_id = (select auth.uid()))
  );

create policy "owner_read_session_answers"
  on session_answers for select to authenticated
  using (
    session_id in (
      select qs.id from quiz_sessions qs
      join quizzes qz on qz.id = qs.quiz_id
      where qz.owner_id = (select auth.uid())
    )
  );
-- No anon policy. Edge Function inserts with service_role.
```

#### `profiles` and `subscriptions`

```sql
create policy "owner_own_profile"
  on profiles to authenticated
  using  ( id = (select auth.uid()) )
  with check ( id = (select auth.uid()) );

create policy "owner_own_subscription"
  on subscriptions to authenticated
  using  ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );
```

### Performance: SECURITY DEFINER Helper Functions

RLS subqueries checking quiz ownership re-run on every row. Wrap in a `STABLE SECURITY DEFINER` function for ~10x speedup on large tables:

```sql
create or replace function is_quiz_owner(quiz_id uuid)
  returns boolean language sql security definer stable
as $$
  select exists (
    select 1 from quizzes
    where id = quiz_id and owner_id = auth.uid()
  );
$$;
```

Required indexes:
```sql
create index on quizzes (owner_id);
create index on quiz_access (token);
create index on quiz_sessions (quiz_access_id, quiz_id);
create index on session_answers (session_id);
create index on questions (quiz_id);
create index on answer_options (question_id);
```

### Guest Auth Flow (Edge Function mediated)

```
1. Guest loads /q/:token
   → Anon client fetches quiz metadata (title, description) via PostgREST anon policy

2. Guest submits login + password to Edge Function `verify-quiz-access`
   → EF looks up quiz_access WHERE token = $token using service_role
   → bcrypt.compare(password, password_hash)
   → On success: EF returns { guestToken, quizData }
     guestToken = short-lived JWT signed with SUPABASE_JWT_SECRET
     containing { quiz_access_id, quiz_id, exp: now+3600 }
   → quizData: full quiz + questions + answer options (is_correct EXCLUDED)

3. Guest starts quiz: POST to Edge Function `start-quiz-session`
   → EF verifies guestToken signature and expiry
   → service_role INSERT into quiz_sessions → returns { sessionId }

4. Guest submits answers: POST to Edge Function `submit-quiz-answers`
   → EF verifies guestToken + confirms sessionId belongs to quiz_access_id
   → service_role batch INSERT into session_answers
   → service_role UPDATE quiz_sessions SET finished_at, score

5. Redirect to /q/:token/result
   → GET Edge Function `get-quiz-result` with { guestToken, sessionId }
   → EF returns { score, totalQuestions, answersWithCorrectness }
```

Guest token stored in `sessionStorage` (not localStorage) — clears on tab close.

---

## FSD Layer Mapping

### Guiding Principle

- **5-entities**: Domain nouns — data shapes, API fetchers, thin display components. No business logic, no feature references.
- **4-features**: Domain verbs — what a user does. Orchestrates entities + shared. Contains Pinia stores, side effects, form logic.
- **3-widgets**: Large composed UI blocks. Assembles features and entities into page sections. Only layer allowed to compose multiple features.
- **2-pages**: Thin route components. No logic — just mount the right widget.

### 5-entities Slice Breakdown

```
5-entities/
├── quiz/
│   ├── api.ts          — fetchQuiz(id), fetchMyQuizzes(), createQuiz(), updateQuiz(), deleteQuiz()
│   ├── model.ts        — Quiz, QuizSettings, QuizStatus interfaces
│   └── ui/QuizCard.vue — display card, emits events upward, zero business logic
│
├── question/
│   ├── api.ts          — fetchQuestions(quizId), createQuestion(), updateQuestion(), deleteQuestion(), reorderQuestions()
│   ├── model.ts        — Question, QuestionType ('single' | 'multiple')
│   └── ui/QuestionDisplay.vue — read-only rendering for quiz-taking page
│
├── answer-option/
│   ├── api.ts          — createAnswerOption(), updateAnswerOption(), deleteAnswerOption()
│   ├── model.ts        — AnswerOption (without is_correct — strip at API layer for guests)
│   └── ui/AnswerOptionItem.vue — single selectable option, selected/disabled state via props
│
├── user/
│   ├── api.ts          — fetchProfile(), updateProfile()
│   ├── model.ts        — Profile, Plan ('free' | 'pro')
│   └── ui/UserAvatar.vue
│
└── session/
    ├── api.ts          — stubs only; actual writes via EF
    ├── model.ts        — QuizSession, SessionAnswer, SessionResult
    └── ui/ScoreBadge.vue
```

### 4-features Slice Breakdown

```
4-features/
├── auth/
│   ├── model/useAuthStore.ts      — currentUser, login(), logout(), register()
│   └── ui/LoginForm.vue, RegisterForm.vue
│
├── quiz-editor/
│   ├── model/useQuizEditorStore.ts — draft state, debounced save, publish toggle
│   └── ui/QuizMetaForm.vue, QuestionEditor.vue, AnswerOptionEditor.vue
│
├── ai-wizard/
│   ├── model/useAiWizardStore.ts  — step (1–4), formData, generationStatus, generatedQuizId
│   └── ui/WizardStep1.vue → WizardStep4.vue
│
├── quiz-share/
│   ├── model/useQuizShareStore.ts — accessLinks list, create/delete link
│   └── ui/AccessLinkForm.vue, AccessLinkList.vue
│
├── quiz-taking/
│   ├── model/useQuizTakingStore.ts — full session state (see State Management)
│   └── ui/GuestLoginForm.vue, QuizIntroScreen.vue, NavigationControls.vue
│
├── statistics/
│   ├── model/useStatisticsStore.ts
│   └── ui/SessionTable.vue, ScoreChart.vue
│
└── payment/
    ├── model/usePaymentStore.ts
    └── ui/PlanCard.vue, PaymentButton.vue
```

### Import Rule Enforcement — Common Violations to Guard

- `5-entities/quiz/api.ts` must NOT import from `4-features/`
- `4-features/quiz-editor` CAN import `5-entities/quiz/api.ts` and `5-entities/question/api.ts`
- `3-widgets/` is the only layer that can compose multiple feature slices in one component
- `6-shared/api/supabase.ts` is imported by entities and features — never the reverse
- Pinia stores live in `4-features/*/model/` — entities have no store

---

## State Management Patterns (Pinia)

### useQuizTakingStore — Core Session Store

```typescript
// 4-features/quiz-taking/model/useQuizTakingStore.ts
export const useQuizTakingStore = defineStore('quiz-taking', () => {
  // Guest auth
  const quizAccessId = ref<string | null>(null)
  const guestToken = ref<string | null>(null)  // stored in sessionStorage

  // Quiz content
  const quiz = ref<Quiz | null>(null)
  const questions = ref<Question[]>([])
  const answerOptions = ref<Record<string, AnswerOption[]>>({})

  // Session state
  const sessionId = ref<string | null>(null)
  const currentQuestionIndex = ref(0)
  const answers = ref<Record<string, string[]>>({})  // question_id → option_ids[]
  const sessionStatus = ref<'idle' | 'loading' | 'intro' | 'active' | 'finished'>('idle')

  // Timer
  const timeRemainingSeconds = ref(0)
  let timerInterval: ReturnType<typeof setInterval> | null = null

  // Computed
  const currentQuestion = computed(() => questions.value[currentQuestionIndex.value] ?? null)
  const totalQuestions = computed(() => questions.value.length)
  const isLastQuestion = computed(() => currentQuestionIndex.value === questions.value.length - 1)
  const allowBack = computed(() => quiz.value?.settings?.allow_back ?? false)
  const progressPercent = computed(() =>
    totalQuestions.value > 0
      ? Math.round(((currentQuestionIndex.value + 1) / totalQuestions.value) * 100)
      : 0
  )

  function startTimer(seconds: number) {
    timeRemainingSeconds.value = seconds
    timerInterval = setInterval(() => {
      if (timeRemainingSeconds.value <= 0) {
        stopTimer()
        void finishSession()
      } else {
        timeRemainingSeconds.value--
      }
    }, 1000)
  }

  function selectAnswer(questionId: string, optionId: string, type: 'single' | 'multiple') {
    if (type === 'single') {
      answers.value[questionId] = [optionId]
    } else {
      const cur = answers.value[questionId] ?? []
      answers.value[questionId] = cur.includes(optionId)
        ? cur.filter(id => id !== optionId)
        : [...cur, optionId]
    }
    // Persist to sessionStorage on every change — safeguard against refresh
    sessionStorage.setItem('qf_answers_' + sessionId.value, JSON.stringify(answers.value))
  }

  function goToNext() { if (!isLastQuestion.value) currentQuestionIndex.value++ }
  function goToPrevious() { if (!isFirstQuestion.value && allowBack.value) currentQuestionIndex.value-- }

  async function finishSession() { /* POST to submit-quiz-answers EF */ }

  return {
    quizAccessId, guestToken, quiz, questions, answerOptions,
    sessionId, currentQuestionIndex, answers, sessionStatus, timeRemainingSeconds,
    currentQuestion, totalQuestions, isLastQuestion, allowBack, progressPercent,
    startTimer, selectAnswer, goToNext, goToPrevious, finishSession
  }
})
```

**Timer lives in the store** (not a standalone composable) because it drives `finishSession()` — a store action.

### useQuizEditorStore — Owner Editor

Key patterns:
- **Debounced auto-save** on quiz metadata changes (500ms debounce)
- **Immediate save** on question add/delete/reorder — `order_index` is fragile, do not batch
- Questions save individually (not as batch) to preserve partial progress on error
- `isDirty` flag gates the browser `beforeunload` warning

### useAiWizardStore — 4-Step Wizard

```typescript
const step = ref<1 | 2 | 3 | 4>(1)
const formData = ref({ title: '', inputText: '', questionCount: 10, difficulty: 'medium' as const, focusArea: '' })
const generationStatus = ref<'idle' | 'generating' | 'parsing' | 'done' | 'error'>('idle')
const generatedQuizId = ref<string | null>(null)
// Step 4: CSS progress animation (deterministic, not SSE)
// On done: router.push('/editor/' + generatedQuizId.value)
```

### Store Isolation Rules

- `useAuthStore` is the only store imported by other stores
- `useQuizTakingStore` and `useQuizEditorStore` are never imported by each other
- Entity API functions (`5-entities/*/api.ts`) are called from feature stores, not from components
- Components call store actions — they never call entity APIs directly

---

## Edge Function Architecture

### Function Inventory

```
supabase/functions/
├── verify-quiz-access/    — POST {token, login, password} → {guestToken, quizData}
├── start-quiz-session/    — POST {guestToken} → {sessionId}
├── submit-quiz-answers/   — POST {guestToken, sessionId, answers} → {score, result}
├── get-quiz-result/       — POST {guestToken, sessionId} → {score, answers, correctness}
├── generate-quiz/         — POST {title, text, count, difficulty} → {quizId}  [verify_jwt: true]
└── yookassa-webhook/      — POST (ЮKassa notification) → update subscriptions  [verify_jwt: false]
```

### AI Generation: Batch, Not Streaming

Use batch (non-streaming) for generate-quiz. Reasoning:
- Output is a structured JSON object — streaming individual tokens provides no UX benefit
- Structured Outputs require the full response before parsing
- The wizard's Step 4 is already a loading state — a deterministic CSS progress animation is simpler

### Token Budget and Error Handling

| Risk | Mitigation |
|------|-----------|
| Input too long → context overflow | Cap input at 12,000 chars; warn user in UI |
| Model hits max_tokens mid-JSON | Catch JSON.parse error → 422 response |
| Edge Function 150s wall timeout | Set OpenAI timeout to 120s; return 504 if exceeded |
| Freemium abuse (AI gen limit) | Check plan + monthly count in EF with FOR UPDATE lock |
| Missing correct answers | Validate ≥1 correct answer per question before saving |

### verify-quiz-access Pattern

```typescript
// verify_jwt: false in config.toml
import { compare } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const { data: access } = await supabase
  .from('quiz_access')
  .select('id, quiz_id, password_hash, expires_at')
  .eq('token', token).eq('login', login).single()

if (!access) return new Response('Not found', { status: 404 })
if (access.expires_at && new Date(access.expires_at) < new Date())
  return new Response('Link expired', { status: 410 })

const valid = await compare(password, access.password_hash)
if (!valid) return new Response('Invalid credentials', { status: 401 })

// Fetch quiz + questions + answer_options (WITHOUT is_correct)
const { data: quiz } = await supabase
  .from('quizzes')
  .select(`*, questions(*, answer_options(id, body, order_index))`)
  .eq('id', access.quiz_id).eq('is_published', true).single()

// Issue short-lived guest JWT (1 hour)
// Return { guestToken, quiz }
```

---

## Component Hierarchy

### QuizEditorPage Layout

```vue
<template>
  <div class="quiz-editor-layout">
    <QuizEditorHeader />
    <main class="editor-body">
      <QuestionList />
    </main>
    <QuizEditorFooter />
  </div>
</template>

<style scoped>
.quiz-editor-layout {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100dvh;        /* dvh not vh — adjusts when mobile browser chrome collapses */
  overflow: hidden;
}
.editor-body {
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
```

**Use `100dvh` not `100vh`** — `dvh` adjusts dynamically when mobile browser UI appears/disappears.

### Full Component Tree

```
QuizEditorPage (2-pages)
└── QuizEditorWidget (3-widgets)  [owns useQuizEditorStore]
    ├── QuizEditorHeader (3-widgets)
    │   ├── QuizMetaForm (4-features/quiz-editor/ui)
    │   ├── CoverUpload (4-features/quiz-editor/ui)
    │   └── PublishToggle (4-features/quiz-editor/ui)
    ├── QuestionList (3-widgets)  [DnD container via vue-draggable-plus]
    │   └── QuestionEditor (4-features/quiz-editor/ui)  [×N]
    │       └── AnswerOptionEditor (4-features/quiz-editor/ui)  [×N]
    └── QuizEditorFooter (3-widgets)
        └── NavigationSettings (4-features/quiz-editor/ui)

QuizSharePage (2-pages)  [reads useQuizTakingStore.sessionStatus]
├── GuestLoginForm (4-features/quiz-taking/ui)          [status = 'idle']
├── QuizIntroScreen (4-features/quiz-taking/ui)         [status = 'intro']
└── QuizTakingWidget (3-widgets)                        [status = 'active']
    ├── TimerDisplay (3-widgets)
    ├── QuestionDisplay (5-entities/question/ui)
    │   └── AnswerOptionItem (5-entities/answer-option/ui)  [×N]
    └── NavigationControls (4-features/quiz-taking/ui)
```

The page controls which block renders via `v-if` on `sessionStatus`. On `'finished'`, calls `router.push('/q/:token/result')`.

---

## Build Order (Dependencies)

### Critical Path

```
Migrations → Shared → Entities → Auth → QuizEditor → GuestTaking EFs → GuestTaking UI → Sharing → AI → Stats → Payment
```

### Phase-by-Phase

| Phase | Deliverable | Blocks |
|-------|-------------|--------|
| 1 | 6-shared (api, ui, lib, config, types) + Migrations 001–007 | Everything |
| 2 | 5-entities (user, quiz, question, answer-option, session) | Phase 3+ |
| 3 | Auth feature + Router guards + AuthPage | Phase 4+ |
| 4 | Quiz Editor feature + Widgets + QuizEditorPage, MyQuizListPage, QuizListPage | Phase 6, 7 |
| 5 | Guest EFs (verify-quiz-access, start-quiz-session, submit-quiz-answers, get-quiz-result) | Phase 5 UI |
| 5 | Quiz Taking feature + Widgets + QuizSharePage + QuizResultPage | Phase 6 |
| 6 | Quiz Share feature + editor integration | Phase 7 |
| 7 | generate-quiz EF + AI Wizard feature | — |
| 8 | Statistics feature + StatisticPage | — |
| 9 | yookassa-webhook EF + Payment feature + PaymentPage | — |

**Key dependency:** Guest quiz-taking requires Edge Functions deployed before end-to-end testing. Build EF skeletons with mock responses early so frontend Phase 5 development is not blocked.

---

## Open Questions

1. **ЮKassa webhook HMAC** — exact header name and validation pattern needs dedicated investigation at payment phase.
2. **Supabase Storage RLS for cover images** — public read + owner write policy not in 007 migration yet.
3. **Quiz result tab-close edge** — if guest token is in sessionStorage and user closes/reopens tab, result page becomes inaccessible. Handle gracefully.
4. **Freemium enforcement atomicity** — AI generation count check must use `FOR UPDATE` lock inside Edge Function to prevent race conditions.
5. **File parsing** — how will PDF/DOCX text be extracted in the AI wizard? Options: pdf-parse (Node), LlamaIndex, OpenAI file API. Affects wizard step 2 UX.
