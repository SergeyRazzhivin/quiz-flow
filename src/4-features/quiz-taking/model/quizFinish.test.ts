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
import {
  invokeSubmitAnswers,
  invokeGetResult,
  invokeVerifyAccess,
  invokeStartSession,
} from '@entities/quiz-session/api'

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

  // ── verifyAccess ──────────────────────────────────────────────────────────
  // Supersedes D-02: a successful login now starts the session immediately and
  // the store goes straight to 'active' — there is no intermediate 'intro' state.
  describe('verifyAccess', () => {
    beforeEach(() => {
      sessionStorage.clear()
    })

    it('on a ready response starts the session immediately and goes to active', async () => {
      const mockVerify = vi.mocked(invokeVerifyAccess)
      mockVerify.mockResolvedValue({
        state: 'ready',
        guestToken: 'guest-tok',
        quiz: makeQuiz() as Record<string, unknown>,
        questions: [{ id: 'q1' }],
      })

      const mockStart = vi.mocked(invokeStartSession)
      mockStart.mockResolvedValue({
        sessionId: 'sess-1',
        started_at: new Date().toISOString(),
        resumed: false,
        sessionState: 'new',
        answers: [],
        quiz: makeQuiz() as Record<string, unknown>,
        questions: [{ id: 'q1' }],
      })

      const store = useQuizTakingStore()
      store.token = 'abc'

      await store.verifyAccess('login', 'password')

      expect(mockVerify).toHaveBeenCalledWith('abc', 'login', 'password')
      // verifyAccess must drive the session start itself (no 'intro' screen).
      expect(mockStart).toHaveBeenCalledWith('guest-tok')
      expect(store.sessionStatus).toBe('active')
      expect(store.sessionId).toBe('sess-1')
      expect(store.isLoading).toBe(false)
    })

    it('on a not_ready response sets sessionStatus=not_ready and does not start a session', async () => {
      const mockVerify = vi.mocked(invokeVerifyAccess)
      mockVerify.mockResolvedValue({ state: 'not_ready' })

      const mockStart = vi.mocked(invokeStartSession)

      const store = useQuizTakingStore()
      store.token = 'abc'

      await store.verifyAccess('login', 'password')

      expect(store.sessionStatus).toBe('not_ready')
      expect(mockStart).not.toHaveBeenCalled()
    })

    it('rethrows on a 401/410 error and leaves sessionStatus unchanged', async () => {
      const mockVerify = vi.mocked(invokeVerifyAccess)
      mockVerify.mockRejectedValue(new Error('401'))

      const store = useQuizTakingStore()
      store.token = 'abc'

      await expect(store.verifyAccess('login', 'wrong')).rejects.toThrow()
      expect(store.sessionStatus).toBe('idle')
      expect(store.isLoading).toBe(false)
    })
  })

  // ── loadResult ────────────────────────────────────────────────────────────
  describe('loadResult', () => {
    beforeEach(() => {
      sessionStorage.clear()
    })

    it('invokes get-quiz-result and populates store.result when the store already has credentials', async () => {
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

    it('rehydrates the guest session from sessionStorage on a cold load and fetches the result', async () => {
      const mockGetResult = vi.mocked(invokeGetResult)
      mockGetResult.mockResolvedValue({
        score: 4,
        totalQuestions: 8,
        percentage: 50,
        label: 'Пётр Петров',
      })

      // Simulate a finished session left in sessionStorage by finishSession().
      sessionStorage.setItem(
        'qf_guest_token-xyz',
        JSON.stringify({
          guestToken: 'stored-guest-tok',
          sessionId: 'stored-sess-1',
          currentQuestionIndex: 0,
        }),
      )

      // Brand-new store — no credentials, as on a cold result-page reload.
      const store = useQuizTakingStore()

      await store.loadResult('token-xyz')

      expect(mockGetResult).toHaveBeenCalledWith('stored-guest-tok', 'stored-sess-1')
      expect(store.guestToken).toBe('stored-guest-tok')
      expect(store.sessionId).toBe('stored-sess-1')
      expect(store.result).toEqual({
        score: 4,
        totalQuestions: 8,
        percentage: 50,
        label: 'Пётр Петров',
      })
    })

    it('sets sessionStatus=invalid without calling the EF when there is no stored session', async () => {
      const mockGetResult = vi.mocked(invokeGetResult)

      // Brand-new store AND empty sessionStorage.
      const store = useQuizTakingStore()

      await store.loadResult('token-xyz')

      expect(mockGetResult).not.toHaveBeenCalled()
      expect(store.sessionStatus).toBe('invalid')
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
