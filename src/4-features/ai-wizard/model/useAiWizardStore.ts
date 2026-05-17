// src/4-features/ai-wizard/model/useAiWizardStore.ts
// The 4-step AI-wizard state machine, generation trigger, and the ai_jobs poll loop.
// FSD: 4-features imports from 5-entities and 6-shared only — no feature-to-feature imports.

import { ref, reactive, computed } from 'vue'
import { defineStore } from 'pinia'
import { useRouter } from 'vue-router'
import { supabase } from '@shared/api/supabase'
import { fileToBase64 } from '@shared/lib/file'
import { invokeGenerateQuiz, fetchAiJob } from '@entities/ai-job/api'
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

type GenerationStatus = 'idle' | 'pending' | 'failed' | 'done'
type SourceMode = 'text' | 'file'
type Difficulty = 'easy' | 'medium' | 'hard'

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

  // Plan-aware limits — default to the free tier until profiles.plan is read.
  const plan = ref<'free' | 'pro'>('free')
  const planMaxQuestions = computed(() => PLAN_MAX_QUESTIONS[plan.value])
  const planMaxFileBytes = computed(() => PLAN_MAX_FILE_BYTES[plan.value])

  // Module-scoped poll handle — explicitly torn down on completed/failed/cleanup/retry.
  let pollTimer: ReturnType<typeof setInterval> | null = null

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
    }
  }
  void loadPlan()

  // ── Validation ──────────────────────────────────────────────────────────────
  const isFileValid = computed(() => {
    const f = form.file
    if (!f) return false
    return f.size <= planMaxFileBytes.value && ACCEPTED_FILE_MIME.includes(f.type)
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
        return form.questionCount >= 1 && form.questionCount <= planMaxQuestions.value
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
    } catch {
      // D-11 / UI-SPEC: the step-4 in-page failure UI carries the recovery
      // actions — no toast for this case.
      generationStatus.value = 'failed'
    }
  }

  function startPolling(id: string): void {
    stopPolling()
    pollTimer = setInterval(async () => {
      try {
        const job = await fetchAiJob(id)
        currentStage.value = job.stage
        if (job.status === 'completed' && job.quiz_id) {
          stopPolling()
          generationStatus.value = 'done'
          await router.push('/editor/' + job.quiz_id)
        } else if (job.status === 'failed') {
          stopPolling()
          generationStatus.value = 'failed'
        }
      } catch {
        // A transient poll error is non-fatal — the next tick retries.
      }
    }, POLL_INTERVAL_MS)
  }

  function stopPolling(): void {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
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
    await startGeneration()
  }

  // D-11 "Изменить параметры" — return to step 3 with all input intact.
  function backToParams(): void {
    stopPolling()
    generationStatus.value = 'idle'
    currentStage.value = null
    jobId.value = null
    step.value = 3
  }

  return {
    step,
    form,
    generationStatus,
    currentStage,
    jobId,
    plan,
    planMaxQuestions,
    planMaxFileBytes,
    isFileValid,
    isStepValid,
    next,
    back,
    startGeneration,
    retry,
    backToParams,
    cleanup,
  }
})
