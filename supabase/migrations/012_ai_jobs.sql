-- supabase/migrations/012_ai_jobs.sql
-- Phase 3 (AI Wizard) schema: the ai_jobs tracking table.
-- The ai-generate-quiz Edge Function returns a job id in <200 ms and runs the OpenAI
-- pipeline in EdgeRuntime.waitUntil(); ai_jobs is the row the owner polls for progress.
-- References: AI-SPEC §4 (State Management) + §7 (monitoring columns), RESEARCH Pattern 2.

-- Enum types declared before the table (003_questions_answers.sql convention).
CREATE TYPE ai_job_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE ai_job_stage  AS ENUM ('reading', 'generating', 'saving', 'done');

CREATE TABLE ai_jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  status            ai_job_status NOT NULL DEFAULT 'pending',
  stage             ai_job_stage  NOT NULL DEFAULT 'reading',
  -- Generic failure code on failure (D-11); nullable while pending/completed.
  error             text,
  -- D-03: the quizzes row is created ONLY after a successful generation, so this
  -- stays NULL until success; ON DELETE SET NULL keeps the job row if the quiz is removed.
  quiz_id           uuid REFERENCES quizzes ON DELETE SET NULL,
  -- AI-SPEC §7 monitoring columns — populated by the background task for cost/drift signals.
  attempt_count     int,
  finish_reason     text,
  failure_reason    text,
  prompt_tokens     int,
  completion_tokens int,
  duration_ms       int,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON ai_jobs (owner_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
-- ai_jobs is written EXCLUSIVELY by the ai-generate-quiz Edge Function using the
-- service_role key (which bypasses RLS). No INSERT/UPDATE policy for authenticated
-- and no anon policy at all — mirrors the quiz_sessions/session_answers comments in
-- 007_rls_policies.sql. The only client access is the owner reading their own jobs.
CREATE POLICY "owner_read_ai_jobs"
  ON ai_jobs FOR SELECT TO authenticated
  USING ( owner_id = (SELECT auth.uid()) );
