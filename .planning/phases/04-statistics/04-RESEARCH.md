# Phase 4: Statistics - Research

**Researched:** 2026-05-17
**Domain:** Owner statistics surface — Supabase PostgREST aggregation, RLS-gated per-question accuracy, Pinia + Vue 3 FSD slice
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Statistics lives on a dedicated route `/quiz/:id/stats` (owner-only, authenticated). A "Статистика" link/button is added in two places: the quiz card on `/my` (MyQuizListPage) and the quiz editor header.

**D-02:** Multiple attempts by the same taker are separate `quiz_sessions`. The per-person result table shows **one row per taker** — their latest finished attempt. Average score is computed over those latest-attempt scores.

**D-03:** **Completion rate = finished sessions / started sessions.** Denominator is all started `quiz_sessions` (rows with `started_at`); numerator is sessions with a non-null `finished_at`. Computed over all sessions, not latest-per-person.

**D-04:** Per-question accuracy and average score are computed from **latest finished attempts only** — consistent with the per-person table.

**D-05:** Pro status is read from the existing `subscriptions` table (migration 006). Phase 4 reads it; Phase 5 populates it.

**D-06:** For a Free owner, the per-question accuracy section renders **blurred with an upgrade CTA**. The data is **not fetched / not exposed** for Free owners — gate is not purely visual.

**D-07:** Summary metrics shown as **cards with large numbers**. Per-question accuracy uses **horizontal progress bars**. Per-person results as a **comparison table**. No heavyweight chart library — bars built with Tailwind.

**D-08:** Empty state when a quiz has no attempts yet — friendly message, not zeroed-out cards.

### Claude's Discretion

- Exact Russian copy for the stats page, empty state, and upgrade CTA.
- Per-person table sorting/filtering details (default sort, whether columns are sortable).
- Whether stats are computed via a Postgres view / RPC vs client-side aggregation over RLS-protected reads.
- Visual styling within the established dark theme + orange accent design system.
- Whether to show in-progress (unfinished) attempts anywhere beyond the completion-rate denominator.

### Deferred Ideas (OUT OF SCOPE)

- Score distribution histogram (EXT-05) — v2.
- Showing per-attempt history per taker (drill-down beyond latest attempt).
- Real freemium / subscription purchase + limit enforcement — Phase 5.
- Exporting statistics (CSV/PDF) — out of scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATS-01 | Владелец может видеть общее количество попыток, процент завершений и средний балл по тесту (Free) | Summary aggregation via Postgres function; owner RLS already present on quiz_sessions (migration 009) |
| STATS-02 | Владелец может видеть таблицу результатов по каждому тестируемому (имя, балл, время завершения) (Free) | Latest-finished-per-taker query joining quiz_sessions + quiz_access.label; owner RLS permits read |
| STATS-03 | Пользователь (Pro) может видеть точность по каждому вопросу (% правильных ответов) | Requires reading answer_options.is_correct; owner may read it; Free owners must not receive accuracy numbers — gate enforced by not calling the query at all |
</phase_requirements>

---

## Summary

Phase 4 delivers a read-only statistics surface at `/quiz/:id/stats`. The data lives entirely in already-existing tables (`quiz_sessions`, `session_answers`, `answer_options`, `quiz_access`, `subscriptions`). Owner RLS was added in migration 009 so the authenticated client can read `quiz_sessions` and `session_answers` for their own quizzes directly via PostgREST — no new Edge Function is needed.

The central planning question from CONTEXT.md (D-07 discretion: Postgres view/RPC vs client-side aggregation) resolves clearly: use a **single Postgres RPC** (`get_quiz_stats`) for summary + per-person aggregation, invoked once on page mount. The RPC runs inside the DB engine where `DISTINCT ON`, `GROUP BY`, and window functions are cheap and index-friendly. Client-side aggregation would require fetching every raw row to the browser — potentially hundreds of rows for a busy quiz — before computing anything, and it re-opens the N+1 risk documented in PITFALLS §8.2.

The Pro gate (D-06) is enforced by **not calling** the per-question accuracy query at all when `isPro` is false. The client simply does not receive the data. The Free owner sees a placeholder skeleton behind a `backdrop-blur-md` scrim with an upgrade CTA.

