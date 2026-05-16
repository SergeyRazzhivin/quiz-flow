-- supabase/migrations/007_rls_policies.sql
-- RLS dual-policy set: owner (authenticated) + guest (anon, published content only)
-- Performance: always use (SELECT auth.uid()) not bare auth.uid()
-- This enables Postgres initPlan optimization — evaluated once per query, not per row.

-- ─── profiles ─────────────────────────────────────────────────────────────────
-- Policy already created in 001_init_profiles.sql (owner_own_profile).
-- No anon access to profiles.

-- ─── quizzes ──────────────────────────────────────────────────────────────────
CREATE POLICY "owner_manage_quizzes"
  ON quizzes TO authenticated
  USING  ( owner_id = (SELECT auth.uid()) )
  WITH CHECK ( owner_id = (SELECT auth.uid()) );

CREATE POLICY "anon_read_published_quizzes"
  ON quizzes FOR SELECT TO anon
  USING ( is_published = true );

-- ─── questions ────────────────────────────────────────────────────────────────
CREATE POLICY "owner_manage_questions"
  ON questions TO authenticated
  USING (
    quiz_id IN (SELECT id FROM quizzes WHERE owner_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    quiz_id IN (SELECT id FROM quizzes WHERE owner_id = (SELECT auth.uid()))
  );

CREATE POLICY "anon_read_questions_for_published"
  ON questions FOR SELECT TO anon
  USING (
    quiz_id IN (SELECT id FROM quizzes WHERE is_published = true)
  );

-- ─── answer_options ───────────────────────────────────────────────────────────
CREATE POLICY "owner_manage_answer_options"
  ON answer_options TO authenticated
  USING (
    question_id IN (
      SELECT q.id FROM questions q
      JOIN quizzes qz ON qz.id = q.quiz_id
      WHERE qz.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    question_id IN (
      SELECT q.id FROM questions q
      JOIN quizzes qz ON qz.id = q.quiz_id
      WHERE qz.owner_id = (SELECT auth.uid())
    )
  );
-- NO anon SELECT on answer_options directly — use answer_options_public view only
-- answer_options_public view (created in 003) excludes is_correct column

-- ─── quiz_access ──────────────────────────────────────────────────────────────
CREATE POLICY "owner_manage_quiz_access"
  ON quiz_access TO authenticated
  USING (
    quiz_id IN (SELECT id FROM quizzes WHERE owner_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    quiz_id IN (SELECT id FROM quizzes WHERE owner_id = (SELECT auth.uid()))
  );
-- NO anon policy on quiz_access — token validation is Edge Function only (Phase 2)

-- ─── quiz_sessions ────────────────────────────────────────────────────────────
-- Sessions are created and managed by Edge Functions using service_role key (Phase 2).
-- No direct client access — policies added in Phase 2.

-- ─── session_answers ──────────────────────────────────────────────────────────
-- Answers are managed by Edge Functions using service_role key (Phase 2).
-- No direct client access — policies added in Phase 2.

-- ─── subscriptions ────────────────────────────────────────────────────────────
CREATE POLICY "owner_manage_subscriptions"
  ON subscriptions TO authenticated
  USING  ( user_id = (SELECT auth.uid()) )
  WITH CHECK ( user_id = (SELECT auth.uid()) );
-- No anon access to subscriptions.

-- ─── Storage: covers bucket ───────────────────────────────────────────────────
-- Bucket: public = true (cover images are displayed to anon users on /)
-- Create via SQL (run after migrations):
--   INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true)
--   ON CONFLICT (id) DO UPDATE SET public = true;
--
-- Storage INSERT policy: path must start with auth.uid() to prevent cross-user writes
-- Policy name: "covers_owner_insert"
-- Definition (storage.objects):
--   bucket_id = 'covers'
--   AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
--
-- Note: CREATE POLICY on storage.objects requires the storage schema.
-- The covers bucket and its policy are created via the Supabase Dashboard or CLI
-- (supabase storage create-bucket covers --public) after migrations are applied.
-- See SUMMARY.md for the manual step required after supabase db push.
