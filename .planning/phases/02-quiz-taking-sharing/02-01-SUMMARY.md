---
phase: 02-quiz-taking-sharing
plan: 01
subsystem: api
tags: [supabase, edge-functions, deno, jwt, jose, bcryptjs, postgres, rls, migration]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: quiz_access / quiz_sessions / session_answers tables (migrations 004, 005), answer_options_public view (migration 003), QuizSettings type, quizzes.settings JSONB
provides:
  - "Migration 009: quiz_sessions.score is numeric (D-18), allow_retake backfilled into every quizzes.settings row, partial unique index blocking duplicate active sessions, owner RLS on quiz_sessions/session_answers"
  - "Edge Function foundation: _shared/cors.ts (corsHeaders) and _shared/jwt.ts (signGuestToken / verifyGuestToken / GuestTokenPayload, HS256, 1h TTL, GUEST_JWT_SECRET)"
  - "verify-quiz-access Edge Function: guest credential verification + signed guest token issuance, is_published-independent (D-19)"
  - "config.toml verify_jwt=false for the five guest-facing Edge Functions plus probe-bcrypt"
  - "Verified bcryptjs runs inside the Supabase Deno runtime (probe returned hashValid:true) — no PBKDF2 fallback needed"
affects: [02-02, 02-03, 02-04, 02-05, phase-3-ai-wizard, phase-4-statistics]

# Tech tracking
tech-stack:
  added: [Supabase Edge Functions (Deno), npm:jose@5, npm:bcryptjs@2, npm:@supabase/supabase-js]
  patterns:
    - "Edge Functions import shared helpers from ../_shared/ (cors, jwt)"
    - "Guest auth via custom HS256 JWT signed with a dedicated GUEST_JWT_SECRET (not SUPABASE_JWT_SECRET)"
    - "Guest-facing Edge Functions set verify_jwt=false in config.toml; service_role client hand-filters sensitive columns"
    - "Identical 401 message for bad-token and bad-password to remove the enumeration oracle"

key-files:
  created:
    - supabase/migrations/009_phase2_schema.sql
    - supabase/functions/_shared/cors.ts
    - supabase/functions/_shared/jwt.ts
    - supabase/functions/probe-bcrypt/index.ts
    - supabase/functions/verify-quiz-access/index.ts
  modified:
    - supabase/config.toml
    - src/6-shared/types/index.ts
    - src/6-shared/api/database.types.ts
    - .gitignore

key-decisions:
  - "bcryptjs verified working in the Supabase Deno runtime (probe-bcrypt returned hashValid:true) — the [ASSUMED] A1 assumption is confirmed; no PBKDF2 fallback adopted"
  - "Probe function renamed _probe-bcrypt -> probe-bcrypt — Supabase rejects function names starting with an underscore (out-of-band fix, commit 168b454)"
  - "GUEST_JWT_SECRET is a dedicated secret distinct from SUPABASE_JWT_SECRET (RESEARCH Open Question 2 / Pitfall 5)"
  - "verify-quiz-access grants access independent of is_published (D-19) and never branches on it"

patterns-established:
  - "Edge Function shared helpers: _shared/cors.ts + _shared/jwt.ts imported via relative path by every guest-facing function"
  - "Guest token: custom HS256 JWT (jose), 1h TTL, verifyGuestToken returns null on any failure (never throws)"
  - "Guest-facing Edge Functions declared with verify_jwt=false in config.toml; create-quiz-access intentionally omitted so it keeps verify_jwt=true"

requirements-completed: [TAKE-01, TAKE-02, TAKE-03, EXT-04]

# Metrics
duration: ~2 days (spanned a blocking-human checkpoint)
completed: 2026-05-17
---

# Phase 2 Plan 01: Phase 2 Server Foundation Summary

**Migration 009 (numeric score, allow_retake backfill, duplicate-session guard, owner RLS), the first Supabase Edge Functions (cors + jwt shared helpers, verify-quiz-access guest auth), and a verified bcryptjs-in-Deno runtime.**

## Performance

