// Domain types for AI generation jobs (ai_jobs table, migration 012).
// The wizard polls a job row directly via owner-SELECT RLS — there is no
// ai-job-status Edge Function (RESEARCH Assumption A2 / Pattern 2).

export type AiJobStatus = 'pending' | 'completed' | 'failed'
export type AiJobStage = 'reading' | 'generating' | 'saving' | 'done'

export interface AiJob {
  id:      string
  status:  AiJobStatus
  stage:   AiJobStage
  error:   string | null
  quiz_id: string | null
}
