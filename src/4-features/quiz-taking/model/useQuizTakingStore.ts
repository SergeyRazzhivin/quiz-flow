import { ref } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { invokeVerifyAccess, invokeStartSession } from '@entities/quiz-session/api'
import type { Quiz } from '@entities/quiz/model'
import type { Question } from '@entities/question/model'
import type { SessionResult } from '@entities/quiz-session/model'

// Session state machine states:
//   idle       — no credentials yet; shows login form
//   intro      — credentials verified; shows "Начать" button (D-01/D-02)
//   active     — session started; taking questions
//   finished   — submitted; redirects to result page
//   not_ready  — quiz has zero questions (D-19)
//   invalid    — expired/invalid link or token
type SessionStatus = 'idle' | 'intro' | 'active' | 'finished' | 'not_ready' | 'invalid'

export const useQuizTakingStore = defineStore('quiz-taking', () => {
  // ── State refs ────────────────────────────────────────────────────────────
  const sessionStatus   = ref<SessionStatus>('idle')
  const token           = ref<string | null>(null)
  const guestToken      = ref<string | null>(null)
  const sessionId       = ref<string | null>(null)
  const quiz            = ref<Quiz | null>(null)
  const questions       = ref<Question[]>([])
  // answers: questionId → selectedOptionIds (restored from session_answers on D-04 resume)
  const answers         = ref<Record<string, string[]>>({})
  const currentQuestionIndex = ref(0)
  const isLoading       = ref(false)
  // isStarting guards against double-invocation of startSession (T-02-13 + D-02)
  const isStarting      = ref(false)

  // Timer refs — populated by startSession / init resume; timer logic added in 02-04
  const startedAt        = ref<string | null>(null)
  const timeLimitSec     = ref<number | null>(null)
  const timeRemainingSeconds = ref(0)

  // Result — populated by finishSession / loadResult in 02-05
  const result = ref<SessionResult | null>(null)

  // ── Helpers ───────────────────────────────────────────────────────────────
  function storageKey(t: string): string {
    return `qf_guest_${t}`
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * init(t) — called on widget mount.
   * Checks sessionStorage for a stored guestToken. If none: idle.
   * If present: calls start-quiz-session to drive the D-04 resume state machine.
   * Populates answers BEFORE setting sessionStatus = 'active' (D-04 — see PLAN note).
   */
  async function init(t: string) {
    token.value = t
    const stored = sessionStorage.getItem(storageKey(t))

    if (!stored) {
      sessionStatus.value = 'idle'
      return
    }

    let parsed: { guestToken?: string; sessionId?: string }
    try {
      parsed = JSON.parse(stored)
    } catch {
      sessionStorage.removeItem(storageKey(t))
      sessionStatus.value = 'idle'
      return
    }

    const storedGuestToken = parsed.guestToken
    if (!storedGuestToken) {
      sessionStatus.value = 'idle'
      return
    }

    try {
      const res = await invokeStartSession(storedGuestToken)

      if (res.resumed) {
        // D-04: restore answers FIRST so D-07 canGoForward gate isn't falsely tripped
        const restoredAnswers: Record<string, string[]> = {}
        for (const row of res.answers) {
          restoredAnswers[row.question_id] = row.selected_option_ids
        }
        answers.value = restoredAnswers

        guestToken.value = storedGuestToken
        sessionId.value = res.sessionId
        startedAt.value = res.started_at

        // Persist merged state (sessionId may have been missing from stored value)
        sessionStorage.setItem(
          storageKey(t),
          JSON.stringify({ guestToken: storedGuestToken, sessionId: res.sessionId }),
        )

        sessionStatus.value = 'active'
      } else {
        // A brand-new session was created during init — rare edge case (token was stored
        // but session was missing from DB). Treat same as active start.
        guestToken.value = storedGuestToken
        sessionId.value = res.sessionId
        startedAt.value = res.started_at
        answers.value = {}

        sessionStorage.setItem(
          storageKey(t),
          JSON.stringify({ guestToken: storedGuestToken, sessionId: res.sessionId }),
        )

        sessionStatus.value = 'active'
      }
    } catch {
      // T-02-16: expired/invalid token → 401 → show invalid state, clear stale storage
      sessionStorage.removeItem(storageKey(t))
      sessionStatus.value = 'idle'
    }
  }

  /**
   * verifyAccess(login, password) — called by GuestLoginForm on submit.
   * On success: stores guestToken + quiz + questions, sets sessionStatus = 'intro' (D-01).
   * On not_ready: sets sessionStatus = 'not_ready' (D-19).
   * On 401/410: rethrows so GuestLoginForm can show the toast; does NOT change sessionStatus.
   */
  async function verifyAccess(login: string, password: string): Promise<void> {
    if (!token.value) return
    isLoading.value = true
    try {
      const res = await invokeVerifyAccess(token.value, login, password)

      if (res.state === 'not_ready') {
        sessionStatus.value = 'not_ready'
        return
      }

      if (res.state === 'ready' && res.guestToken) {
        guestToken.value = res.guestToken
        quiz.value = res.quiz as unknown as Quiz
        questions.value = (res.questions ?? []) as unknown as Question[]

        // Persist guestToken to sessionStorage (sessionId added by startSession)
        sessionStorage.setItem(
          storageKey(token.value),
          JSON.stringify({ guestToken: res.guestToken }),
        )

        sessionStatus.value = 'intro'
      }
    } catch (err) {
      // Rethrow 401/410 errors — GuestLoginForm shows the toast (preserves field values)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * startSession() — called by the "Начать" button (D-02).
   * Creates the server-anchored session; timer start anchor is set here.
   * Guarded by isStarting against double-invocation (T-02-13).
   */
  async function startSession(): Promise<void> {
    if (!guestToken.value || !token.value || isStarting.value) return
    isStarting.value = true
    try {
      const res = await invokeStartSession(guestToken.value)

      sessionId.value = res.sessionId
      startedAt.value = res.started_at
      timeLimitSec.value = quiz.value?.time_limit_sec ?? null

      // Merge sessionId into sessionStorage (guestToken already stored by verifyAccess)
      sessionStorage.setItem(
        storageKey(token.value),
        JSON.stringify({ guestToken: guestToken.value, sessionId: res.sessionId }),
      )

      // Restore any answers that came back (handles D-04 double-start edge case)
      if (res.resumed && res.answers.length > 0) {
        const restoredAnswers: Record<string, string[]> = {}
        for (const row of res.answers) {
          restoredAnswers[row.question_id] = row.selected_option_ids
        }
        answers.value = restoredAnswers
      }

      sessionStatus.value = 'active'
    } catch {
      toast.error('Ошибка запуска теста. Проверьте соединение и попробуйте снова.')
    } finally {
      isStarting.value = false
    }
  }

  /**
   * cleanup() — called on widget unmount.
   * Timer teardown and other side-effect cleanup added in plan 02-04.
   */
  function cleanup(): void {
    // Placeholder — 02-04 fills in timer teardown and event listener removal
  }

  return {
    sessionStatus,
    token,
    guestToken,
    sessionId,
    quiz,
    questions,
    answers,
    currentQuestionIndex,
    isLoading,
    isStarting,
    startedAt,
    timeLimitSec,
    timeRemainingSeconds,
    result,
    init,
    verifyAccess,
    startSession,
    cleanup,
  }
})
