# Phase 4: Statistics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 04-statistics
**Areas discussed:** Entry point & navigation, Attempt aggregation, Pro gate, Data presentation

---

## Entry Point & Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated page /quiz/:id/stats | Link/button on /my card and editor header; separate route | ✓ |
| Tab inside the editor | Stats as a tab/mode on the quiz editor page | |

**User's choice:** Dedicated page `/quiz/:id/stats`.

---

## Attempt Aggregation

| Option | Description | Selected |
|--------|-------------|----------|
| Each attempt = a row | Summary counts all finished attempts; table = one row per attempt | |
| Latest attempt per person | Table = one row per taker (latest); average over latest attempts | ✓ |
| Best attempt per person | Table = best result per taker; average over best | |

**User's choice:** Latest attempt per person.
**Notes:** Completion rate = finished / started sessions (over all sessions). Per-question accuracy and average score computed from latest finished attempts only.

---

## Pro Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Read from subscriptions | Real isPro flag from `subscriptions` table (migration 006); Phase 5 fills data | ✓ |
| Temporary hardcode (all Free) | Section always blurred until Phase 5 wires the gate | |

**User's choice:** Read from `subscriptions` table.

---

## Data Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Cards + progress bars | Summary cards with large numbers; accuracy as horizontal % bars; no chart library | ✓ |
| Numbers/tables only | Minimalist: numbers and tables, no visualization | |
| Full charts (chart library) | Add a chart library for diagrams | |

**User's choice:** Cards + progress bars and a user comparison table.

---

## Claude's Discretion

- Russian copy for the stats page, empty state, and upgrade CTA.
- Per-person table sorting/filtering details.
- View/RPC vs client-side aggregation for stats computation.
- Visual styling within the dark theme + orange accent system.

## Deferred Ideas

- Score distribution histogram (EXT-05) — v2.
- Per-attempt drill-down per taker — not requested.
- Real freemium enforcement / subscription purchase — Phase 5.
- Statistics export (CSV/PDF) — out of scope.
