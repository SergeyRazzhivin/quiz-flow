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
export interface StartSessionResponse {
  sessionId:  string
  started_at: string
  resumed:    boolean
  answers:    { question_id: string; selected_option_ids: string[] }[]
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
 * Returns sessionId, server-authoritative started_at, resumed flag, and stored answers.
 */
export async function invokeStartSession(guestToken: string): Promise<StartSessionResponse> {
  const { data, error } = await supabase.functions.invoke('start-quiz-session', {
    body: { guestToken },
  })
  if (error) throw error
  return data as StartSessionResponse
}

// NOTE: Additional wrappers for upsert-session-answer, submit-quiz-answers, and get-quiz-result
// will be added in plans 02-04 and 02-05.
