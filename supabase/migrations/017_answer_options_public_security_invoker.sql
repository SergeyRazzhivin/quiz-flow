-- Recreate answer_options_public with SECURITY INVOKER (the secure default).
--
-- The original CREATE VIEW in migration 003 had no explicit security clause, so
-- Postgres defaulted to SECURITY DEFINER (view runs as the owner, not the caller).
-- Supabase flagged this as a Critical advisory because SECURITY DEFINER views bypass
-- the caller's RLS policies.
--
-- Safe to switch: all reads of this view go through Edge Functions that use
-- service_role, which already bypasses RLS. No anon client queries the view directly.
-- SECURITY INVOKER means the view runs as the caller — anon callers still can't read
-- answer_options (no anon RLS policy exists), and service_role callers still can.

DROP VIEW IF EXISTS answer_options_public;

CREATE VIEW answer_options_public
  WITH (security_invoker = true)
AS
  SELECT id, question_id, body, order_index
  FROM answer_options;
