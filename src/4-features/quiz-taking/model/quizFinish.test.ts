// quizFinish.test.ts
// Unit tests for the finishSession and loadResult store actions added in plan 02-05.
// Covers: double-submit guard, store state after submit, D-04 state machine branches.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('@entities/quiz-session/api', () => ({
  invokeVerifyAccess: vi.fn(),
  invokeStartSession: vi.fn(),
  invokeGetQuizMeta: vi.fn(),
  invokeSubmitAnswers: vi.fn(),
  invokeGetResult: vi.fn(),
}))

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
    },
  },
}))

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// vue-router mock: capture the push calls
const mockRouterPush = vi.fn()
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRouter: () => ({ push: mockRouterPush }),
  }
})

// ── Imports ───────────────────────────────────────────────────────────────────
import { useQuizTakingStore } from './useQuizTakingStore'
import { invokeSubmitAnswers, invokeGetResult } from '@entities/quiz-session/api'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeQuiz(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quiz-1',
    title: 'Test Quiz',
    time_limit_sec: null,
    settings: {
      allow_back: true,
      show_stop_button: true,
      shuffle_questions: false,
      shuffle_answers: false,
      allow_retake: false,
    },
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('useQuizTakingStore — 02-05 finishSession and loadResult', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockRouterPush.mockReset()
  })

  // ── finishSession ─────────────────────────────────────────────────────────
  describe('finishSession', () => {
    it('invokes submit-quiz-answers, stores result, sets sessionStatus=finished, routes to result', async () => {
      const mockSubmit = vi.mocked(invokeSubmitAnswers)
      mockSubmit.mockResolvedValue({ score: 3, totalQuestions: 4, percentage: 75 })

      const store = useQuizTakingStore()
      store.token = 'abc'
      store.guestToken = 'guest-tok'
      store.sessionId = 'sess-1'
      store.sessionStatus = 'active'
      store.quiz = makeQuiz() as never

      await store.finishSession()

      expect(mockSubmit).toHaveBeenCalledWith('guest-tok', 'sess-1')
      expect(store.result).toEqual({ score: 3, totalQuestions: 4, percentage: 75 })
      expect(store.sessionStatus).toBe('finished')
      expect(mockRouterPush).toHaveBeenCalledWith('/q/abc/result')
    })

    it('is double-submit guarded — concurrent calls only invoke the EF once', async () => {
      const mockSubmit = vi.mocked(invokeSubmitAnswers)
      // Simulate a slow EF response
      let resolve!: (v: unknown) => void
      mockSubmit.mockReturnValue(new Promise((r) => { resolve = r }) as never)

      const store = useQuizTakingStore()
      store.token = 'abc'
      store.guestToken = 'guest-tok'
      store.sessionId = 'sess-1'
      store.sessionStatus = 'active'
      store.quiz = makeQuiz() as never

      // Start two concurrent calls
      const p1 = store.finishSession()
      const p2 = store.finishSession()

      // Resolve the EF
      resolve({ score: 2, totalQuestions: 2, percentage: 100 })

      await Promise.all([p1, p2])

      // The EF must only have been called once
      expect(mockSubmit).toHaveBeenCalledTimes(1)
    })

    it('shows toast.error when the EF throws, does not route', async () => {
      const { toast } = await import('vue-sonner')
      const mockSubmit = vi.mocked(invokeSubmitAnswers)
      mockSubmit.mockRejectedValue(new Error('Network error'))

      const store = useQuizTakingStore()
      store.token = 'abc'
      store.guestToken = 'guest-tok'
      store.sessionId = 'sess-1'
      store.sessionStatus = 'active'
      store.quiz = makeQuiz() as never

      await store.finishSession()

      expect(toast.error).toHaveBeenCalled()
      expect(mockRouterPush).not.toHaveBeenCalled()
    })
  })

  // ── loadResult ────────────────────────────────────────────────────────────
  describe('loadResult', () => {
    it('invokes get-quiz-result and populates store.result', async () => {
      const mockGetResult = vi.mocked(invokeGetResult)
      mockGetResult.mockResolvedValue({
        score: 5,
        totalQuestions: 10,
        percentage: 50,
        label: 'Иван Иванов',
      })

      const store = useQuizTakingStore()
      store.guestToken = 'guest-tok'
      store.sessionId = 'sess-1'

      await store.loadResult('token-xyz')

      expect(mockGetResult).toHaveBeenCalledWith('guest-tok', 'sess-1')
      expect(store.result).toEqual({
        score: 5,
        totalQuestions: 10,
        percentage: 50,
        label: 'Иван Иванов',
      })
    })

    it('routes to invalid state when loadResult fails (session expired graceful fallback)', async () => {
      const mockGetResult = vi.mocked(invokeGetResult)
      mockGetResult.mockRejectedValue(new Error('Not found'))

      const store = useQuizTakingStore()
      store.guestToken = 'guest-tok'
      store.sessionId = 'sess-1'

      await store.loadResult('token-xyz')

      expect(store.sessionStatus).toBe('invalid')
    })
  })
})
