# Dashboard + Filter Invariants (As of v0.4.0)

Stability split:

- `Canonical`: filter semantics, routing boundaries, list/dashboard data parity.
- `Current Behavior (May Change)`: dashboard visual composition and copy-level presentation details.

## Purpose

This file is the Phase 0 invariant contract referenced by `DECISION_PACKET.md`.
It defines what must remain stable when iterating dashboard UX.

## Canonical Invariants

| ID       | Invariant                                                                                                                                            | Code truth                                                                      | Existing tests                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `DF-001` | Boolean `tagFilter` takes precedence over legacy `tag` when non-empty.                                                                               | `src/domain/tagFilter.ts:31-44`                                                 | `src/domain/tagFilter.test.ts:49-65`, `src/domain/query.test.ts:110-118`                                         |
| `DF-002` | Due semantics are local-day based: `today` = dayDiff `0`; `next7` = `today..+6`; `overdue` includes prior-day and same-day explicit-time overdue.    | `src/domain/query.ts`, `src/domain/dashboard.ts`, `src/domain/dashboardKpis.ts` | `src/domain/query.test.ts`, `src/domain/dashboard.test.ts`, `src/domain/dashboardKpis.test.ts`                   |
| `DF-003` | Dashboard receives the same filtered row set as list (`visibleTaskRows`) and must not reimplement filter semantics.                                  | `src/app/App.tsx`, `src/domain/taskRows.ts`                                     | `src/app/dashboardTagFilterContract.test.ts`, `src/domain/dashboard.test.ts`, `src/domain/dashboardKpis.test.ts` |
| `DF-004` | Dashboard due-bucket drill-through for `+1..+6` applies exact `dueDayOffset` with `status=open` and `due=any`.                                       | `src/app/App.tsx`, `src/domain/query.ts`                                        | `src/app/App.modalFlow.integration.test.ts`                                                                      |
| `DF-005` | Cycling the coarse due filter (`g`) clears `dueDayOffset` to avoid hidden contradictory filters.                                                     | `src/app/App.tsx`                                                               | `src/app/dashboardTagFilterContract.test.ts`, `src/domain/query.test.ts`                                         |
| `DF-006` | `analyticsWindow` is filter-level (`7d                                                                                                               | 14d                                                                             | 30d`), defaults to `7d`, and round-trips through saved views.                                                    | `src/domain/models.ts`, `src/domain/savedViews.ts`, `src/domain/query.ts` | `src/domain/savedViews.test.ts`, `src/domain/query.test.ts` |
| `DF-007` | Dashboard top-tag drilldown applies legacy `tag` and clears boolean `tagFilter`; done/archived status blocks drilldown with hint.                    | `src/app/App.tsx`                                                               | key-router unit coverage + app integration dashboard flow tests                                                  |
| `DF-008` | Priority/assignee/project/workflow-stage dashboard drill-through updates canonical filter fields directly.                                           | `src/app/App.tsx`, `src/components/DashboardPane.tsx`                           | key-router unit coverage + app integration dashboard flow tests + query domain tests                             |
| `DF-009` | Dashboard routing is mode-scoped and blocks list-key leakage.                                                                                        | centralized key-router action dispatch                                          | key-router unit coverage + dashboard contract tests                                                              |
| `DF-010` | Dashboard focus-group navigation (`Tab`/`Shift+Tab`, arrows, `Enter`) is centralized in key router and applies active widget selection only.         | key-router dispatch + dashboard selection state handlers                        | key-router unit coverage + app integration dashboard flow tests                                                  |
| `DF-011` | Saved views preserve dashboard dimension filters (`assignee`, `project`, `workflowStage`) and analytics filters (`analyticsWindow`, `dueDayOffset`). | `src/domain/savedViews.ts`                                                      | `src/domain/savedViews.test.ts`                                                                                  |
| `DF-012` | Schema v7 requires `workflowStage` on persisted tasks; v6 data migrates deterministically (`open->todo`, `done                                       | archived->done`).                                                               | `src/state/migrations.ts`, `src/state/validation.ts`, `src/state/persistence.ts`                                 | `src/state/migrations.test.ts`, `src/state/validation.test.ts`            |

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
- [ ] `src/domain/dashboard.test.ts` + `src/domain/dashboardKpis.test.ts` green for overdue/due-window dashboard semantics.
- [ ] key-router unit coverage green for dashboard routing, focus-group traversal, and no-leakage invariants.
- [ ] `src/app/App.modalFlow.integration.test.ts` green for dashboard mouse/keyboard drill-through and quick-filter toggles.
- [ ] `src/domain/savedViews.test.ts` green for analytics/dimension snapshot/apply behavior.
- [ ] `src/state/migrations.test.ts` + `src/state/validation.test.ts` green for v7 workflow-stage guarantees.
- [ ] README/spec labels align with this canonical/current-behavior split.
