-- supabase/migrations/002_quizzes.sql
CREATE TABLE quizzes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  title          text NOT NULL DEFAULT 'Без названия',
  description    text,
  cover_url      text,
  time_limit_sec int,
  is_published   bool NOT NULL DEFAULT false,
  -- JSONB default includes show_stop_button — required by NAV-01 (UI-SPEC)
  -- and shuffle_answers — required by QuizSettings interface
  settings       jsonb NOT NULL DEFAULT '{"allow_back":true,"show_stop_button":true,"shuffle_questions":false,"shuffle_answers":false}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON quizzes (owner_id);
CREATE INDEX ON quizzes (is_published) WHERE is_published = true;
