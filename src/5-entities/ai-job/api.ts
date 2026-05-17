// Thin typed wrappers for the AI generation slice.
// invokeGenerateQuiz — calls the owner-authenticated ai-generate-quiz Edge Function
//   (auth header attached automatically by supabase.functions.invoke).
// fetchAiJob — polls one ai_jobs row directly via PostgREST; the owner-SELECT RLS
//   (migration 012) scopes the read to the caller. There is NO ai-job-status EF.

import { supabase } from '@shared/api/supabase'
import type { AiJob } from './model'

// Request body for the ai-generate-quiz EF (contract from plan 03-01).
export interface GenerateQuizPayload {
  title:             string
  sourceText?:       string
  fileBase64?:       string
  fileName?:         string
  clarifyingPrompt:  string
  questionCount:     number
  difficulty:        'easy' | 'medium' | 'hard'
  difficultyPrompt?: string
}

/**
 * Error thrown by `invokeGenerateQuiz` when the Edge Function rejects the
 * request. WR-02 / WR-03: it carries the EF's `error` code string so the
 * wizard can branch its message — a client-correctable 400
 * (`QUESTION_COUNT_EXCEEDED`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`) must
 * be distinguishable from a generic AI failure.
 */
export class GenerateQuizError extends Error {
  /** The EF's `error` code string, or null when it could not be recovered. */
  readonly code: string | null
  /** HTTP status of the EF response, when known. */
  readonly status: number | null

  constructor(code: string | null, status: number | null) {
    super(code ?? 'GENERATE_QUIZ_FAILED')
    this.name = 'GenerateQuizError'
    this.code = code
    this.status = status
  }
}

/**
 * Best-effort: pull the EF's `{ error }` string out of a failed
 * `functions.invoke` result. On a non-2xx the supabase-js client surfaces a
 * `FunctionsHttpError` whose original `Response` is on `error.context` — the
 * JSON body (and thus the 400 error code) is only reachable from there.
 */
async function extractEfErrorCode(error: unknown): Promise<{
  code: string | null
  status: number | null
}> {
  const ctx = (error as { context?: unknown } | null)?.context
  if (ctx instanceof Response) {
    try {
      const body = await ctx.clone().json()
      const code = typeof body?.error === 'string' ? body.error : null
      return { code, status: ctx.status }
    } catch {
      return { code: null, status: ctx.status }
    }
  }
  return { code: null, status: null }
}

/**
 * Invoke ai-generate-quiz — the EF inserts a pending ai_jobs row, runs the
 * OpenAI pipeline in the background (EdgeRuntime.waitUntil), and returns
 * { jobId } at HTTP 202. An over-plan questionCount or file size is rejected
 * server-side with HTTP 400 (the client's plan checks are UX only).
 *
 * @throws {GenerateQuizError} carrying the EF's `error` code on failure.
 */
export async function invokeGenerateQuiz(
  p: GenerateQuizPayload,
): Promise<{ jobId: string }> {
  const { data, error } = await supabase.functions.invoke('ai-generate-quiz', {
    body: p,
  })
  if (error) {
    // WR-02 / WR-03: surface the EF's error code so the wizard can show a
    // specific, correctable message instead of a generic AI-failure card.
    const { code, status } = await extractEfErrorCode(error)
    throw new GenerateQuizError(code, status)
  }
  return data as { jobId: string }
}

/**
 * Poll a single ai_jobs row. The owner-SELECT RLS (012) scopes the read to the
 * caller — an owner can only read their own jobs.
 *
 * `ai_jobs` is part of the generated `database.types.ts` (regenerated after
 * migration 012), so the normally-typed client is used here — no cast widening.
 */
export async function fetchAiJob(jobId: string): Promise<AiJob> {
  const { data, error } = await supabase
    .from('ai_jobs')
    .select('id, status, stage, error, quiz_id')
    .eq('id', jobId)
    .single()
  if (error) throw error
  return data
}
