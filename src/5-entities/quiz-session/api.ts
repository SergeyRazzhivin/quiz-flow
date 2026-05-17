// Thin typed wrappers for guest-facing Edge Function invocations.
// All session WRITE operations go through Edge Functions — no direct .from('quiz_sessions') writes.
// Owner EFs carry auth header automatically via the Supabase client.
// Guest EFs carry the guestToken in the request body.

import { supabase } from '@shared/api/supabase'

// Shape returned by verify-quiz-access (built in 02-01)
export interface VerifyAccessResponse {
  state:       'ready' | 'not_ready'
  guestToken?: string
  quiz?:       Record<string, unknown>
  questions?:  Record<string, unknown>[]
}

// Public quiz metadata for the /q/:token intro card (pre-login) — D-01.
export interface QuizMeta {
  title:          string
  description:    string | null
  cover_url:      string | null
  time_limit_sec: number | null
}

// Shape returned by get-quiz-meta
export type GetQuizMetaResponse =
  | { state: 'ready'; quiz: QuizMeta; questionCount: number }
  | { state: 'invalid' }

// Shape returned by start-quiz-session
// quiz + questions are included so a resumed session (where the guest never
// re-enters credentials) can repopulate the store. Same shape as VerifyAccessResponse.
// D-04: sessionState distinguishes the four cases the store state machine needs to handle.
export interface StartSessionResponse {
  sessionId:    string
  started_at:   string
  resumed:      boolean
  // sessionState discriminates the D-04 branches:
  //   'new'      — a fresh session was just created
  //   'active'   — an open (not expired) session was resumed
  //   'expired'  — an open session whose server-side timer has already elapsed
  //                (WR-04 — the store must finalize it rather than resume taking)
  //   'finished' — a previously finished session was found (no new session created)
  sessionState?: 'new' | 'active' | 'expired' | 'finished'
  answers:      { question_id: string; selected_option_ids: string[] }[]
  quiz:         Record<string, unknown>
  questions:    Record<string, unknown>[]
}

/**
 * Invoke verify-quiz-access — validates guest credentials and returns a signed guestToken
 * plus quiz metadata + question list (no is_correct field).
 * On wrong credentials the EF returns HTTP 401; supabase.functions.invoke throws.
 * On not_ready (zero questions) the EF returns { state: 'not_ready' }.
 */
export async function invokeVerifyAccess(
  token: string,
  login: string,
  password: string,
): Promise<VerifyAccessResponse> {
  const { data, error } = await supabase.functions.invoke('verify-quiz-access', {
    body: { token, login, password },
  })
  if (error) throw error
  return data as VerifyAccessResponse
}

/**
 * Invoke get-quiz-meta — returns non-sensitive quiz metadata (title, description,
 * cover, time limit) and a question count for the pre-login intro card (D-01).
 * Does NOT require credentials and never returns question content or answers.
 * On an invalid/expired token the EF returns HTTP 404/410; supabase.functions.invoke
 * throws — callers should treat a thrown error as { state: 'invalid' }.
 */
export async function invokeGetQuizMeta(token: string): Promise<GetQuizMetaResponse> {
  const { data, error } = await supabase.functions.invoke('get-quiz-meta', {
    body: { token },
  })
  if (error) throw error
  return data as GetQuizMetaResponse
}

/**
 * Invoke start-quiz-session — creates a new session or resumes an existing open one (D-04).
 * Returns sessionId, server-authoritative started_at, resumed flag, stored answers,
 * and the quiz + questions (so a reload-resumed session can repopulate the store).
 *
 * options.newAttempt — when true, signals the EF that the taker is actively starting
 * a quiz (first attempt or a retake). The EF still enforces allow_retake server-side:
 * a finished single-attempt quiz returns sessionState 'finished' regardless. Absent
 * (detection mode): an open session resumes, a finished one is reported as 'finished'.
 */
export async function invokeStartSession(
  guestToken: string,
  options?: { newAttempt?: boolean },
): Promise<StartSessionResponse> {
  const { data, error } = await supabase.functions.invoke('start-quiz-session', {
    body: { guestToken, newAttempt: options?.newAttempt ?? false },
  })
  if (error) throw error
  return data as StartSessionResponse
}

// Shape returned by submit-quiz-answers
export interface SubmitAnswersResponse {
  score:          number
  totalQuestions: number
  percentage:     number
}

// Shape returned by get-quiz-result
export interface GetResultResponse {
  score:          number
  totalQuestions: number
  percentage:     number
  label:          string
}

/**
 * Invoke submit-quiz-answers — finalizes the session with server-side partial-credit scoring.
 * The client never submits a score value (T-02-22 — score tampering prevention).
 * Returns score, totalQuestions, and percentage.
 * Idempotent: an already-finished session returns its stored score without re-scoring (T-02-25).
 */
export async function invokeSubmitAnswers(
  guestToken: string,
  sessionId: string,
): Promise<SubmitAnswersResponse> {
  const { data, error } = await supabase.functions.invoke('submit-quiz-answers', {
    body: { guestToken, sessionId },
  })
  if (error) throw error
  return data as SubmitAnswersResponse
}

/**
 * Invoke get-quiz-result — returns the result of a finished quiz session.
 * Used by the result page on direct-URL arrival (store.result is unset).
 * Never returns is_correct or password_hash (T-02-23, D-11).
 */
export async function invokeGetResult(
  guestToken: string,
  sessionId?: string | null,
): Promise<GetResultResponse> {
  const { data, error } = await supabase.functions.invoke('get-quiz-result', {
    body: { guestToken, sessionId },
  })
  if (error) throw error
  return data as GetResultResponse
}
