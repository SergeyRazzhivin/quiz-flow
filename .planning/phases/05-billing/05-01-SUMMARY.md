---
phase: 05-billing
plan: 01
subsystem: billing
tags: [database, migration, rls, triggers, rpc, freemium]
status: checkpoint-paused
requires: [subscriptions, quizzes, questions, profiles]
provides:
  - ai_generations table
  - get_effective_plan() RPC
  - check_quiz_limit() / check_question_limit() triggers
  - get_ai_window_start() RPC
  - get_usage() RPC
affects: [quizzes, questions, subscriptions]
tech-stack:
  added: []
  patterns:
    - SECURITY DEFINER + SET search_path = public for all enforcement functions
    - BEFORE INSERT triggers as primary DB-level enforcement barrier (D-09)
    - lazy-by-date plan revocation, no cron (D-05)
key-files:
  created:
    - supabase/migrations/015_billing_enforcement.sql
  modified: []
decisions:
  - "D-05: effective plan resolved lazily by date — 'pro' only if subscription active AND current_period_end > now()"
  - "D-06: subscriptions is the single source of truth for plan; profiles.plan not consulted"
  - "D-09: BEFORE INSERT triggers enforce limits even against direct client DB queries"
  - "D-12: AI limit uses a rolling 30-day window anchored to subscription/registration date"
  - "D-14: Free AI limit = 10/month, Pro = 30/month"
metrics:
  duration: ~5m
  completed: "2026-05-18"
  tasks: "2 of 3 (Task 3 is a blocking human-action checkpoint)"
---

# Phase 5 Plan 01: Billing DB Enforcement Spine Summary

DB-level freemium enforcement: `ai_generations` log table, lazy-by-date `get_effective_plan()` resolver, `BEFORE INSERT` limit triggers on quizzes/questions, and the `get_ai_window_start()` / `get_usage()` usage RPCs — all in migration `015_billing_enforcement.sql`.

## What Was Built

- **`supabase/migrations/015_billing_enforcement.sql`** — single migration file containing:
  - `subscriptions_user_id_unique` UNIQUE constraint (idempotent `DO` block, guards pre-existing constraint).
  - `subscriptions.created_at` column via `ADD COLUMN IF NOT EXISTS` (migration 006 omitted it; needed as the AI-window anchor).
  - `ai_generations` table (`id`, `user_id` FK→profiles ON DELETE CASCADE, `created_at`), RLS enabled, `(user_id, created_at DESC)` index.
  - `owner_own_ai_generations` RLS policy — `TO authenticated`, `(SELECT auth.uid())`, **no anon policy** (T-05-04).
  - `get_effective_plan(uuid)` — returns `'pro'` only for an active, unexpired subscription, else `'free'` (D-05, D-06).
  - `check_quiz_limit()` + `enforce_quiz_limit` trigger — blocks the 4th quiz for Free owners; raises `QUIZ_LIMIT_EXCEEDED`.
  - `check_question_limit()` + `enforce_question_limit` trigger — blocks the 11th question for Free owners; raises `QUESTION_LIMIT_EXCEEDED`.
  - `get_ai_window_start(uuid)` — rolling-30-day window anchor (D-12).
  - `get_usage()` — returns `{plan, quizzes_used, quizzes_limit, ai_used, ai_limit, period_end}` json (D-13); Free ai_limit 10, Pro 30 (D-14).
  - All four functions `SECURITY DEFINER` + `SET search_path = public` (Pitfall 3). `GRANT EXECUTE ... TO authenticated` only — no anon grant.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1+2  | Migration 015 (ai_generations table + resolver, triggers + usage RPCs) | ba662be | supabase/migrations/015_billing_enforcement.sql |

Tasks 1 and 2 both target the same single migration file; it was written complete and committed as one atomic `feat` commit. Both `<verify>` automated checks passed (`get_effective_plan` count = 5; token count = 10).

## Deviations from Plan

None — plan executed exactly as written.

## CHECKPOINT REACHED

**Type:** human-action (gate: blocking-human)
**Plan:** 05-01
**Progress:** 2 of 3 tasks complete

### Current Task

**Task 3:** [BLOCKING] Push billing migration to the database
**Status:** blocked — `supabase db push` cannot be automated.

### Checkpoint Details

Migration `015_billing_enforcement.sql` is written and committed but **not yet applied** to the live database. A human must apply it:

1. In a TTY shell: `supabase db push`
   Non-TTY: set `SUPABASE_ACCESS_TOKEN`, then `supabase db push`.
2. Confirm the CLI reports migration `015_billing_enforcement.sql` applied with no errors.
3. Verify enforcement is live — in the Supabase SQL editor or psql:
   `SELECT get_effective_plan('00000000-0000-0000-0000-000000000000'::uuid);` → expect `free`.

### Awaiting

Resume signal: type **"applied"** once `supabase db push` succeeds and `get_effective_plan` returns `'free'`, or paste the error.

## Self-Check: PASSED

- FOUND: supabase/migrations/015_billing_enforcement.sql
- FOUND: commit ba662be