- **Duration:** ~2 days wall clock (Tasks 1-3 autonomous, then a blocking-human checkpoint for schema push + function deploy + secret setup)
- **Tasks:** 4 (3 auto + 1 checkpoint:human-verify)
- **Files modified:** 9 (5 created, 4 modified)
- **Completed:** 2026-05-17

## Accomplishments

- **Migration 009 applied to the remote database** via `supabase db push`: `quiz_sessions.score` is now `numeric` (D-18, fractional partial-credit), `allow_retake:false` backfilled into every `quizzes.settings` row, a partial unique index on `quiz_sessions(quiz_access_id) WHERE finished_at IS NULL` blocks duplicate active sessions, and owner RLS (`owner_read_sessions`, `owner_read_session_answers`) enables Phase 4 statistics.
- **Edge Function foundation stood up** — the project's first Edge Functions: `_shared/cors.ts` (corsHeaders) and `_shared/jwt.ts` (`signGuestToken` / `verifyGuestToken` / `GuestTokenPayload`, jose HS256, 1h TTL, reads `GUEST_JWT_SECRET`).
- **`verify-quiz-access` Edge Function** built and deployed: validates a guest's token+login+password, returns a signed guest token plus quiz metadata and questions, queries the `answer_options_public` view only (never the base table — `is_correct` never leaves the server), never returns `password_hash`, and grants access independent of `is_published` (D-19).
- **bcryptjs verified inside the Supabase Deno runtime** — the `probe-bcrypt` function returned `{"ok":true,"hashValid":true}`. The `[ASSUMED]` A1 assumption (RESEARCH Open Question 1) is confirmed; **no PBKDF2 fallback was needed** and `verify-quiz-access` keeps `npm:bcryptjs@2` as written.
- **config.toml** declares `verify_jwt=false` for all five guest-facing Edge Functions (`verify-quiz-access`, `start-quiz-session`, `upsert-session-answer`, `submit-quiz-answers`, `get-quiz-result`) plus `probe-bcrypt`; `create-quiz-access` was intentionally left out so it keeps `verify_jwt=true`.
- **`GUEST_JWT_SECRET`** set as an Edge Function secret via `supabase secrets set`; `supabase/functions/.env` added to `.gitignore`.

## Task Commits

1. **Task 1: Write migration 009 and extend QuizSettings type** — `354699e` (feat)
2. **Task 2: Build Edge Function shared helpers, config, and bcrypt probe** — `9328033` (feat)
3. **Task 3: Build the verify-quiz-access Edge Function** — `bb9bd22` (feat)
4. **Task 4: checkpoint:human-verify (blocking-human)** — passed; out-of-band fix `168b454` (rename `_probe-bcrypt` -> `probe-bcrypt`), checkpoint artifacts `c5c946f` (chore — regenerated DB types + .gitignore)

**Checkpoint pause state:** `3124655` (docs — STATE.md)
**Plan metadata:** see final docs commit.

## Files Created/Modified

- `supabase/migrations/009_phase2_schema.sql` — score->numeric, allow_retake default + backfill, partial unique index, owner RLS policies
- `supabase/functions/_shared/cors.ts` — `corsHeaders` constant for Edge Function CORS/preflight
- `supabase/functions/_shared/jwt.ts` — `signGuestToken` / `verifyGuestToken` / `GuestTokenPayload` (jose HS256, 1h TTL, `GUEST_JWT_SECRET`)
- `supabase/functions/probe-bcrypt/index.ts` — temporary verification function for the bcryptjs-in-Deno assumption
- `supabase/functions/verify-quiz-access/index.ts` — guest credential verification + guest token issuance
- `supabase/config.toml` — `verify_jwt=false` blocks for the five guest-facing functions + `probe-bcrypt`
- `src/6-shared/types/index.ts` — `QuizSettings` extended with `allow_retake: boolean`
- `src/6-shared/api/database.types.ts` — regenerated from the linked remote schema after migration 009 (`quiz_sessions.score` now `numeric`)
- `.gitignore` — added `supabase/functions/.env` (holds `GUEST_JWT_SECRET` locally)

## Decisions Made

