-- supabase/migrations/011_session_answers_unique.sql
-- One answer row per (session, question): required for upsert-session-answer's
-- ON CONFLICT (session_id, question_id) and correct domain modelling.

CREATE UNIQUE INDEX session_answers_session_question_uniq
  ON session_answers (session_id, question_id);
