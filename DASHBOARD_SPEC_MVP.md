# DASHBOARD_SPEC_MVP — TADOI Dashboard Runtime Contract

> Scope: dashboard mode renders a multi-widget analytics surface from the same recurrence-aware filtered dataset as Task List.
>
> Runtime baseline: `v0.3.8`
> As of: `2026-02-26`
> Stability split:
>
> - `Canonical`: filter semantics, routing boundaries, persistence/selection contracts.
> - `Current Behavior (May Change)`: copy text, exact panel spacing, and compact rendering cosmetics.

---

## 1) Goals

### Goals (current runtime)

- Keep dashboard analytics in strict parity with list-visible rows.
- Keep dashboard drill-through deterministic across keyboard and mouse.
- Keep rendering robust at minimum supported terminal size (`104x24`) using priority collapse, not vertical scrolling.

### Non-goals

- No custom widget layout editor.
- No per-widget persistence settings.

---

## 2) Filter + Selector Contract

Dashboard input is the same filtered row pipeline as list (`buildVisibleTaskRows(...)`).

```ts
type Filters = {
  status: "all" | "open" | "done" | "archived";
  due: "any" | "overdue" | "today" | "next7";
  analyticsWindow?: "7d" | "14d" | "30d";
  dueDayOffset?: 1 | 2 | 3 | 4 | 5 | 6;
  priority?: string;
  tag?: string;
  tagFilter?: { all?: string[]; any?: string[]; none?: string[] };
  searchText?: string;
  assignee?: string;
  project?: string;
  workflowStage?:
    | "backlog"
    | "todo"
    | "in_progress"
    | "blocked"
    | "review"
    | "done";
};
```

Canonical rules:

- `analyticsWindow` defaults to `7d` when unset.
- `dueDayOffset` is exact day matching (`+N`) and is additive with other filters.
- Due cycle key (`g`) clears `dueDayOffset`.
- Dashboard must not reimplement list filter semantics.

---

## 3) Dashboard Key Contract

- `b` / `B`: toggle list/dashboard.
- `f`, `g`, `r`, `t`, `p`: same filter behavior as list.
- `w`: cycle analytics window (`7d -> 14d -> 30d -> 7d`).
- `Tab` / `Shift+Tab`: move dashboard focus group.
- `ArrowUp` / `ArrowDown`: move selection in active focus group.
- `Enter`: apply active dashboard selection.
- `?`: open Help.
- `q`: quit.

Routing contract:

- Dashboard and tag-filter modes block list-key leakage.
- Routing remains centralized in the key-router module.

---

## 4) Widget Contracts

Dashboard widgets (runtime):

1. KPI strip (window-aware)
2. Due buckets (`OVD`, `TOD`, `+1..+6`)
3. Top tags (open)
4. Priority strip (drill-through)
5. Dimension slices (`assignee`, `project`, `workflowStage`)
6. Backlog trend (`7d|14d|30d`)
7. Overdue aging
8. Throughput (magnitude bars)

### 4.1 KPI strip

- Labels: `OVERDUE`, `TODAY`, `NEXT{windowDays}`, `OPEN`, `DONE{windowDays}D`.
- `OVERDUE` includes prior-day overdue and same-day explicit-time-overdue tasks.
- Compact fallback supported on narrow widths.

### 4.2 Due buckets

- Buckets: `OVD`, `TOD`, `+1`, `+2`, `+3`, `+4`, `+5`, `+6`.
- `OVD` semantics match KPI/aging overdue logic.
- Drill-through actions:
  - `OVD` => `status=open`, `due=overdue`, `dueDayOffset=undefined`
  - `TOD` => `status=open`, `due=today`, `dueDayOffset=undefined`
  - `+N` => `status=open`, `due=any`, `dueDayOffset=N`

### 4.3 Top tags (open)

- Counts open-task tags only.
- Drill-through applies legacy `filters.tag` and clears boolean `filters.tagFilter`.
- Done/archived status shows availability hint instead of applying.

