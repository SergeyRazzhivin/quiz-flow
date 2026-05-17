// quizTaking.test.ts
// Unit tests for the quiz-taking store actions added in plan 02-04:
//   computeRemaining, isTimerCritical, selectAnswer (single/multiple), canGoForward gate.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('@entities/quiz-session/api', () => ({
  invokeVerifyAccess: vi.fn(),
  invokeStartSession: vi.fn(),
  invokeGetQuizMeta: vi.fn(),
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

// ── Helpers ───────────────────────────────────────────────────────────────────
import { useQuizTakingStore } from './useQuizTakingStore'

function makeQuestion(
  id: string,
  opts: { type?: 'single' | 'multiple'; is_required?: boolean } = {},
) {
  return {
    id,
    quiz_id: 'quiz-1',
    body: `Вопрос ${id}`,
    type: opts.type ?? 'single',
    order_index: 0,
    is_required: opts.is_required ?? false,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('useQuizTakingStore — 02-04 actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── computeRemaining ────────────────────────────────────────────────────────
  describe('computeRemaining', () => {
    it('returns 0 when timeLimitSec is null (no timer)', () => {
      const store = useQuizTakingStore()
      // timeLimitSec defaults to null; startedAt defaults to null
      expect(store.computeRemaining()).toBe(0)
    })

    it('clamps to 0 when deadline has passed', () => {
      const store = useQuizTakingStore()
      // started 2 hours ago, limit 1 hour → remaining = 0 (not negative)
      store.startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      store.timeLimitSec = 60 * 60 // 1 hour
      expect(store.computeRemaining()).toBe(0)
    })

    it('returns floor of remaining seconds when time is left', () => {
      const store = useQuizTakingStore()
      const now = Date.now()
      store.timeLimitSec = 60
      // Set started_at so that exactly 30.9 seconds remain (before flooring)
      // deadline = started_at + 60s; remaining = deadline - now
      // → started_at = now - (60 - 30.9) * 1000 = now - 29100ms
      store.startedAt = new Date(now - 29100).toISOString()
      const remaining = store.computeRemaining()
      // floor((deadline - Date.now()) / 1000): should be 30
      expect(remaining).toBeGreaterThanOrEqual(30)
      expect(remaining).toBeLessThanOrEqual(31)
    })
  })

  // ── isTimerCritical ─────────────────────────────────────────────────────────
  describe('isTimerCritical', () => {
    it('is false when timeLimitSec is null', () => {
      const store = useQuizTakingStore()
      expect(store.isTimerCritical).toBe(false)
    })

    it('is false when timeRemainingSeconds > 20% of timeLimitSec', () => {
      const store = useQuizTakingStore()
      store.timeLimitSec = 100
      store.timeRemainingSeconds = 25 // 25% > 20%
      expect(store.isTimerCritical).toBe(false)
    })

    it('is true exactly at the 20% boundary', () => {
      const store = useQuizTakingStore()
      store.timeLimitSec = 100
      store.timeRemainingSeconds = 20 // exactly 20%
      expect(store.isTimerCritical).toBe(true)
    })

    it('is true when timeRemainingSeconds < 20% of timeLimitSec', () => {
      const store = useQuizTakingStore()
      store.timeLimitSec = 100
      store.timeRemainingSeconds = 10 // 10% < 20%
      expect(store.isTimerCritical).toBe(true)
    })
  })

  // ── selectAnswer ────────────────────────────────────────────────────────────
  describe('selectAnswer', () => {
    it('single-type: replaces the answer array with the new selection', async () => {
      const store = useQuizTakingStore()
      store.guestToken = 'tok'
      store.sessionId = 'sess'
      store.questions = [makeQuestion('q1', { type: 'single' })]

      await store.selectAnswer('q1', 'opt-A', 'single')
      expect(store.answers['q1']).toEqual(['opt-A'])

      // Selecting another option replaces the previous
      await store.selectAnswer('q1', 'opt-B', 'single')
      expect(store.answers['q1']).toEqual(['opt-B'])
    })

    it('multiple-type: toggles — adds when absent', async () => {
      const store = useQuizTakingStore()
      store.guestToken = 'tok'
      store.sessionId = 'sess'
      store.questions = [makeQuestion('q1', { type: 'multiple' })]

      await store.selectAnswer('q1', 'opt-A', 'multiple')
      expect(store.answers['q1']).toContain('opt-A')
    })

    it('multiple-type: toggles — removes when present', async () => {
      const store = useQuizTakingStore()
      store.guestToken = 'tok'
      store.sessionId = 'sess'
      store.questions = [makeQuestion('q1', { type: 'multiple' })]
      store.answers = { q1: ['opt-A', 'opt-B'] }

      await store.selectAnswer('q1', 'opt-A', 'multiple')
      expect(store.answers['q1']).not.toContain('opt-A')
      expect(store.answers['q1']).toContain('opt-B')
    })

    it('merges into existing answers map without resetting other questions (D-04)', async () => {
      const store = useQuizTakingStore()
      store.guestToken = 'tok'
      store.sessionId = 'sess'
      store.questions = [
        makeQuestion('q1', { type: 'single' }),
        makeQuestion('q2', { type: 'single' }),
      ]
      store.answers = { q2: ['opt-X'] } // pre-populated by D-04 resume

      await store.selectAnswer('q1', 'opt-A', 'single')

      expect(store.answers['q1']).toEqual(['opt-A'])
      expect(store.answers['q2']).toEqual(['opt-X']) // must NOT be wiped
    })
  })

  // ── canGoForward / required-question gate ───────────────────────────────────
  describe('canGoForward (D-07 required-question gate)', () => {
    it('is true when the current question is not required', () => {
      const store = useQuizTakingStore()
      store.questions = [makeQuestion('q1', { is_required: false })]
      store.currentQuestionIndex = 0
      expect(store.canGoForward).toBe(true)
    })

    it('is false when the current question is required and has no answer', () => {
      const store = useQuizTakingStore()
      store.questions = [makeQuestion('q1', { is_required: true })]
      store.currentQuestionIndex = 0
      store.answers = {} // no answer selected
      expect(store.canGoForward).toBe(false)
    })

    it('is true when the current question is required and HAS an answer (including D-04 resume)', () => {
      const store = useQuizTakingStore()
      store.questions = [makeQuestion('q1', { is_required: true })]
      store.currentQuestionIndex = 0
      store.answers = { q1: ['opt-A'] }
      expect(store.canGoForward).toBe(true)
    })
  })
})
