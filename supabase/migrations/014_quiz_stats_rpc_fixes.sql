-- supabase/migrations/014_quiz_stats_rpc_fixes.sql
-- Phase 4 code-review fixes for the statistics RPCs introduced in migration 013.
-- Migration 013 was already applied to existing databases, so editing it in place
-- does not re-run on `supabase db push` (migrations are tracked by version, not
-- content). This migration re-defines both functions with the corrected bodies.
-- CREATE OR REPLACE is idempotent, so this is safe on fresh and existing databases.
--
-- Fixes:
--   CR-01 — get_quiz_accuracy join fan-out: correctness is now aggregated to one
--           boolean per (question, taker) before counting, so accuracy_percent can
--           no longer exceed 100% and multi-select takers are not over-weighted.
--   CR-02 — jsonb_agg over an empty set returns SQL NULL; COALESCE(..., '[]') keeps
--           perPerson / accuracy payloads as empty arrays.
--   WR-02 — perPerson rows now expose quiz_access_id for a stable client-side key.

-- ---------------------------------------------------------------------------
-- get_quiz_stats(p_quiz_id uuid) → jsonb
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_quiz_stats(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM quizzes WHERE id = p_quiz_id;

  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN jsonb_build_object(
    'totalAttempts',    (SELECT COUNT(*) FROM quiz_sessions WHERE quiz_id = p_quiz_id),
    'finishedCount',    (SELECT COUNT(*) FROM quiz_sessions WHERE quiz_id = p_quiz_id AND finished_at IS NOT NULL),
    'avgScore',         (
      SELECT AVG(score) FROM (
        SELECT DISTINCT ON (quiz_access_id) score
        FROM quiz_sessions
        WHERE quiz_id = p_quiz_id AND finished_at IS NOT NULL
        ORDER BY quiz_access_id, finished_at DESC
      ) latest
    ),
    'totalQuestions',   (SELECT COUNT(*) FROM questions WHERE quiz_id = p_quiz_id),
    -- CR-02: COALESCE so a quiz with zero finished sessions returns [] not NULL.
    'perPerson',        (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT DISTINCT ON (qs.quiz_access_id)
          qs.quiz_access_id,
          qa.label         AS name,
          qs.score,
          qs.finished_at
        FROM quiz_sessions qs
        JOIN quiz_access qa ON qa.id = qs.quiz_access_id
        WHERE qs.quiz_id = p_quiz_id AND qs.finished_at IS NOT NULL
        ORDER BY qs.quiz_access_id, qs.finished_at DESC
      ) t
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_stats(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- get_quiz_accuracy(p_quiz_id uuid) → jsonb
-- answer_options.is_correct is used only inside this function body and is NEVER
-- a key in the returned payload (T-04-02).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_quiz_accuracy(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM quizzes WHERE id = p_quiz_id;

  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- CR-02: COALESCE so a quiz with no questions / no finished sessions returns [] not NULL.
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT
        q.id             AS question_id,
        q.body,
        q.order_index,
        -- CR-01: correctness is aggregated to ONE boolean per (question, taker)
        -- inside the LATERAL below, so each taker contributes exactly one row to
        -- the count regardless of how many options they selected.
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE per_taker.is_correct)
               / NULLIF(COUNT(per_taker.quiz_access_id), 0),
          1
        ) AS accuracy_percent
      FROM questions q
      LEFT JOIN LATERAL (
        SELECT
          latest.quiz_access_id,
          bool_or(ao.is_correct) AS is_correct
        FROM (
          SELECT DISTINCT ON (quiz_access_id) id AS session_id, quiz_access_id
          FROM quiz_sessions
          WHERE quiz_id = p_quiz_id AND finished_at IS NOT NULL
          ORDER BY quiz_access_id, finished_at DESC
        ) latest
        JOIN session_answers sa
          ON sa.session_id = latest.session_id AND sa.question_id = q.id
        LEFT JOIN LATERAL unnest(sa.selected_option_ids) AS sel_id ON true
        LEFT JOIN answer_options ao ON ao.id = sel_id
        GROUP BY latest.quiz_access_id
      ) per_taker ON true
      WHERE q.quiz_id = p_quiz_id
      GROUP BY q.id, q.body, q.order_index
      ORDER BY q.order_index
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_accuracy(uuid) TO authenticated;
