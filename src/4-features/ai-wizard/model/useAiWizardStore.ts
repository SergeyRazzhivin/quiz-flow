// src/4-features/ai-wizard/model/useAiWizardStore.ts
// The 4-step AI-wizard state machine, generation trigger, and the ai_jobs poll loop.
// FSD: 4-features imports from 5-entities and 6-shared only — no feature-to-feature imports.

import { ref, reactive, computed } from 'vue'
import { defineStore } from 'pinia'
import { useRouter } from 'vue-router'
import { supabase } from '@shared/api/supabase'
import { fileToBase64 } from '@shared/lib/file'
import { invokeGenerateQuiz, fetchAiJob, GenerateQuizError } from '@entities/ai-job/api'
import type { GenerateQuizPayload } from '@entities/ai-job/api'
import type { AiJobStage } from '@entities/ai-job/model'

// Plan-aware limits (D-06 file size, D-07 question count). Free vs Pro.
const PLAN_MAX_QUESTIONS = { free: 10, pro: 100 } as const
const PLAN_MAX_FILE_BYTES = { free: 1 * 1024 * 1024, pro: 5 * 1024 * 1024 } as const
// Accepted source-file MIME types (PDF / DOCX).
const ACCEPTED_FILE_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const POLL_INTERVAL_MS = 2000
// WR-01: hard client-side poll deadline. An ai_jobs row can be orphaned at
// status='pending' if the Edge Function isolate is evicted mid-generation; the
// poll loop would otherwise spin forever with no failure UI. After this cap with
// no terminal status the wizard transitions to 'failed' so the user gets the
// step-4 recovery actions.
const POLL_DEADLINE_MS = 90_000

type GenerationStatus = 'idle' | 'pending' | 'failed' | 'done'
type SourceMode = 'text' | 'file'
type Difficulty = 'easy' | 'medium' | 'hard'

// WR-02 / WR-03: the Edge Function rejects client-correctable problems with a
// 400 and a specific `error` code. Map those codes to a Russian message the
// step-4 failure card can show instead of the generic "Не удалось…" text, so
// the user knows exactly what to fix. Codes NOT in this table (network errors,
// auth expiry, genuine AI failures) fall through to the generic card.
const CORRECTABLE_FAILURE_MESSAGES: Record<string, string> = {
  QUESTION_COUNT_EXCEEDED:
    'Слишком много вопросов для вашего тарифа. Уменьшите количество вопросов на шаге 3.',
  FILE_TOO_LARGE:
    'Файл слишком большой для вашего тарифа. Загрузите файл меньшего размера на шаге 2.',
  UNSUPPORTED_FILE_TYPE:
    'Неподдерживаемый тип файла. Загрузите документ PDF или DOCX на шаге 2.',
  // IN-05: the uploaded file had no extractable text (a scanned/image-only PDF
  // or an empty document). The user can re-upload a text-based file on step 2.
  EMPTY_DOCUMENT:
    'Не удалось извлечь текст из файла. Загрузите документ с текстом (не скан) на шаге 2.',
}

/** Resolve a known EF error code to its correctable Russian message, if any. */
function correctableMessage(code: string | null): string | null {
  if (!code) return null
  for (const [key, message] of Object.entries(CORRECTABLE_FAILURE_MESSAGES)) {
    if (code.startsWith(key)) return message
  }
  return null
}

