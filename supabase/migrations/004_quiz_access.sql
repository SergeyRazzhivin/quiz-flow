-- supabase/migrations/004_quiz_access.sql
-- Phase 2 table — created now for schema completeness.
-- quiz_access stores individual access tokens for quiz-takers (no Supabase Auth required).
CREATE TABLE quiz_access (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       uuid NOT NULL REFERENCES quizzes ON DELETE CASCADE,
  token         uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  login         text NOT NULL,
  password_hash text NOT NULL,
  label         text,
  expires_at    timestamptz
);

ALTER TABLE quiz_access ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON quiz_access (quiz_id);
CREATE INDEX ON quiz_access (token);
