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
