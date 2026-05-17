-- supabase/migrations/003_questions_answers.sql
CREATE TYPE question_type AS ENUM ('single', 'multiple');

CREATE TABLE questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid NOT NULL REFERENCES quizzes ON DELETE CASCADE,
  body        text NOT NULL DEFAULT '',
  type        question_type NOT NULL DEFAULT 'single',
  order_index int NOT NULL DEFAULT 0,
  is_required bool NOT NULL DEFAULT false
  -- NO UNIQUE constraint on (quiz_id, order_index) — batch reorder requires duplicates mid-transaction
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON questions (quiz_id);

CREATE TABLE answer_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions ON DELETE CASCADE,
  body        text NOT NULL DEFAULT '',
  is_correct  bool NOT NULL DEFAULT false,
  order_index int NOT NULL DEFAULT 0
);

ALTER TABLE answer_options ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON answer_options (question_id);

-- Plain view exposing answer_options WITHOUT is_correct so guest-facing reads
-- never see the correct answers (Phase 2 concern, created now for schema completeness).
-- Note: this is a plain CREATE VIEW (no security_invoker/security_definer clause) —
-- guest protection comes from answer_options having no anon RLS policy plus this
-- column-restricted view, not from view security mode.
CREATE VIEW answer_options_public AS
  SELECT id, question_id, body, order_index
  FROM answer_options;