**Primary recommendation:** One Postgres RPC migration (`013_quiz_stats_rpc.sql`) plus one new FSD feature slice (`4-features/quiz-stats/`) with a single Pinia store. The page widget (`3-widgets`) composes three section components. No new packages required.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Summary aggregation (totals, rates, avg score) | Database (Postgres RPC) | — | Multi-table aggregation with window functions is orders of magnitude more efficient in the DB than fetching raw rows to Vue |
| Per-person result table | Database (Postgres RPC) | — | `DISTINCT ON (quiz_access_id)` to find latest-finished-per-taker belongs in SQL, not JavaScript |
| Per-question accuracy | Database (Postgres RPC) | — | Requires joining session_answers + answer_options (is_correct); owner-only, Pro-gated; must be a separate RPC call that is simply not invoked for Free owners |
| Pro status read | API / PostgREST (direct) | Frontend store | Owner already has RLS access to own `subscriptions` row; no Edge Function needed |
| Pro gate enforcement | Frontend (not calling query) | — | D-06: gate is "do not fetch" — Free client never calls the accuracy RPC |
| Page rendering / data wiring | Frontend (Vue 3 + Pinia) | — | `useQuizStatsStore` drives reactive UI |
| Route protection | Frontend Router guard | — | Existing `requiresAuth` meta pattern |
| Entry-point navigation | Frontend (QuizCard + EditorHeader) | — | Add "Статистика" button to existing widgets |

---

## Standard Stack

### Core — all already in the project, no new installs

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS client | existing | PostgREST RPC call + table reads | Project singleton at `6-shared/api/supabase.ts` |
| Vue 3 + Pinia | existing | Reactive store + UI | Project standard |
| Vue Router 4 | existing | New route `/quiz/:id/stats` | Project standard |
| Tailwind CSS v4 | existing | Progress bars, blur overlay, grid layout | Project standard — D-07 explicitly bans chart library |
| lucide-vue-next | existing | Icons: BarChart3, Lock | Already used throughout |
| vue-sonner | existing | `toast.error` on failed loads | Project async-error pattern |

### Supporting — extend existing shared components

| Asset | Location | Phase 4 Change |
|-------|----------|----------------|
| `ProgressBar.vue` | `6-shared/ui/` | Add `size` prop (`sm` = h-1 existing, `md` = h-2) for accuracy bars per UI-SPEC |
| `format.ts` | `6-shared/lib/` | Add `formatPercent(n: number): string` and `formatScore(score: number, total: number): string` helpers |

### No New Packages

The phase adds zero npm dependencies. All UI building blocks (Button, Tooltip, ProgressBar, lucide icons) are already present.

**Package Legitimacy Audit:** Not applicable — no packages are installed in this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
Owner browser (authenticated JWT)
        │
        ├─ [on mount] supabase.rpc('get_quiz_stats', { quiz_id })
        │       │
        │       └─ Postgres: DISTINCT ON + GROUP BY + JOIN
        │               quiz_sessions × quiz_access (label)
        │               → { totalAttempts, completionRate, avgScore, perPerson[] }
        │
        ├─ [on mount, Pro only] supabase.rpc('get_quiz_accuracy', { quiz_id })
        │       │
        │       └─ Postgres: GROUP BY question_id + JOIN answer_options (is_correct)
        │               session_answers (latest-per-taker) × answer_options
        │               → { questionId, body, accuracyPercent }[]
        │
        └─ [on mount] supabase.from('subscriptions').select('plan,status')
                .eq('user_id', uid).maybeSingle()
                → isPro: boolean
```

### Recommended Project Structure

```
src/
├── 2-pages/
│   └── QuizStatsPage.vue           # thin assembler, ~50 lines
│
├── 3-widgets/
│   └── QuizStatsWidget.vue         # composes all three stat sections
│
├── 4-features/
│   └── quiz-stats/
│       ├── model/
│       │   └── useQuizStatsStore.ts  # Pinia store: load, isPro, state
│       └── ui/
│           ├── SummaryCards.vue      # 3 metric cards (STATS-01)
│           ├── ResultsTable.vue      # per-person table (STATS-02)
│           └── AccuracySection.vue   # bars + Pro blur overlay (STATS-03)
│
└── 6-shared/
    └── ui/
        └── ProgressBar.vue         # extend with size prop
