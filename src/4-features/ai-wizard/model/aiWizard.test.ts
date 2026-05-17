// aiWizard.test.ts
// Unit tests for the useAiWizardStore 4-step state machine, generation,
// and the polling loop (plan 03-02 Task 2).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Module mocks ──────────────────────────────────────────────────────────────
const invokeGenerateQuizMock = vi.fn()
const fetchAiJobMock = vi.fn()
const routerPushMock = vi.fn()

vi.mock('@entities/ai-job/api', () => ({
  invokeGenerateQuiz: (...a: unknown[]) => invokeGenerateQuizMock(...a),
  fetchAiJob: (...a: unknown[]) => fetchAiJobMock(...a),
}))

vi.mock('@shared/lib/file', () => ({
  fileToBase64: vi.fn().mockResolvedValue('YmFzZTY0'),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

// profiles.plan read — default to a free plan
const singleMock = vi.fn().mockResolvedValue({ data: { plan: 'free' }, error: null })
vi.mock('@shared/api/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1' } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => singleMock() }) }),
    }),
  },
}))

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useAiWizardStore } from './useAiWizardStore'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('useAiWizardStore — step state machine', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    singleMock.mockResolvedValue({ data: { plan: 'free' }, error: null })
  })

  it('starts at step 1', () => {
    expect(useAiWizardStore().step).toBe(1)
  })

  it('next / back stay within 1..4', () => {
    const s = useAiWizardStore()
    s.back()
    expect(s.step).toBe(1)
    s.step = 4
    s.next()
    expect(s.step).toBe(4)
  })

  it('step 1 is invalid with an empty title, valid with a title', () => {
    const s = useAiWizardStore()
    s.step = 1
    expect(s.isStepValid).toBe(false)
    s.form.title = 'История'
    expect(s.isStepValid).toBe(true)
  })

  it('step 2 is invalid with no text and no file', () => {
    const s = useAiWizardStore()
    s.step = 2
    expect(s.isStepValid).toBe(false)
    s.form.sourceText = 'материал'
    expect(s.isStepValid).toBe(true)
  })

  it('step 3 is invalid when questionCount is out of plan range', () => {
    const s = useAiWizardStore()
    s.step = 3
    s.form.questionCount = 0
    expect(s.isStepValid).toBe(false)
    s.form.questionCount = 5
    expect(s.isStepValid).toBe(true)
    s.form.questionCount = 999
    expect(s.isStepValid).toBe(false)
  })
})

