-- supabase/migrations/005_sessions.sql
-- Phase 2 tables — created now for schema completeness.
-- quiz_sessions tracks a guest's quiz-taking session.
CREATE TABLE quiz_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_access_id uuid NOT NULL REFERENCES quiz_access ON DELETE CASCADE,
  quiz_id        uuid NOT NULL REFERENCES quizzes ON DELETE CASCADE,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  score          int
);

ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON quiz_sessions (quiz_access_id);
CREATE INDEX ON quiz_sessions (quiz_id);

-- session_answers stores each answer a guest selected during a session.
CREATE TABLE session_answers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES quiz_sessions ON DELETE CASCADE,
  question_id         uuid NOT NULL REFERENCES questions ON DELETE CASCADE,
  selected_option_ids uuid[] NOT NULL DEFAULT '{}'
);

ALTER TABLE session_answers ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON session_answers (session_id);