- **bcryptjs confirmed for the Supabase Deno runtime.** The `probe-bcrypt` Edge Function round-tripped `bcrypt.hash` + `bcrypt.compare` and returned `hashValid:true`. The planned PBKDF2 (`crypto.subtle` / `jsr:@std/crypto`) fallback was therefore **not** adopted — `verify-quiz-access` and all future password flows use `npm:bcryptjs@2` as written. This resolves RESEARCH Open Question 1 / Assumption A1 and the [ASSUMED] disposition of threat T-02-06.
- **Probe function renamed `_probe-bcrypt` -> `probe-bcrypt`.** Supabase rejects Edge Function names starting with an underscore, so the deploy failed under the planned name. Fixed out-of-band on master before this resume (commit `168b454`); `config.toml` references `[functions.probe-bcrypt]`.
- **Dedicated `GUEST_JWT_SECRET`** (not `SUPABASE_JWT_SECRET`) for guest token signing, per RESEARCH Open Question 2 / Pitfall 5.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed probe-bcrypt Edge Function**
- **Found during:** Task 4 (human-verify checkpoint — function deploy)
- **Issue:** Plan named the probe function `_probe-bcrypt`; Supabase rejects Edge Function names starting with an underscore, blocking deployment.
- **Fix:** Renamed `supabase/functions/_probe-bcrypt/` -> `supabase/functions/probe-bcrypt/` and updated the `config.toml` block to `[functions.probe-bcrypt]`.
- **Files modified:** `supabase/functions/probe-bcrypt/index.ts`, `supabase/config.toml`
- **Verification:** Function deployed successfully; `curl` against `probe-bcrypt` returned `{"ok":true,"hashValid":true}`.
- **Committed in:** `168b454` (out-of-band fix landed on master before this resume)

---

**Total deviations:** 1 auto-fixed (1 blocking — naming constraint).
**Impact on plan:** The rename was a Supabase platform constraint, not a design change. No scope creep. The bcrypt probe is a temporary verification artifact; it can be removed in a later plan once Phase 2 hashing is stable.

## Issues Encountered

- **bcryptjs-in-Deno was an open research risk.** Resolved by the `probe-bcrypt` function as planned — the probe returned `hashValid:true`, confirming the runtime works. No fallback engineering was required.

## User Setup Required

External Supabase configuration was performed during the Task 4 checkpoint:
- `GUEST_JWT_SECRET` set via `supabase secrets set` (Edge Function secret) and locally in the gitignored `supabase/functions/.env`.
- Migration 009 pushed to the remote database via `supabase db push`.
- `probe-bcrypt` and `verify-quiz-access` Edge Functions deployed to the linked remote project.
- `src/6-shared/api/database.types.ts` regenerated via `supabase gen types typescript --linked`.

No further user setup is outstanding for this plan.

## Next Phase Readiness

- Phase 2 database schema is live: numeric score, `allow_retake` on every quiz, duplicate-session guard, owner RLS.
- The Edge Function runtime foundation (`_shared/cors.ts`, `_shared/jwt.ts`) and the verified bcryptjs runtime are ready for plans 02-02 through 02-05 (`start-quiz-session`, `upsert-session-answer`, `submit-quiz-answers`, `get-quiz-result`, `create-quiz-access`).
- `verify-quiz-access` is deployed and issues guest tokens — the guest-side quiz-taking UI (later plans) can build directly on it.
- The temporary `probe-bcrypt` function remains deployed; consider removing it once Phase 2 password flows are stable.

## Self-Check: PASSED

- `supabase/migrations/009_phase2_schema.sql` — FOUND
- `supabase/functions/_shared/cors.ts` — FOUND
- `supabase/functions/_shared/jwt.ts` — FOUND
- `supabase/functions/probe-bcrypt/index.ts` — FOUND
- `supabase/functions/verify-quiz-access/index.ts` — FOUND
- Commits `354699e`, `9328033`, `bb9bd22`, `168b454`, `c5c946f` — FOUND in git log

---
*Phase: 02-quiz-taking-sharing*
*Completed: 2026-05-17*
