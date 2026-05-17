-- supabase/migrations/010_quiz_access_created_at.sql
-- Adds a creation timestamp to quiz_access so the owner's access-link list
-- can be ordered newest-first (fetchAccessLinks). Also feeds Phase 4 statistics.

ALTER TABLE quiz_access ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
