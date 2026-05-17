-- supabase/migrations/009_phase2_schema.sql
-- Phase 2 schema changes: score numeric, allow_retake default + backfill, duplicate-session guard, owner RLS.
-- References: CONTEXT.md D-17, D-18, D-03 + PITFALLS.md §3.3 + RESEARCH.md "Migration 009".

-- D-18: alter score column from int to numeric for fractional partial-credit scores
ALTER TABLE quiz_sessions ALTER COLUMN score TYPE numeric USING score::numeric;

-- D-03: update quizzes.settings default to include allow_retake
ALTER TABLE quizzes ALTER COLUMN settings SET DEFAULT
  '{"allow_back":true,"show_stop_button":true,"shuffle_questions":false,"shuffle_answers":false,"allow_retake":false}'::jsonb;

-- Pitfall 7: backfill existing Phase 1 rows that lack the allow_retake key
UPDATE quizzes
SET settings = settings || '{"allow_retake":false}'::jsonb
WHERE settings->>'allow_retake' IS NULL;

-- Pitfall 3.3: partial unique index prevents duplicate active sessions per access link
CREATE UNIQUE INDEX ON quiz_sessions (quiz_access_id) WHERE finished_at IS NULL;

-- Owner RLS for quiz_sessions — Phase 1 deferred these (see 007_rls_policies.sql comments)
CREATE POLICY "owner_read_sessions"
  ON quiz_sessions FOR SELECT TO authenticated
  USING (
    quiz_id IN (SELECT id FROM quizzes WHERE owner_id = (SELECT auth.uid()))
  );

-- Owner RLS for session_answers — Phase 1 deferred these
CREATE POLICY "owner_read_session_answers"
  ON session_answers FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT qs.id FROM quiz_sessions qs
      JOIN quizzes qz ON qz.id = qs.quiz_id
      WHERE qz.owner_id = (SELECT auth.uid())
    )
  );