export const useAiWizardStore = defineStore('ai-wizard', () => {
  const router = useRouter()

  // ── State ───────────────────────────────────────────────────────────────────
  const step = ref<1 | 2 | 3 | 4>(1)

  const form = reactive({
    title: '',
    sourceMode: 'text' as SourceMode,
    sourceText: '',
    file: null as File | null,
    clarifyingPrompt: '',          // D-05 — also the AI-04 focus area
    questionCount: 10,             // D-07 — numeric input
    difficulty: 'medium' as Difficulty,
    difficultyPrompt: '',          // D-08 — optional free text
  })

  const generationStatus = ref<GenerationStatus>('idle')
  const currentStage = ref<AiJobStage | null>(null)
  const jobId = ref<string | null>(null)

  // WR-02 / WR-03: retained diagnostics for a failed generation. `failureCode`
  // is the EF's error code (or null); `failureMessage` is the correctable
  // Russian message shown on step 4 when the failure is user-fixable.
  const failureCode = ref<string | null>(null)
  const failureMessage = ref<string | null>(null)

  // Plan-aware limits — default to the free tier until profiles.plan is read.
  const plan = ref<'free' | 'pro'>('free')
  const planMaxQuestions = computed(() => PLAN_MAX_QUESTIONS[plan.value])
  const planMaxFileBytes = computed(() => PLAN_MAX_FILE_BYTES[plan.value])

  // IN-01: `loadPlan()` runs un-awaited at store construction; until it
  // resolves `plan` is still 'free'. A Pro user would briefly see Free caps
  // (10 questions / 1 MB) on steps 2-3, and a fast Pro-sized input could be
  // rejected by `isStepValid` before the real plan is known. `planLoaded`
  // gates the upper-bound checks: while the plan read is in flight the wizard
  // does not hard-reject on a limit. The EF re-validates regardless
  // (constraint #4), so this only removes the UX flicker — it never widens
  // what is actually allowed.
  const planLoaded = ref(false)

  // WR-09: self-scheduling poll handle. A setInterval with an async callback
  // could fire a second fetchAiJob before the first resolved (overlapping
  // requests on a slow connection) and a stale late-resolving poll could
  // revert the UI stage after the job already finished. The next tick is now
  // scheduled only AFTER the current fetchAiJob settles.
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  // WR-09: monotonically-incrementing token identifying the current poll run.
  // A poll whose token no longer matches `pollToken` is stale (stopPolling /
  // a new run happened mid-fetch) and its result must be discarded.
  let pollToken = 0

  // ── Plan read ───────────────────────────────────────────────────────────────
  // Read profiles.plan once so the wizard can apply D-06/D-07 limit values as UX.
  // The server re-validates regardless (constraint #4).
  async function loadPlan(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()
      if (error || !data) return
      if (data.plan === 'pro' || data.plan === 'free') plan.value = data.plan
    } catch {
      // Non-fatal — the free-tier defaults stay; the EF still enforces limits.
    } finally {
      // IN-01: mark the plan read settled (success OR failure) so the limit
      // checks below stop deferring. On failure the free-tier defaults apply,
      // which is the correct conservative fallback.
      planLoaded.value = true
    }
  }
  void loadPlan()

  // ── Validation ──────────────────────────────────────────────────────────────
  const isFileValid = computed(() => {
    const f = form.file
    if (!f) return false
    if (!ACCEPTED_FILE_MIME.includes(f.type)) return false
    // IN-01: defer the plan-aware size cap until the plan read has settled, so
    // a Pro user is not briefly blocked by the Free 1 MB default. The EF
    // re-checks the size regardless (constraint #4).
    if (!planLoaded.value) return true
    return f.size <= planMaxFileBytes.value
  })

  // Per-step "Далее" gate (standard wizard behaviour).
  const isStepValid = computed(() => {
    switch (step.value) {
      case 1:
        return form.title.trim().length > 0
      case 2:
        if (form.sourceMode === 'text') return form.sourceText.trim().length > 0
        return isFileValid.value
      case 3:
        if (form.questionCount < 1) return false
        // IN-01: defer the plan-aware upper cap until the plan read has
        // settled — a Pro user must not be briefly blocked by the Free max of
        // 10. The EF re-validates the count regardless (constraint #4).
        if (!planLoaded.value) return true
        return form.questionCount <= planMaxQuestions.value
      default:
        return true // step 4 has no gate
    }
  })

  // ── Step navigation ─────────────────────────────────────────────────────────
  function next(): void {
    if (step.value < 4) step.value = (step.value + 1) as 1 | 2 | 3 | 4
  }
  function back(): void {
    if (step.value > 1) step.value = (step.value - 1) as 1 | 2 | 3 | 4
  }

  // ── Generation ──────────────────────────────────────────────────────────────
  async function startGeneration(): Promise<void> {
    generationStatus.value = 'pending'
    currentStage.value = 'reading'
    // WR-02 / WR-03: clear any stale failure diagnostics from a prior attempt.
    failureCode.value = null
    failureMessage.value = null
    step.value = 4
    try {
      const payload: GenerateQuizPayload = {
        title: form.title.trim(),
        clarifyingPrompt: form.clarifyingPrompt.trim(),
        questionCount: form.questionCount,
        difficulty: form.difficulty,
        difficultyPrompt: form.difficultyPrompt.trim() || undefined,
      }
      if (form.sourceMode === 'file' && form.file) {
        payload.fileBase64 = await fileToBase64(form.file)
        payload.fileName = form.file.name
      } else {
        payload.sourceText = form.sourceText
      }
      const { jobId: id } = await invokeGenerateQuiz(payload)
      jobId.value = id
      startPolling(id)
    } catch (err) {
      // WR-03: never swallow the error silently — log it so production
      // incidents are debuggable from the client side.
      console.error('ai-wizard generation failed:', err)
      // WR-02: if the EF rejected with a client-correctable 400, surface a
      // specific message; otherwise fall back to the generic AI-failure card.
      if (err instanceof GenerateQuizError) {
        failureCode.value = err.code
        failureMessage.value = correctableMessage(err.code)
      }
      // D-11 / UI-SPEC: the step-4 in-page failure UI carries the recovery
      // actions — no toast for this case.
      generationStatus.value = 'failed'
    }
  }

  function startPolling(id: string): void {
    stopPolling()
    // WR-01: track when polling started so the loop can give up on an orphaned job.
    const pollStartedAt = Date.now()
    // WR-09: claim a token for this run. Every fetch result is checked against
    // it so a poll that resolves after stopPolling (or a new run) is ignored.
    const token = ++pollToken

    // WR-09: one poll tick — fetch, apply the result only if still current,
    // then schedule the NEXT tick (so two fetches can never overlap).
    const tick = async (): Promise<void> => {
      // The run was torn down (stopPolling / retry / cleanup) before this tick.
      if (token !== pollToken) return

      // WR-01: a job stuck at 'pending' (evicted EF isolate) never reaches a
      // terminal status — bail out past the hard deadline and fail the wizard.
      if (Date.now() - pollStartedAt >= POLL_DEADLINE_MS) {
        stopPolling()
        generationStatus.value = 'failed'
        return
      }

      try {
        const job = await fetchAiJob(id)
        // WR-09: a stale poll (stopPolling ran while this fetch was in flight)
        // must not write to currentStage / generationStatus.
        if (token !== pollToken) return
        currentStage.value = job.stage
        if (job.status === 'completed' && job.quiz_id) {
          stopPolling()
          generationStatus.value = 'done'
          await router.push('/editor/' + job.quiz_id)
          return
        } else if (job.status === 'failed') {
          stopPolling()
          generationStatus.value = 'failed'
          return
        }
      } catch {
        // A transient poll error is non-fatal — the next tick retries.
      }

      // WR-09: schedule the next tick ONLY after this one settled, and only if
      // the run is still current (not torn down by a terminal status above).
      if (token === pollToken) {
        pollTimer = setTimeout(tick, POLL_INTERVAL_MS)
      }
    }

    pollTimer = setTimeout(tick, POLL_INTERVAL_MS)
  }

  function stopPolling(): void {
    // WR-09: invalidate any in-flight fetch so its result is discarded.
    pollToken++
    if (pollTimer !== null) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  // Called from the widget's onUnmounted — no leaked timer (RESEARCH Pitfall 3).
  function cleanup(): void {
    stopPolling()
  }

  // D-11 "Повторить" — keep steps 1-3 input intact, re-run generation.
  async function retry(): Promise<void> {
    stopPolling()
    generationStatus.value = 'idle'
    currentStage.value = null
    jobId.value = null
    failureCode.value = null
    failureMessage.value = null
    await startGeneration()
  }

  // D-11 "Изменить параметры" — return to step 3 with all input intact.
  function backToParams(): void {
    stopPolling()
    generationStatus.value = 'idle'
    currentStage.value = null
    jobId.value = null
    failureCode.value = null
    failureMessage.value = null
    step.value = 3
  }

  // D-02 — the wizard always creates a new quiz. The store is a Pinia singleton,
  // so every (re)entry to /ai-wizard must reset it to the initial state, else the
  // stale completed step-4 state from a prior run is shown.
  function resetWizard(): void {
    stopPolling()
    step.value = 1
    form.title = ''
    form.sourceMode = 'text'
    form.sourceText = ''
    form.file = null
    form.clarifyingPrompt = ''
    form.questionCount = 10
    form.difficulty = 'medium'
    form.difficultyPrompt = ''
    generationStatus.value = 'idle'
    currentStage.value = null
    jobId.value = null
    failureCode.value = null
    failureMessage.value = null
  }

  return {
    step,
    form,
    generationStatus,
    currentStage,
    jobId,
    failureCode,
    failureMessage,
    plan,
    planLoaded,
    planMaxQuestions,
    planMaxFileBytes,
    isFileValid,
    isStepValid,
    next,
    back,
    startGeneration,
    retry,
    backToParams,
    resetWizard,
    cleanup,
  }
})