```

Entry-point additions (existing files modified):
- `src/3-widgets/QuizEditorHeader.vue` — add "Статистика" Button (outline sm)
- `src/5-entities/quiz/ui/QuizCard.vue` — add "Статистика" Button in actions row
- `src/1-app/router/index.ts` — add `/quiz/:id/stats` route with `requiresAuth: true`

Note: SPEC.md defines this route as `/stats/:quizId`, but CONTEXT.md D-01 and the UI-SPEC specify `/quiz/:id/stats`. The CONTEXT.md decision is authoritative — use `/quiz/:id/stats`.

### Pattern 1: Postgres RPC for Aggregated Stats

**What:** Two SQL functions created in a single migration. `get_quiz_stats` returns summary + per-person in one call. `get_quiz_accuracy` returns per-question accuracy (called only for Pro owners).

**When to use:** Any time multi-table aggregation is needed server-side — avoids shipping raw rows to the client.

```sql
-- Source: Supabase RPC pattern (official docs, verified via project prior art in 007/009)
-- Migration: 013_quiz_stats_rpc.sql

CREATE OR REPLACE FUNCTION get_quiz_stats(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Authorization: verify caller owns this quiz
  SELECT owner_id INTO v_owner_id
  FROM quizzes WHERE id = p_quiz_id;

  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN jsonb_build_object(
    -- STATS-01: total = all sessions, D-03 completion rate
    'totalAttempts',    (SELECT COUNT(*) FROM quiz_sessions WHERE quiz_id = p_quiz_id),
    'finishedCount',    (SELECT COUNT(*) FROM quiz_sessions WHERE quiz_id = p_quiz_id AND finished_at IS NOT NULL),
    -- STATS-01: avg score over latest finished attempt per taker (D-02, D-04)
    'avgScore',         (
      SELECT AVG(score) FROM (
        SELECT DISTINCT ON (quiz_access_id) score
        FROM quiz_sessions
        WHERE quiz_id = p_quiz_id AND finished_at IS NOT NULL
        ORDER BY quiz_access_id, finished_at DESC
      ) latest
    ),
    -- STATS-02: per-person table — one row per taker, latest finished attempt
    'perPerson',        (
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT DISTINCT ON (qs.quiz_access_id)
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

-- GRANT: allow authenticated role to call the function
GRANT EXECUTE ON FUNCTION get_quiz_stats(uuid) TO authenticated;
```

```sql
-- Per-question accuracy — called ONLY for Pro owners (D-06 gate is in the store)
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

  RETURN (
    SELECT jsonb_agg(row_to_json(t)) FROM (
      SELECT
        q.id             AS question_id,
        q.body,
        q.order_index,
        -- % of latest-per-taker finished sessions that answered this question correctly (D-04)
        ROUND(
          100.0 * COUNT(CASE WHEN correct_answers.is_correct THEN 1 END)
               / NULLIF(COUNT(DISTINCT latest.quiz_access_id), 0),
          1
        ) AS accuracy_percent
      FROM questions q
      -- Latest finished session per taker for this quiz
      LEFT JOIN LATERAL (
        SELECT DISTINCT ON (quiz_access_id) id AS session_id, quiz_access_id
        FROM quiz_sessions
        WHERE quiz_id = p_quiz_id AND finished_at IS NOT NULL
        ORDER BY quiz_access_id, finished_at DESC
      ) latest ON true
      -- Their answers to this question
      LEFT JOIN session_answers sa
        ON sa.session_id = latest.session_id AND sa.question_id = q.id
      -- Whether any selected option is correct
      LEFT JOIN LATERAL (
        SELECT bool_or(ao.is_correct) AS is_correct
        FROM unnest(sa.selected_option_ids) AS sel_id
        JOIN answer_options ao ON ao.id = sel_id
      ) correct_answers ON true
      WHERE q.quiz_id = p_quiz_id
      GROUP BY q.id, q.body, q.order_index
      ORDER BY q.order_index
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_accuracy(uuid) TO authenticated;
```

### Pattern 2: useQuizStatsStore — store skeleton

```typescript
// Source: established Pinia composition-API pattern (ARCHITECTURE.md)
// 4-features/quiz-stats/model/useQuizStatsStore.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@shared/api/supabase'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import { toast } from 'vue-sonner'

export interface PerPersonRow {
  name:        string | null
  score:       number | null
  finished_at: string
}

export interface AccuracyRow {
  question_id:      string
  body:             string
  order_index:      number
  accuracy_percent: number | null
}

export interface QuizStats {
  totalAttempts: number
  finishedCount: number
  avgScore:      number | null
  perPerson:     PerPersonRow[]
}

export const useQuizStatsStore = defineStore('quiz-stats', () => {
  const authStore = useAuthStore()

  const stats        = ref<QuizStats | null>(null)
  const accuracy     = ref<AccuracyRow[] | null>(null)
  const isPro        = ref(false)
  const isLoading    = ref(false)
  const isLoadingPro = ref(false)
  const error        = ref<string | null>(null)

  const completionRate = computed(() => {
    if (!stats.value || stats.value.totalAttempts === 0) return 0
    return Math.round((stats.value.finishedCount / stats.value.totalAttempts) * 100)
  })

  async function loadStats(quizId: string) {
    isLoading.value = true
    error.value = null
    try {
      // Load Pro status first — determines whether accuracy fetch is triggered
      await loadProStatus()

      // Main stats RPC (STATS-01 + STATS-02)
      const { data, error: rpcErr } = await supabase.rpc('get_quiz_stats', { p_quiz_id: quizId })
      if (rpcErr) throw rpcErr
      stats.value = data as QuizStats

      // Pro-only accuracy (STATS-03) — D-06: do NOT call for Free owners
      if (isPro.value) {
        const { data: accData, error: accErr } = await supabase.rpc('get_quiz_accuracy', { p_quiz_id: quizId })
        if (accErr) throw accErr
        accuracy.value = accData as AccuracyRow[]
      }
    } catch (e) {
      error.value = 'Не удалось загрузить статистику'
      toast.error('Не удалось загрузить статистику. Проверьте подключение и попробуйте обновить страницу.')
    } finally {
      isLoading.value = false
    }
  }

  async function loadProStatus() {
    if (!authStore.user) return
    const { data } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', authStore.user.id)
      .maybeSingle()
    isPro.value = data?.plan === 'pro' && data?.status === 'active'
  }

  function $reset() {
    stats.value     = null
    accuracy.value  = null
    isPro.value     = false
    isLoading.value = false
    error.value     = null
  }

  return { stats, accuracy, isPro, isLoading, error, completionRate, loadStats, $reset }
})
```

### Pattern 3: Pro gate — skeleton bars + blur overlay

For Free owners, `AccuracySection.vue` renders the section with a CSS overlay. The underlying accuracy data is never fetched, so placeholder skeleton bars are rendered (not real data).

```vue
<!-- Source: UI-SPEC §Component & Layout Inventory + D-06 -->
<template>
  <div class="relative rounded-xl border border-neutral-800 bg-neutral-900 p-6">
    <h2 class="mb-4 text-xl font-semibold">Точность по вопросам</h2>

    <!-- Skeleton bars when not Pro (data never fetched) -->
    <template v-if="!isPro">
      <div
        v-for="i in 4"
        :key="i"
        class="mb-3 h-6 animate-pulse rounded bg-neutral-800"
      />
      <!-- Blur + CTA overlay -->
      <div class="absolute inset-0 flex flex-col items-center justify-center
                  rounded-xl backdrop-blur-md bg-neutral-950/60">
        <Lock class="mb-3 h-8 w-8 text-neutral-400" />
        <p class="mb-1 text-base font-semibold">Точность по вопросам — функция Pro</p>
        <p class="mb-4 max-w-xs text-center text-sm text-neutral-400">
          Узнайте, на каких вопросах тестируемые ошибаются чаще всего.
          Доступно на тарифе Pro.
        </p>
        <Button variant="default" size="sm" @click="router.push('/billing')">
          Перейти на Pro
        </Button>
      </div>
    </template>

    <!-- Real accuracy bars (Pro only) -->
    <template v-else>
      <!-- accuracy rows ... -->
    </template>
  </div>
</template>
```

### Pattern 4: formatPercent / formatScore helpers

```typescript
// Add to 6-shared/lib/format.ts
// Source: established format.ts pattern in project

/** Format a 0–100 percent value to a Russian-style string, e.g. 73.5 → "73,5%" */
export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(1).replace('.', ',')}%`
}

/** Format a numeric score for display, e.g. score=7.5, total=10 → "7,5 из 10" */
export function formatScore(score: number | null, totalQuestions: number): string {
  if (score === null) return '—'
  const s = score % 1 === 0 ? score.toFixed(0) : score.toFixed(1).replace('.', ',')
  return `${s} из ${totalQuestions}`
}

/**
 * Format a timestamptz to a Russian short date+time string.
 * E.g. "2026-05-17T14:32:00Z" → "17 мая, 14:32"
 */
export function formatShortDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('ru-RU', {
    day:    'numeric',
    month:  'long',
    hour:   '2-digit',
    minute: '2-digit',
  }).replace(' г.', '').replace(/(\d+\s+\w+)/, '$1,')  // "17 мая, 14:32"
}
```

### Anti-Patterns to Avoid

- **Client-side aggregation over raw rows:** fetching all `quiz_sessions` + `session_answers` rows then computing in JavaScript. Triggers PITFALLS §8.2 N+1 and ships sensitive data volume to the client unnecessarily.
- **Fetching accuracy data for Free owners and then hiding it visually:** D-06 is explicit — Free clients must not receive accuracy numbers. Never call `get_quiz_accuracy` without first confirming `isPro.value === true`.
- **Reading `answer_options.is_correct` in a client-side query:** The owner's authenticated role CAN read it, but it bypasses the server-side enforcement logic. All `is_correct` access must stay server-side inside the RPC.
- **Using `100vh` for the page shell:** use `min-h-[100dvh]` per UI-SPEC and ARCHITECTURE.md pattern.
- **Importing `useQuizStatsStore` from `2-pages` directly:** the page is a thin assembler; it mounts `QuizStatsWidget` which owns the store. The page never imports feature stores directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Latest-finished-per-taker query | JavaScript deduplication loop | `DISTINCT ON (quiz_access_id) ORDER BY finished_at DESC` in Postgres RPC | SQL optimizer uses the existing `quiz_sessions (quiz_access_id)` index |
| Per-question accuracy calculation | Nested JavaScript loops over raw rows | Postgres `get_quiz_accuracy` RPC with `LEFT JOIN LATERAL` | Correctness of partial-credit: only `answer_options.is_correct` is authoritative; this column stays server-side |
| Pro status check | Hardcoded flag or profiles.plan column | `subscriptions` table query (D-05) | Phase 5 will populate subscriptions; hardcoding breaks Phase 5 integration |
| Progress bars | Chart.js or any chart library | Tailwind `bg-orange-500` fill + `transition-all` on a `div` | D-07 explicitly bans chart library |
| Blur overlay | JavaScript show/hide toggle | CSS `backdrop-blur-md` overlay with `position: absolute inset-0` | Declarative, no DOM reflow on toggle |

**Key insight:** The DB already has all required indexes (`quiz_sessions (quiz_id)`, `quiz_sessions (quiz_access_id)`) from migrations 005 and 009. The RPC approach costs one network round-trip and returns a single JSONB payload — versus fetching N sessions × M answers and computing everything client-side.

---

## Common Pitfalls

### Pitfall 1: Fetching Accuracy Data for Free Owners (D-06 Violation)

**What goes wrong:** `useQuizStatsStore.loadStats()` always calls both RPCs; Free owner receives accuracy numbers; Pro gate is purely visual CSS blur that can be stripped.

**Why it happens:** Easy to write `Promise.all([rpc1, rpc2])` without checking Pro status.

**How to avoid:** Gate the `get_quiz_accuracy` call on `isPro.value === true`. Check Pro status before the RPC call, not after.

**Warning signs:** `accuracy.value` is non-null when `isPro.value` is false.

---

### Pitfall 2: RPC Authorization Bypass

**What goes wrong:** Postgres function is `SECURITY DEFINER` but omits the ownership check — any authenticated user can call `get_quiz_stats(any_quiz_id)` and read another owner's data.

**Why it happens:** `SECURITY DEFINER` runs as the function owner (postgres), not the calling user — RLS is bypassed inside the function body.

**How to avoid:** First statement in each RPC must verify `owner_id = auth.uid()` and raise an exception if not. See code examples above.

**Warning signs:** Function works without checking ownership; `supabase.rpc(...)` succeeds for a quiz the caller does not own.

---

### Pitfall 3: N+1 on Statistics Page (PITFALLS §8.2)

**What goes wrong:** Statistics store has nested loops with nested Supabase client calls:
```
for (session of sessions) {
  const answers = await supabase.from('session_answers').eq('session_id', session.id)
}
```

**Why it happens:** Incremental logic growth — session list loads first, then answers per session.

**How to avoid:** Use the RPC pattern above. If a flat query is preferred, use nested select:
```typescript
supabase.from('quiz_sessions').select('*, session_answers(*), quiz_access(label)').eq('quiz_id', quizId)
```

**Warning signs:** Network tab shows repeated calls to `session_answers?session_id=eq.{uuid}`.

---

### Pitfall 4: Score Display Inconsistency

**What goes wrong:** Stats page displays score differently from the result page — one shows raw numeric, the other shows percentage, confusing owners.

**Why it happens:** Separate implementation of score formatting in stats vs. result page.

**How to avoid:** Reuse / extend `format.ts` helpers. The result page (Phase 2) uses `percentage` (0–100). The stats page should use the same `formatScore(score, totalQuestions)` pattern so a score of 7.5 out of 10 reads "7,5 из 10" consistently.

**Warning signs:** `QuizResultPage` and stats table show different representations for the same raw score.

---

### Pitfall 5: `subscriptions` Row Absent for Free Users

**What goes wrong:** A newly registered user has no row in `subscriptions` (Phase 5 hasn't shipped yet and no trigger auto-inserts a free-plan row). `.maybeSingle()` returns `null`, and `null?.plan === 'pro'` evaluates to `false` — which is safe. But a bug check on `data.plan === 'free'` would throw on null.

**Why it happens:** Phase 4 reads subscriptions before Phase 5 has populated the table.

**How to avoid:** Always use `maybeSingle()` and treat `null` as Free. `isPro.value = data?.plan === 'pro' && data?.status === 'active'` handles null correctly.

**Warning signs:** `Cannot read properties of null (reading 'plan')` in console.

---

### Pitfall 6: Route Parameter Mismatch

**What goes wrong:** SPEC.md defines the route as `/stats/:quizId` but CONTEXT.md D-01 and UI-SPEC specify `/quiz/:id/stats`. Code uses `route.params.quizId` but the router registers `:id`.

**How to avoid:** Use `/quiz/:id/stats` as the authoritative route (CONTEXT.md D-01 is the locked decision). Router param is `id`. Store receives `route.params.id as string`.

---

## Code Examples

### RPC call from the store

```typescript
// Source: Supabase JS client rpc() pattern — existing usage in project (ai-job entity)
const { data, error } = await supabase.rpc('get_quiz_stats', { p_quiz_id: quizId })
if (error) throw error
const result = data as QuizStats
```

### Accuracy bar component (single row)

```vue
<!-- Source: UI-SPEC §Accuracy bars -->
<div class="flex items-center gap-3">
  <span class="flex-1 truncate text-sm text-neutral-300">{{ row.body }}</span>
  <div class="w-40 shrink-0">
    <!-- ProgressBar extended with size="md" (h-2) -->
    <ProgressBar :value="row.accuracy_percent ?? 0" size="md" />
  </div>
  <span class="w-10 shrink-0 text-right text-sm font-semibold text-neutral-200">
    {{ formatPercent(row.accuracy_percent) }}
  </span>
</div>
```

### Summary card

```vue
<!-- Source: UI-SPEC §Summary cards -->
<div class="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
  <p class="text-[13px] uppercase tracking-wide text-neutral-400">Всего попыток</p>
  <p class="mt-2 text-4xl font-semibold text-neutral-50">{{ stats.totalAttempts }}</p>
</div>
```

### Table timestamp format

```typescript
// Source: format.ts pattern in project, UI-SPEC §Copywriting Contract
formatShortDateTime(row.finished_at)  // → "17 мая, 14:32"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side aggregation (fetch all rows) | Postgres RPC returning pre-aggregated JSONB | Standard since Supabase added `rpc()` | Single round-trip, no raw sensitive data sent to client |
| `SECURITY INVOKER` functions (RLS applies) | `SECURITY DEFINER` + manual auth check | N/A — both valid | DEFINER gives deterministic behavior; manual ownership check is mandatory |
| Chart libraries (Chart.js, ApexCharts) for simple bars | Tailwind CSS `div` bars | Project-wide convention established in Phase 1 | Zero bundle weight, no external dependency |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `subscriptions` table has no row for Free users not yet touched by Phase 5 | Pitfall 5 | `maybeSingle()` returning null is safe; only matters if code does non-optional property access on null |
| A2 | `profiles.plan` column exists but subscriptions table is the source of truth per D-05 | Standard Stack | If Phase 5 puts the Pro flag only on `profiles.plan`, the `subscriptions` query returns stale data — but D-05 is locked |
| A3 | The `/billing` route (Phase 5) will be registered before users click "Перейти на Pro" CTA | Architecture | CTA navigates to `/billing`; until Phase 5 ships this is a dead link — acceptable per CONTEXT deferred section |

---

## Open Questions (RESOLVED)

1. **`totalQuestions` for avgScore display**
   - What we know: `score` in `quiz_sessions` is a `numeric` (fractional). `get_quiz_stats` returns `avgScore` as a number.
   - What's unclear: The stats page must display `avgScore` as "X из Y" per UI-SPEC. `totalQuestions` (Y) is not in `quiz_sessions`. The RPC could include `(SELECT COUNT(*) FROM questions WHERE quiz_id = p_quiz_id)` as `totalQuestions` in the returned object, or the page could separately fetch `questions.count`.
   - Recommendation: Include `totalQuestions` in the `get_quiz_stats` RPC payload to avoid a second query.

2. **Table sort direction toggling**
   - What we know: UI-SPEC says default sort is completion timestamp descending (latest first).
   - What's unclear: CONTEXT.md leaves column-sorting details to Claude's discretion.
   - Recommendation: Implement client-side sort on Имя/Балл/Завершён columns — data volume is small (one row per unique taker). Default sort: `finished_at DESC`. Toggle on column header click.

3. **`avgScore` when quiz has no finished sessions**
   - What we know: `AVG()` of an empty set in Postgres returns `NULL`.
   - What's unclear: How to display `null` avgScore on the cards.
   - Recommendation: Display `—` via the `formatScore(null, total)` helper. RPC returns `null`; the card renders `—`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is purely frontend + Postgres migration changes. No new CLI tools, runtimes, or external services are required beyond the Supabase instance already used by the project.

---

## Validation Architecture

Skipped — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `requiresAuth` router guard + `useAuthStore` |
| V4 Access Control | yes | Postgres RPC ownership check (`owner_id = auth.uid()`); Pro gate in store (`isPro` before RPC call) |
| V5 Input Validation | low | `quizId` is a UUID from `route.params.id` — pass to RPC; Postgres function validates ownership, no string injection vector |
| V6 Cryptography | no | No new crypto; Pro gate is read-only logic |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Horizontal privilege escalation (reading another owner's stats) | Information Disclosure | RPC checks `owner_id = auth.uid()` before returning data; raises exception on mismatch |
| Pro feature access without subscription | Elevation of Privilege | Store checks `isPro` before calling `get_quiz_accuracy` — Free client never receives accuracy data |
| `is_correct` column leaking to client via owner query | Information Disclosure | `is_correct` is only used inside the `SECURITY DEFINER` RPC body; never returned in the RPC response payload |

---

## Sources

### Primary (HIGH confidence)
- Supabase RLS + RPC documentation [CITED: supabase.com/docs/guides/database/functions] — `SECURITY DEFINER` pattern, `GRANT EXECUTE TO authenticated`
- Existing migration 009 (`owner_read_sessions`, `owner_read_session_answers` policies) — [VERIFIED: codebase grep] — owner RLS is already in place
- Existing migration 007 (`owner_manage_subscriptions`) — [VERIFIED: codebase grep] — authenticated owner can read own subscriptions row
- CONTEXT.md D-01 through D-08 — locked decisions [VERIFIED: 04-CONTEXT.md]
- 04-UI-SPEC.md — visual contract [VERIFIED: 04-UI-SPEC.md]
- PITFALLS.md §8.2 — N+1 on statistics page warning [VERIFIED: .planning/research/PITFALLS.md]

### Secondary (MEDIUM confidence)
- Postgres `DISTINCT ON` for latest-per-group pattern [ASSUMED — standard SQL technique, not verified against a specific official doc in this session]
- `LEFT JOIN LATERAL` for per-question correctness aggregation [ASSUMED — standard Postgres pattern]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, verified in codebase
- Architecture (RPC vs client-side): HIGH — N+1 pitfall documented, owner RLS verified in migrations
- Pitfalls: HIGH — drawn from project PITFALLS.md and confirmed schema examination
- SQL RPC code: MEDIUM — plpgsql logic is sound but exact syntax should be tested against Supabase instance

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (stable stack — 30 days)