describe('useAiWizardStore — generation + polling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    singleMock.mockResolvedValue({ data: { plan: 'free' }, error: null })
  })
  afterEach(() => vi.useRealTimers())

  it('startGeneration calls invokeGenerateQuiz and stores the jobId', async () => {
    invokeGenerateQuizMock.mockResolvedValue({ jobId: 'job-1' })
    fetchAiJobMock.mockResolvedValue({ id: 'job-1', status: 'pending', stage: 'reading', error: null, quiz_id: null })
    const s = useAiWizardStore()
    s.form.title = 'T'
    s.form.sourceText = 'материал'
    await s.startGeneration()
    expect(invokeGenerateQuizMock).toHaveBeenCalled()
    expect(s.generationStatus).toBe('pending')
  })

  it('poll loop redirects to /editor/:id and stops on completed', async () => {
    invokeGenerateQuizMock.mockResolvedValue({ jobId: 'job-1' })
    fetchAiJobMock.mockResolvedValue({ id: 'job-1', status: 'completed', stage: 'done', error: null, quiz_id: 'quiz-9' })
    const s = useAiWizardStore()
    s.form.title = 'T'
    s.form.sourceText = 'материал'
    await s.startGeneration()
    await vi.advanceTimersByTimeAsync(2100)
    expect(routerPushMock).toHaveBeenCalledWith('/editor/quiz-9')
    const calls = fetchAiJobMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(4000)
    expect(fetchAiJobMock.mock.calls.length).toBe(calls)
  })

  it('poll loop sets failed status and stops on failed', async () => {
    invokeGenerateQuizMock.mockResolvedValue({ jobId: 'job-1' })
    fetchAiJobMock.mockResolvedValue({ id: 'job-1', status: 'failed', stage: 'generating', error: 'err', quiz_id: null })
    const s = useAiWizardStore()
    s.form.title = 'T'
    s.form.sourceText = 'материал'
    await s.startGeneration()
    await vi.advanceTimersByTimeAsync(2100)
    expect(s.generationStatus).toBe('failed')
  })

  it('startGeneration sets failed status when the invoke throws', async () => {
    invokeGenerateQuizMock.mockRejectedValue(new Error('400'))
    const s = useAiWizardStore()
    s.form.title = 'T'
    s.form.sourceText = 'материал'
    await s.startGeneration()
    expect(s.generationStatus).toBe('failed')
  })

  it('poll loop fails the wizard after the 90s deadline with no terminal status (WR-01)', async () => {
    invokeGenerateQuizMock.mockResolvedValue({ jobId: 'job-1' })
    // The job stays 'pending' forever — an orphaned ai_jobs row.
    fetchAiJobMock.mockResolvedValue({ id: 'job-1', status: 'pending', stage: 'reading', error: null, quiz_id: null })
    const s = useAiWizardStore()
    s.form.title = 'T'
    s.form.sourceText = 'материал'
    await s.startGeneration()
    // Before the deadline the wizard is still pending.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(s.generationStatus).toBe('pending')
    // Past the 90s hard cap the wizard transitions to failed and polling stops.
    await vi.advanceTimersByTimeAsync(35_000)
    expect(s.generationStatus).toBe('failed')
    const calls = fetchAiJobMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchAiJobMock.mock.calls.length).toBe(calls)
  })

  it('cleanup stops the poll interval', async () => {
    invokeGenerateQuizMock.mockResolvedValue({ jobId: 'job-1' })
    fetchAiJobMock.mockResolvedValue({ id: 'job-1', status: 'pending', stage: 'reading', error: null, quiz_id: null })
    const s = useAiWizardStore()
    s.form.title = 'T'
    s.form.sourceText = 'материал'
    await s.startGeneration()
    await vi.advanceTimersByTimeAsync(2100)
    const calls = fetchAiJobMock.mock.calls.length
    s.cleanup()
    await vi.advanceTimersByTimeAsync(6000)
    expect(fetchAiJobMock.mock.calls.length).toBe(calls)
  })

  it('retry resets status to idle, keeps the form, and re-runs generation', async () => {
    invokeGenerateQuizMock.mockResolvedValue({ jobId: 'job-2' })
    fetchAiJobMock.mockResolvedValue({ id: 'job-2', status: 'pending', stage: 'reading', error: null, quiz_id: null })
    const s = useAiWizardStore()
    s.form.title = 'Сохранён'
    s.form.sourceText = 'материал'
    s.generationStatus = 'failed'
    await s.retry()
    expect(s.form.title).toBe('Сохранён')
    expect(invokeGenerateQuizMock).toHaveBeenCalled()
  })

  it('resetWizard returns the store to its initial state after a generation (D-02)', () => {
    const s = useAiWizardStore()
    // Simulate a completed generation run.
    s.step = 4
    s.form.title = 'Старый тест'
    s.form.sourceMode = 'file'
    s.form.sourceText = 'материал'
    s.form.clarifyingPrompt = 'фокус'
    s.form.questionCount = 42
    s.form.difficulty = 'hard'
    s.form.difficultyPrompt = 'сложнее'
    s.generationStatus = 'done'
    s.currentStage = 'done'
    s.jobId = 'job-old'

    s.resetWizard()

    expect(s.step).toBe(1)
    expect(s.form.title).toBe('')
    expect(s.form.sourceMode).toBe('text')
    expect(s.form.sourceText).toBe('')
    expect(s.form.file).toBeNull()
    expect(s.form.clarifyingPrompt).toBe('')
    expect(s.form.questionCount).toBe(10)
    expect(s.form.difficulty).toBe('medium')
    expect(s.form.difficultyPrompt).toBe('')
    expect(s.generationStatus).toBe('idle')
    expect(s.currentStage).toBeNull()
    expect(s.jobId).toBeNull()
  })
})
