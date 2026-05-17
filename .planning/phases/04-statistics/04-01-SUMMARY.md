---
phase: 04-statistics
plan: 01
subsystem: database
tags: [postgres, rpc, security-definer, supabase, vue3, typescript]

requires:
  - phase: 02-taking
    provides: quiz_sessions, session_answers, quiz_access tables with owner RLS (migration 009)
  - phase: 03-ai
    provides: migration 012 precedent for SECURITY DEFINER + GRANT pattern

provides:
  - get_quiz_stats SECURITY DEFINER RPC returning totalAttempts/finishedCount/avgScore/totalQuestions/perPerson
  - get_quiz_accuracy SECURITY DEFINER RPC returning per-question accuracy_percent (Pro only)
  - formatPercent, formatScore, formatShortDateTime helpers in 6-shared/lib/format.ts
  - ProgressBar size prop ('sm' default h-1, 'md' h-2) in 6-shared/ui/ProgressBar.vue

affects: [04-02-ui-slice, billing, any feature reading quiz stats]

tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER RPC with mandatory first-statement ownership check (owner_id IS DISTINCT FROM auth.uid())"
    - "GRANT EXECUTE TO authenticated only — no anon grant"
    - "DISTINCT ON (quiz_access_id) ORDER BY finished_at DESC for latest-per-taker aggregation"
    - "LEFT JOIN LATERAL for per-question correctness without shipping is_correct to client"

key-files:
  created:
    - supabase/migrations/013_quiz_stats_rpc.sql
  modified:
    - src/6-shared/lib/format.ts
    - src/6-shared/ui/ProgressBar.vue

key-decisions:
  - "totalQuestions included in get_quiz_stats payload (RESEARCH open question #1) — avoids second query from UI"
  - "answer_options.is_correct read only inside RPC body, never a key in returned JSONB (T-04-02)"
  - "D-03: completion rate inputs (totalAttempts/finishedCount) span ALL sessions, not latest-per-person"
  - "D-04: avgScore and accuracy_percent computed from latest-finished-per-taker sessions only"

patterns-established:
  - "RPC ownership gate: SELECT owner_id INTO v_owner_id; IF IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'unauthorized'"
  - "formatPercent(null) → '—'; formatScore(null, N) → '—' for graceful null display"
  - "ProgressBar size prop backward-compatible: existing callers get h-1 (sm default)"

requirements-completed: [STATS-01, STATS-02, STATS-03]

duration: 15min
completed: 2026-05-18
---

# Phase 4 Plan 01: Statistics Data Layer Summary

**Two SECURITY DEFINER Postgres RPCs (get_quiz_stats + get_quiz_accuracy) with ownership gates, plus formatPercent/formatScore/formatShortDateTime helpers and ProgressBar size prop for the stats UI**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-18T00:00:00Z
- **Completed:** 2026-05-18
- **Tasks completed:** 2 of 3 (Task 3 is a blocking human checkpoint — push to live DB)
- **Files modified:** 3

## Accomplishments

- Migration 013 defines `get_quiz_stats` and `get_quiz_accuracy` as SECURITY DEFINER STABLE RPCs; each first-statement ownership check raises 'unauthorized' for non-owners (T-04-01 mitigated)
- `get_quiz_stats` aggregates D-02/D-03/D-04 correctly: totalAttempts/finishedCount over ALL sessions, avgScore/perPerson from DISTINCT ON (quiz_access_id) latest-finished; includes totalQuestions
- `get_quiz_accuracy` uses LEFT JOIN LATERAL to compute per-question accuracy_percent without ever returning `answer_options.is_correct` in the payload (T-04-02 mitigated)
- Both RPCs GRANT EXECUTE TO authenticated only; no anon grant (T-04-03 mitigated)
- `format.ts` extended with three locale-aware helpers; `ProgressBar.vue` extended with backward-compatible `size` prop; vue-tsc passes clean

## Task Commits

1. **Task 1: Migration 013 — get_quiz_stats and get_quiz_accuracy RPCs** - `561e954` (feat)
2. **Task 2: Add format helpers and extend ProgressBar** - `35b9665` (feat)
3. **Task 3: Push migration 013 to live DB** - BLOCKED (checkpoint:human-verify)

## Files Created/Modified

- `supabase/migrations/013_quiz_stats_rpc.sql` — two SECURITY DEFINER RPCs with ownership checks and GRANTs
- `src/6-shared/lib/format.ts` — added formatPercent, formatScore, formatShortDateTime
- `src/6-shared/ui/ProgressBar.vue` — added optional size prop ('sm' | 'md')

## Decisions Made

- `totalQuestions` included in `get_quiz_stats` payload to avoid a second client query (RESEARCH open question #1 resolved)
- `tsconfig.app.json` not found in project — used `tsconfig.json` for vue-tsc check (project uses single tsconfig)

## Deviations from Plan

None - plan executed exactly as written (Tasks 1 and 2). Task 3 is the planned blocking checkpoint.

## Issues Encountered

- Plan verify command referenced `tsconfig.app.json` which does not exist in this project; used `tsconfig.json` instead — type check passed cleanly.

## User Setup Required

**Task 3 is a blocking human checkpoint.** To complete this plan:

1. Run `supabase db push` to apply migration 013_quiz_stats_rpc.sql to the linked Supabase project.
2. Verify in the Supabase SQL editor: `SELECT proname FROM pg_proc WHERE proname IN ('get_quiz_stats','get_quiz_accuracy');` should return 2 rows.
3. Confirm a call for a quiz you do NOT own raises 'unauthorized'.
4. Reply "approved" to resume plan 04-02.

## Known Stubs

None.

## Threat Flags

None — all threats in the plan's threat model are mitigated by the implemented ownership checks and GRANT constraints.

## Next Phase Readiness

- Migration 013 is committed and ready to push
- `format.ts` helpers and `ProgressBar` size prop are ready for plan 04-02 (UI slice)
- Blocker: plan 04-02 cannot be verified until migration 013 is live in the database (RPCs must exist for runtime calls to succeed)

---

## Self-Check

- [x] `supabase/migrations/013_quiz_stats_rpc.sql` — created (commit 561e954)
- [x] `src/6-shared/lib/format.ts` — modified (commit 35b9665)
- [x] `src/6-shared/ui/ProgressBar.vue` — modified (commit 35b9665)
- [x] Both commits verified in git log
- [x] formatPercent, formatScore, formatShortDateTime exported
- [x] ProgressBar has size prop

## Self-Check: PASSED

---
*Phase: 04-statistics*
*Completed: 2026-05-18*
