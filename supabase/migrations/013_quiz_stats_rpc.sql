-- supabase/migrations/013_quiz_stats_rpc.sql
-- Phase 4 (Statistics) data layer: two SECURITY DEFINER RPCs that pre-aggregate
-- quiz statistics inside the database. Aggregation lives in the DB (RESEARCH D-07)
-- to avoid the N+1 anti-pattern (PITFALLS §8.2) and keep answer_options.is_correct
-- server-side only (threats T-04-02).
-- References: STATS-01, STATS-02, STATS-03, RESEARCH Pattern 1.

-- ---------------------------------------------------------------------------
-- get_quiz_stats(p_quiz_id uuid) → jsonb
-- Returns summary + per-person aggregation in one JSONB payload.
-- Called for all owners (Free + Pro) — covers STATS-01 and STATS-02.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_quiz_stats(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Authorization: first statement must verify caller owns this quiz (RESEARCH Pitfall 2).
  -- SECURITY DEFINER bypasses RLS, so we enforce ownership manually.
  SELECT owner_id INTO v_owner_id
  FROM quizzes WHERE id = p_quiz_id;

  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN jsonb_build_object(
    -- D-03: totalAttempts = all started quiz_sessions for this quiz
    'totalAttempts',    (SELECT COUNT(*) FROM quiz_sessions WHERE quiz_id = p_quiz_id),
    -- D-03: finishedCount = sessions with finished_at IS NOT NULL (completion-rate numerator)
    'finishedCount',    (SELECT COUNT(*) FROM quiz_sessions WHERE quiz_id = p_quiz_id AND finished_at IS NOT NULL),
    -- D-02 / D-04: avgScore over latest finished attempt per taker (DISTINCT ON quiz_access_id)
    'avgScore',         (
      SELECT AVG(score) FROM (
        SELECT DISTINCT ON (quiz_access_id) score
        FROM quiz_sessions
        WHERE quiz_id = p_quiz_id AND finished_at IS NOT NULL
        ORDER BY quiz_access_id, finished_at DESC
      ) latest
    ),
    -- RESEARCH open question #1: include totalQuestions so client can render "X из Y"
    'totalQuestions',   (SELECT COUNT(*) FROM questions WHERE quiz_id = p_quiz_id),
    -- D-02: per-person table — one row per taker, their latest finished attempt
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

-- Only authenticated (owner) role may call this function. No anon grant (T-04-03).
GRANT EXECUTE ON FUNCTION get_quiz_stats(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- get_quiz_accuracy(p_quiz_id uuid) → jsonb
-- Returns per-question accuracy computed from latest finished attempts only.
-- Called ONLY for Pro owners — D-06 gate is enforced in the store (not here).
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
  -- Authorization: same ownership check as get_quiz_stats (RESEARCH Pitfall 2).
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
        -- D-04: % of takers who answered this question correctly.
        -- CR-01: correctness is aggregated to ONE boolean per (question, taker)
        -- inside the LATERAL below, so each taker contributes exactly one row to
        -- the count regardless of how many options they selected. Denominator is
        -- "takers who answered this question" (COUNT of per_taker rows).
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE per_taker.is_correct)
               / NULLIF(COUNT(per_taker.quiz_access_id), 0),
          1
        ) AS accuracy_percent
      FROM questions q
      -- One row per taker who answered this question, with a single correctness
      -- boolean — the unnest fan-out is fully contained inside this subquery.
      LEFT JOIN LATERAL (
        SELECT
          latest.quiz_access_id,
          bool_or(ao.is_correct) AS is_correct
        FROM (
          -- Latest finished session per taker for this quiz
          SELECT DISTINCT ON (quiz_access_id) id AS session_id, quiz_access_id
          FROM quiz_sessions
          WHERE quiz_id = p_quiz_id AND finished_at IS NOT NULL
          ORDER BY quiz_access_id, finished_at DESC
        ) latest
        JOIN session_answers sa
          ON sa.session_id = latest.session_id AND sa.question_id = q.id
        -- Whether any selected option is correct (is_correct stays server-side)
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

-- Only authenticated (owner) role may call this function. No anon grant (T-04-03).
GRANT EXECUTE ON FUNCTION get_quiz_accuracy(uuid) TO authenticated;