### 4.4 Priority strip

- Compact interactive strip preserving priority drill-through.
- Selecting a priority applies `filters.priority`.

### 4.5 Dimension slices

- Interactive slices for `assignee`, `project`, `workflowStage`.
- Selection applies matching filter field directly.

### 4.6 Backlog trend

- Backlog trend is surfaced in runtime and replaces the large legacy priority panel.
- Uses active analytics window (`7|14|30` days).

### 4.7 Overdue aging

- Aging buckets: `0d`, `1d`, `2-3d`, `4-7d`, `8-14d`, `15-30d`, `30d+`.
- `0d` captures same-day explicit-time overdue tasks.

### 4.8 Throughput

- Created/completed rows render per-day magnitude bars (not binary markers).
- Shared max scale across created/completed rows for visual comparison.
- Totals row includes net.

---

## 5) Layout + Height Fallback Contract

Width behavior:

- Two-column due/tags when width permits.
- Stacked fallback when width is constrained.
- Charts render `(widen to view chart)` when minimum readable width is not available.

Height behavior (priority collapse):

- Priority order: `KPI -> Due+Top -> Priority/Backlog -> OverdueAging+Throughput`.
- Low-priority sections collapse to summary/hidden by deterministic thresholds.
- No vertical dashboard scrolling in this contract.

---

## 6) Persistence + Schema Contract

- Saved views persist:
  - `analyticsWindow`
  - `dueDayOffset`
  - `assignee`
  - `project`
  - `workflowStage`
- Persistence schema baseline: `7`.
- Migration `6 -> 7` backfills `workflowStage`:
  - `open -> todo`
  - `done|archived -> done`

---

## 7) Canonical Invariant Table

| ID      | Canonical invariant                                                                                | Automated lock                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| DTF-001 | Non-empty boolean `tagFilter` overrides legacy `tag`.                                              | `src/app/dashboardTagFilterContract.test.ts`                                                                     |
| DTF-002 | Empty boolean buckets are no-op and legacy `tag` matching applies.                                 | `src/app/dashboardTagFilterContract.test.ts`                                                                     |
| DTF-003 | `due=next7` uses local-day rolling window `today..+6`.                                             | `src/app/dashboardTagFilterContract.test.ts`                                                                     |
| DTF-004 | `due=overdue` includes prior-day overdue and same-day explicit-time overdue once due time passes.  | `src/app/dashboardTagFilterContract.test.ts`, `src/domain/dashboard.test.ts`, `src/domain/dashboardKpis.test.ts` |
| DTF-005 | In `DASHBOARD` mode, focus-group routing + `Enter` drill-through work while list keys do not leak. | key-router coverage tests + app integration dashboard flow tests                                                 |
| DTF-006 | In `TAG_FILTER` mode, list/dashboard routing is blocked until unwind (`Esc`).                      | `src/app/dashboardTagFilterContract.test.ts`                                                                     |
| DTF-007 | Dashboard analytics consume recurrence-aware visible rows (`buildVisibleTaskRows`).                | `src/app/dashboardTagFilterContract.test.ts`                                                                     |
| DTF-008 | Saved views round-trip analytics and dimension filters.                                            | `src/domain/savedViews.test.ts`                                                                                  |
| DTF-009 | `+N` due bucket drill-through sets exact `dueDayOffset` filter.                                    | `src/app/App.modalFlow.integration.test.ts`, `src/domain/query.test.ts`                                          |

---

## 8) Acceptance Criteria

- Overdue counts stay consistent across KPI, due buckets, and aging buckets.
- Days with higher throughput counts render larger bars than lower-count days.
- Dashboard interactions (top tags, due buckets, priority strip, dimension slices) work via mouse and keyboard.
- Analytics window cycling updates KPI/backlog/throughput and persists through saved views.
- Resizing does not corrupt borders or hide footer quick-filter interactions.
