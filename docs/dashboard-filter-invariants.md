# Dashboard + Filter Invariants (As of v0.3.4)

Stability split:
- `Canonical`: filter semantics, routing boundaries, list/dashboard data parity.
- `Current Behavior (May Change)`: dashboard visual composition and copy-level presentation details.

## Purpose

This file is the Phase 0 invariant contract referenced by `DECISION_PACKET.md`.
It defines what must remain stable when iterating dashboard UX.

## Canonical Invariants

| ID | Invariant | Code truth | Existing tests |
|---|---|---|---|
| `DF-001` | Boolean `tagFilter` takes precedence over legacy `tag` when non-empty. | `src/domain/tagFilter.ts:31-44` | `src/domain/tagFilter.test.ts:49-65`, `src/domain/query.test.ts:110-118` |
| `DF-002` | Due windows are local-day based: `today` = dayDiff `0`; `next7` = `today..+6`; `overdue` includes prior-day and explicit-time overdue today. | `src/domain/query.ts:102-117`, `src/domain/taskRows.ts:86-103` | `src/domain/query.test.ts:21-79`, `src/domain/taskRows.test.ts:95-119` |
| `DF-003` | Dashboard receives the same filtered row set as list (`visibleTaskRows`) and must not reimplement filter semantics. | `src/app/App.tsx:1128-1133`, `src/app/App.tsx:5501-5504` | Integration covered by parity behavior in dashboard/query/taskRows tests (`src/domain/dashboardKpis.test.ts`, `src/domain/dashboard.test.ts`) |
| `DF-004` | Recurring series expansion in visible rows follows the same due/tag/search filters and suppresses virtual rows when matching materialized instance exists. | `src/domain/taskRows.ts:144-257` | `src/domain/taskRows.test.ts:45-170` |
| `DF-005` | Dashboard top-tag drilldown applies legacy `tag` and clears boolean `tagFilter`; done/archived status blocks drilldown with hint. | `src/app/App.tsx:5218-5237` | `src/app/keyRouter.test.ts:529-573` (action routing) |
| `DF-006` | Dashboard and tag-filter modes block list-key leakage; routing is mode-scoped. | `src/app/keyRouter.ts:518-541` | `src/app/keyRouter.test.ts:529-573`, `src/app/keyRouter.test.ts:690-707` |
| `DF-007` | Saved views normalize boolean tag filters and preserve tag precedence on restore. | Saved-view normalization/apply flow in domain layer | `src/domain/savedViews.test.ts:42-77` |

## Current Behavior (May Change)

These are intentionally not canonical in this cycle:

1. Dashboard panel composition details (exact chart arrangement, compact/fallback rendering text).
2. Non-semantic copy strings for hints and labels.
3. Visual style polish (spacing, meter density, text abbreviations), as long as canonical invariants remain true.

## Canonical Change Gate

A change is `breaking` (requires release-note callout) if it modifies any `DF-*` invariant above.
A change is `non-breaking UX refinement` if it only affects items in "Current Behavior (May Change)".

## Go/No-Go Checklist

- [ ] `src/domain/query.test.ts` green for due-window boundaries and tag precedence.
- [ ] `src/domain/taskRows.test.ts` green for recurrence + filter parity.
- [ ] `src/app/keyRouter.test.ts` green for dashboard routing/no-leakage invariants.
- [ ] `src/domain/savedViews.test.ts` green for boolean-tag snapshot/apply behavior.
- [ ] README/spec labels align with this canonical/current-behavior split.
