import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { useRouter } from 'vue-router'
import { supabase } from '@shared/api/supabase'
import {
  invokeVerifyAccess,
  invokeStartSession,
  invokeGetQuizMeta,
  invokeSubmitAnswers,
  invokeGetResult,
} from '@entities/quiz-session/api'
import type { Quiz } from '@entities/quiz/model'
import type { Question } from '@entities/question/model'
import type { SessionResult } from '@entities/quiz-session/model'

// Session state machine states:
//   idle       — no credentials yet; shows the intro card + login form (D-01)
//   active     — session started; taking questions. Entered directly on a
//                successful login — there is no intermediate "Начать" screen
//                (supersedes D-02; product-owner override 2026-05-17).
//   finished   — submitted; redirects to result page
//   not_ready  — quiz has zero questions (D-19)
//   invalid    — expired/invalid link or token
type SessionStatus = 'idle' | 'active' | 'finished' | 'not_ready' | 'invalid'

export const useQuizTakingStore = defineStore('quiz-taking', () => {
  const router = useRouter()

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
  // isSubmitting guards against double-submission of finishSession (T-02-25)
  // timer-expiry path and manual Стоп/Завершить path cannot both submit
  const isSubmitting    = ref(false)

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
   * If present: calls start-quiz-session to drive the complete D-04 state machine:
   *
   *   D-04 branches (keyed off sessionState from start-quiz-session):
   *   - 'active'  (in-progress, not expired):  restore answers → resume timer → 'active'
   *   - 'active'  (in-progress, but expired):  restore answers → call finishSession() (D-08)
   *   - 'finished' + allow_retake === false:    loadResult → route to result page
   *   - 'finished' + allow_retake === true:     clear sessionId + answers → start a
   *                                             fresh session immediately → 'active'
   *   - 'new'     (no prior session):           start fresh → 'active'
   *
   * Populates answers BEFORE setting sessionStatus = 'active' (D-04 — see PLAN note).
   * Does NOT remove or weaken the answer-restoration step from 02-03 (D-04 resume).
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

      // Repopulate quiz + questions — always needed since verifyAccess is skipped on resume.
      // Must happen BEFORE sessionStatus becomes 'active' so the header renders correctly.
      guestToken.value = storedGuestToken
      sessionId.value = res.sessionId
      startedAt.value = res.started_at
      quiz.value = res.quiz as unknown as Quiz
      questions.value = res.questions as unknown as Question[]
      questionCount.value = questions.value.length
      timeLimitSec.value = quiz.value?.time_limit_sec ?? null

      // ── D-04 state machine ──────────────────────────────────────────────────
      const state = res.sessionState ?? (res.resumed ? 'active' : 'new')

      if (state === 'finished') {
        // Finished session — check allow_retake to decide next action.
        const allowRetake = (quiz.value?.settings as { allow_retake?: boolean })?.allow_retake ?? false

        if (!allowRetake) {
          // D-04: finished + single-attempt → show the existing result.
          // loadResult fetches the score from the EF and then we route to the result page.
          await loadResult(t)
          if (sessionStatus.value !== 'invalid') {
            await router.push(`/q/${t}/result`)
          }
        } else {
          // D-04: finished + allow_retake → give the guest a fresh attempt.
          // Clear the stale sessionId/answers/index, then start a brand-new
          // quiz_session immediately — no intro screen (supersedes D-02).
          // guestToken.value is already set above, so startSession()'s guard passes.
          sessionId.value = null
          answers.value = {}
          currentQuestionIndex.value = 0
          sessionStorage.setItem(
            storageKey(t),
            JSON.stringify({ guestToken: storedGuestToken, sessionId: null, currentQuestionIndex: 0 }),
          )
          await startSession()
        }
        return
      }

      // Active session (in-progress) — restore answers FIRST so D-07 canGoForward gate
      // isn't falsely tripped on already-answered required questions.
      const restoredAnswers: Record<string, string[]> = {}
      for (const row of res.answers) {
        restoredAnswers[row.question_id] = row.selected_option_ids
      }
      answers.value = restoredAnswers

      // Restore the taker's last question position (clamped against a stale index)
      const savedIndex = parsed.currentQuestionIndex ?? 0
      currentQuestionIndex.value = Math.min(
        Math.max(0, savedIndex),
        Math.max(0, questions.value.length - 1),
      )

      // Persist merged state (sessionId may have been missing from stored value)
      persistSession()

      if (state === 'expired') {
        // WR-04: the server reported the session's timer has already elapsed.
        // D-08: auto-submit with the restored answers — finishSession() invokes
        // submit-quiz-answers then routes to the result page. The server is now
        // the source of truth for timer expiry; this is no longer a client-only check.
        sessionStatus.value = 'active' // set active so guards inside finishSession pass
        await finishSession()
      } else if (state === 'active') {
        // D-04: in-progress session — also check client-side as a defence-in-depth
        // backstop (clock skew, or a server that did not flag expiry).
        // computeRemaining uses the newly set startedAt + timeLimitSec.
        const remaining = computeRemaining()
        if (remaining <= 0 && timeLimitSec.value !== null) {
          // D-08: session expired while away → auto-submit with the restored answers.
          sessionStatus.value = 'active' // set active so guards inside finishSession pass
          await finishSession()
        } else {
          // Resume normally — answers restored, timer continues.
          sessionStatus.value = 'active'
          startTimer()
        }
      } else {
        // 'new' — a fresh session was just created (stored token but no DB session).
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
   * On success: stores guestToken + quiz + questions, then immediately starts the
   * session — the quiz goes straight to 'active', with no intermediate "Начать"
   * screen (supersedes D-02; product-owner override 2026-05-17).
   * On not_ready: sets sessionStatus = 'not_ready' (D-19).
   * On 401/410: rethrows so GuestLoginForm can show the toast; does NOT change sessionStatus.
   *
   * isLoading stays true across both invokeVerifyAccess and startSession (startSession
   * is awaited inside this try block, before the finally clears isLoading) so the login
   * button keeps its loading state until the question-taking screen is shown.
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

        // Start the session immediately — guestToken.value is set just above so
        // startSession()'s guard passes. startSession() creates the server-anchored
        // session, sets sessionStatus = 'active', and starts the timer.
        await startSession()
      }
    } catch (err) {
      // Rethrow 401/410 errors — GuestLoginForm shows the toast (preserves field values)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * startSession() — called from verifyAccess (fresh login) and init (D-04
   * allow_retake fresh attempt / 'new' session). Creates the server-anchored
   * session; the timer start anchor is set here. Sets sessionStatus = 'active'.
   * Guarded by isStarting against double-invocation (T-02-13).
   */
  async function startSession(): Promise<void> {
    if (!guestToken.value || !token.value || isStarting.value) return
    isStarting.value = true
    try {
      // newAttempt: true — every startSession() call is the taker actively starting
      // a quiz (fresh login or a D-04 retake). The EF enforces allow_retake, so a
      // first attempt (no prior session) is unaffected — it just inserts as before;
      // a retake against an allow_retake quiz gets a brand-new quiz_sessions row
      // instead of reusing the stale finished session.
      const res = await invokeStartSession(guestToken.value, { newAttempt: true })

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
    // WR-06: guard BEFORE the optimistic update. If guestToken/sessionId is null
    // (a click landing before startSession resolves, or after a token-clear) the
    // upsert EF returns 403 — but the optimistic map would already show the answer
    // as saved while the DB has nothing, silently losing it on the next refresh.
    if (!guestToken.value || !sessionId.value) {
      toast.error('Сессия не готова. Попробуйте ещё раз.')
      return
    }

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
   * finishSession() — submits the session and navigates to the result page.
   * T-02-25: isSubmitting guard prevents double-submission from timer-expiry + manual stop
   * racing. The submit-quiz-answers EF is also idempotent as a server-side backstop.
   * TAKE-06 / TAKE-08 / TAKE-10.
   */
  async function finishSession(): Promise<void> {
    // Double-submit guard (T-02-25)
    if (isSubmitting.value) return
    if (!guestToken.value || !sessionId.value || !token.value) return

    isSubmitting.value = true
    stopTimer()

    try {
      const res = await invokeSubmitAnswers(guestToken.value, sessionId.value)
      result.value = res
      sessionStatus.value = 'finished'
      await router.push(`/q/${token.value}/result`)
    } catch {
      toast.error('Ошибка отправки теста. Проверьте соединение и попробуйте снова.')
    } finally {
      isSubmitting.value = false
    }
  }

  /**
   * loadResult(quizToken) — called by QuizResultPage on direct-URL arrival when store.result
   * is unset. The result page is a separate page from QuizTakingWidget, so on a cold reload
   * the Pinia store is brand new (guestToken/sessionId null) and init() never ran here.
   * This rehydrates the guest session from sessionStorage before calling get-quiz-result,
   * so reloading /q/:token/result still shows the result while the 1h guest token is valid.
   * On no stored session, or any EF failure (e.g. expired token → 401), sets
   * sessionStatus = 'invalid' for the graceful "результат не найден / ссылка устарела" fallback.
   */
  async function loadResult(quizToken: string): Promise<void> {
    token.value = quizToken

    // Cold load: store has no credentials — rehydrate from sessionStorage (qf_guest_{token}).
    if (!guestToken.value) {
      const stored = sessionStorage.getItem(storageKey(quizToken))
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as {
            guestToken?: string
            sessionId?: string
          }
          guestToken.value = parsed.guestToken ?? null
          sessionId.value = parsed.sessionId ?? null
        } catch {
          // Corrupt storage — leave credentials null; handled below.
        }
      }
    }

    // No stored guest session at all → cannot fetch a result; show graceful fallback.
    if (!guestToken.value) {
      sessionStatus.value = 'invalid'
      return
    }

    try {
      const res = await invokeGetResult(guestToken.value, sessionId.value)
      result.value = res
    } catch {
      // Expired token (401) or any other failure → graceful expired-session fallback.
      sessionStatus.value = 'invalid'
    }
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
    isSubmitting,
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
    loadResult,
    computeRemaining,
    startTimer,
    stopTimer,
    cleanup,
  }
})
