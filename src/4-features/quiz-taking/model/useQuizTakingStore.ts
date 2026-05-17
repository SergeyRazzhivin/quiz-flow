import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { supabase } from '@shared/api/supabase'
import { invokeVerifyAccess, invokeStartSession, invokeGetQuizMeta } from '@entities/quiz-session/api'
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
  // questionCount: authoritative count for the intro meta row — populated pre-login
  // by get-quiz-meta (D-01) and re-synced from questions.length after verifyAccess.
  const questionCount   = ref(0)
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

  // Internal timer handle + visibility change listener (teardown in cleanup)
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let onVisibilityChange: (() => void) | null = null

  // ── Helpers ───────────────────────────────────────────────────────────────
  function storageKey(t: string): string {
    return `qf_guest_${t}`
  }

  /**
   * persistSession() — writes the full guest session object to sessionStorage so a
   * same-tab reload can restore both the session AND the taker's question position.
   * No-op when there is no quiz token yet (storage key is unknown).
   */
  function persistSession(): void {
    if (!token.value) return
    sessionStorage.setItem(
      storageKey(token.value),
      JSON.stringify({
        guestToken: guestToken.value,
        sessionId: sessionId.value,
        currentQuestionIndex: currentQuestionIndex.value,
      }),
    )
  }

  // ── Computeds ────────────────────────────────────────────────────────────

  /** currentQuestion: the question at currentQuestionIndex, or null when out of range. */
  const currentQuestion = computed<Question | null>(
    () => questions.value[currentQuestionIndex.value] ?? null,
  )

  /** isLastQuestion: true when on the final question of the session. */
  const isLastQuestion = computed<boolean>(
    () =>
      questions.value.length > 0 &&
      currentQuestionIndex.value === questions.value.length - 1,
  )

  /**
   * progressPercent: 0–100 percentage of questions completed.
   * A question counts as "completed" once the user is past it (currentIndex + 1 denominator).
   */
  const progressPercent = computed<number>(() => {
    if (questions.value.length === 0) return 0
    return Math.round(((currentQuestionIndex.value + 1) / questions.value.length) * 100)
  })

  /**
   * canGoBack: true when the quiz allows backward navigation and the taker is not on
   * the first question (D-07 / quiz.settings.allow_back).
   */
  const canGoBack = computed<boolean>(() => {
    if (!(quiz.value?.settings?.allow_back ?? false)) return false
    return currentQuestionIndex.value > 0
  })

  /**
   * canGoForward: false when the current question is required and has no answer (D-07).
   * Always true otherwise (navigation logic handles last-question case).
   */
  const canGoForward = computed<boolean>(() => {
    const q = currentQuestion.value
    if (!q) return false
    if (q.is_required) {
      const selected = answers.value[q.id]
      if (!selected || selected.length === 0) return false
    }
    return true
  })

  /**
   * isTimerCritical: true when remaining time is ≤ 20% of the total limit (RESEARCH Pattern 4).
   * Always false when no time limit is set (D-09).
   */
  const isTimerCritical = computed<boolean>(() => {
    if (!timeLimitSec.value) return false
    return timeRemainingSeconds.value <= timeLimitSec.value * 0.2
  })

  // ── Timer helpers ─────────────────────────────────────────────────────────

  /**
   * computeRemaining() — RESEARCH Pattern 4, server-anchored.
   * Returns floor of (deadline - now) / 1000, clamped to 0.
   * Returns 0 when timeLimitSec or startedAt is null.
   */
  function computeRemaining(): number {
    if (!startedAt.value || !timeLimitSec.value) return 0
    const deadline = new Date(startedAt.value).getTime() + timeLimitSec.value * 1000
    return Math.max(0, Math.floor((deadline - Date.now()) / 1000))
  }

  function stopTimer(): void {
    if (timerInterval !== null) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    if (onVisibilityChange !== null) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      onVisibilityChange = null
    }
  }

  /**
   * startTimer() — no-op when timeLimitSec is null (D-09).
   * Sets up a 1s interval that recomputes timeRemainingSeconds from the server
   * started_at anchor (RESEARCH Pattern 4). Calls finishSession() when time hits 0 (D-08).
   * Registers a visibilitychange listener that corrects the timer when the tab regains focus.
   */
  function startTimer(): void {
    if (!timeLimitSec.value) return // D-09

    timeRemainingSeconds.value = computeRemaining()

    timerInterval = setInterval(() => {
      timeRemainingSeconds.value = computeRemaining()
      if (timeRemainingSeconds.value <= 0) {
        stopTimer()
        void finishSession()
      }
    }, 1000)

    onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        timeRemainingSeconds.value = computeRemaining()
        // If timer expired while in background, finalize now
        if (timeRemainingSeconds.value <= 0) {
          stopTimer()
          void finishSession()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * loadIntroMeta(t) — fetches the public, pre-login quiz metadata (D-01) so the
   * intro card shows title/description/cover/count BEFORE the guest logs in.
   * Sets sessionStatus to 'idle' on success, or 'invalid' on a bad/expired token.
   */
  async function loadIntroMeta(t: string): Promise<void> {
    try {
      const res = await invokeGetQuizMeta(t)
      if (res.state === 'ready') {
        quiz.value = res.quiz as unknown as Quiz
        questionCount.value = res.questionCount
        sessionStatus.value = 'idle'
      } else {
        sessionStatus.value = 'invalid'
      }
    } catch {
      // 404/410 (invalid or expired token) → graceful invalid state
      sessionStatus.value = 'invalid'
    }
  }

  /**
   * init(t) — called on widget mount.
   * Checks sessionStorage for a stored guestToken. If none: load the intro meta
   * (D-01) so the pre-login intro card is populated, then go idle.
   * If present: calls start-quiz-session to drive the D-04 resume state machine.
   * Populates answers BEFORE setting sessionStatus = 'active' (D-04 — see PLAN note).
   */
  async function init(t: string) {
    token.value = t
    const stored = sessionStorage.getItem(storageKey(t))

    if (!stored) {
      await loadIntroMeta(t)
      return
    }

    let parsed: { guestToken?: string; sessionId?: string; currentQuestionIndex?: number }
    try {
      parsed = JSON.parse(stored)
    } catch {
      sessionStorage.removeItem(storageKey(t))
      await loadIntroMeta(t)
      return
    }

    const storedGuestToken = parsed.guestToken
    if (!storedGuestToken) {
      await loadIntroMeta(t)
      return
    }

    try {
      const res = await invokeStartSession(storedGuestToken)

      // On resume the guest never re-enters credentials, so verifyAccess never runs.
      // start-quiz-session now returns quiz + questions — repopulate the store from
      // them here, otherwise the active UI renders "Вопрос 1 из 0" with no question.
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

        // Repopulate quiz + questions (set by verifyAccess on the login path,
        // skipped on resume) — must happen BEFORE sessionStatus becomes 'active'.
        quiz.value = res.quiz as unknown as Quiz
        questions.value = res.questions as unknown as Question[]
        questionCount.value = questions.value.length
        timeLimitSec.value = quiz.value?.time_limit_sec ?? null

        // Restore the taker's last question position (clamped against a stale index)
        const savedIndex = parsed.currentQuestionIndex ?? 0
        currentQuestionIndex.value = Math.min(
          Math.max(0, savedIndex),
          Math.max(0, questions.value.length - 1),
        )

        // Persist merged state (sessionId may have been missing from stored value)
        persistSession()

        sessionStatus.value = 'active'
        startTimer()
      } else {
        // A brand-new session was created during init — rare edge case (token was stored
        // but session was missing from DB). Treat same as active start.
        guestToken.value = storedGuestToken
        sessionId.value = res.sessionId
        startedAt.value = res.started_at
        answers.value = {}

        // Same repopulation as the resume branch — the guest has no login step here either.
        quiz.value = res.quiz as unknown as Quiz
        questions.value = res.questions as unknown as Question[]
        questionCount.value = questions.value.length
        timeLimitSec.value = quiz.value?.time_limit_sec ?? null

        // Restore the taker's last question position (clamped against a stale index)
        const savedIndex = parsed.currentQuestionIndex ?? 0
        currentQuestionIndex.value = Math.min(
          Math.max(0, savedIndex),
          Math.max(0, questions.value.length - 1),
        )

        persistSession()

        sessionStatus.value = 'active'
        startTimer()
      }
    } catch {
      // T-02-16: expired/invalid guest token → 401. Clear stale storage and fall back
      // to the pre-login intro (D-01) so the card still shows title/description.
      sessionStorage.removeItem(storageKey(t))
      await loadIntroMeta(t)
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
        // Keep the meta count correct post-login (the full question list is now known)
        questionCount.value = questions.value.length

        // Persist guestToken to sessionStorage (sessionId/index added by startSession;
        // both are still null/0 pre-start, which is the correct initial state).
        persistSession()

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

      // start-quiz-session now also returns quiz + questions — refresh them for
      // consistency with the init() resume path (verifyAccess already set them here).
      quiz.value = res.quiz as unknown as Quiz
      questions.value = res.questions as unknown as Question[]
      questionCount.value = questions.value.length
      timeLimitSec.value = quiz.value?.time_limit_sec ?? null

      // Merge sessionId into sessionStorage (guestToken already stored by verifyAccess)
      persistSession()

      // Restore any answers that came back (handles D-04 double-start edge case)
      if (res.resumed && res.answers.length > 0) {
        const restoredAnswers: Record<string, string[]> = {}
        for (const row of res.answers) {
          restoredAnswers[row.question_id] = row.selected_option_ids
        }
        answers.value = restoredAnswers
      }

      sessionStatus.value = 'active'
      startTimer()
    } catch {
      toast.error('Ошибка запуска теста. Проверьте соединение и попробуйте снова.')
    } finally {
      isStarting.value = false
    }
  }

  /**
   * selectAnswer(questionId, optionId, type) — RESEARCH Pattern 5.
   * Optimistic local update first, then immediately upserts via the EF.
   * Single-type: replaces; multiple-type: toggles.
   * Merges into the existing answers map — never resets it (D-04).
   */
  async function selectAnswer(
    questionId: string,
    optionId: string,
    type: 'single' | 'multiple',
  ): Promise<void> {
    // Optimistic update
    if (type === 'single') {
      answers.value[questionId] = [optionId]
    } else {
      const cur = answers.value[questionId] ?? []
      answers.value[questionId] = cur.includes(optionId)
        ? cur.filter((id) => id !== optionId)
        : [...cur, optionId]
    }

    // Immediate persist — never accumulate for a final-only submit (Pitfall 2)
    try {
      const { error } = await supabase.functions.invoke('upsert-session-answer', {
        body: {
          guestToken: guestToken.value,
          sessionId: sessionId.value,
          questionId,
          selectedOptionIds: answers.value[questionId],
        },
      })
      if (error) toast.error('Ошибка сохранения ответа. Проверьте соединение.')
    } catch {
      toast.error('Ошибка сохранения ответа. Проверьте соединение.')
    }
  }

  /**
   * goForward() — advances to the next question when canGoForward is true.
   */
  function goForward(): void {
    if (!canGoForward.value) return
    if (currentQuestionIndex.value < questions.value.length - 1) {
      currentQuestionIndex.value++
      persistSession()
    }
  }

  /**
   * goBack() — goes to the previous question when canGoBack is true.
   */
  function goBack(): void {
    if (!canGoBack.value) return
    if (currentQuestionIndex.value > 0) {
      currentQuestionIndex.value--
      persistSession()
    }
  }

  /**
   * finishSession() — placeholder stub (02-05 implements the real submit).
   * Stops the timer so the timer-expiry path (D-08) is wired correctly.
   */
  async function finishSession(): Promise<void> {
    stopTimer()
    // 02-05 replaces this body with actual submit logic
  }

  /**
   * cleanup() — called on widget unmount.
   * Tears down the interval and the visibilitychange listener.
   */
  function cleanup(): void {
    stopTimer()
  }

  return {
    // State refs
    sessionStatus,
    token,
    guestToken,
    sessionId,
    quiz,
    questions,
    questionCount,
    answers,
    currentQuestionIndex,
    isLoading,
    isStarting,
    startedAt,
    timeLimitSec,
    timeRemainingSeconds,
    result,
    // Computeds
    currentQuestion,
    isLastQuestion,
    progressPercent,
    canGoBack,
    canGoForward,
    isTimerCritical,
    // Actions
    init,
    verifyAccess,
    startSession,
    selectAnswer,
    goForward,
    goBack,
    finishSession,
    computeRemaining,
    startTimer,
    stopTimer,
    cleanup,
  }
})
