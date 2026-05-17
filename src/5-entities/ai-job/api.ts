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
 * Invoke ai-generate-quiz — the EF inserts a pending ai_jobs row, runs the
 * OpenAI pipeline in the background (EdgeRuntime.waitUntil), and returns
 * { jobId } at HTTP 202. An over-plan questionCount or file size is rejected
 * server-side with HTTP 400 (the client's plan checks are UX only).
 */
export async function invokeGenerateQuiz(
  p: GenerateQuizPayload,
): Promise<{ jobId: string }> {
  const { data, error } = await supabase.functions.invoke('ai-generate-quiz', {
    body: p,
  })
  if (error) throw error
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
