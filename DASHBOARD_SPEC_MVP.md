# DASHBOARD_SPEC_MVP — TADOI Dashboard Runtime Contract

> Scope: dashboard mode renders a three-part analytics surface using the same filtered dataset as Task List (including recurrence-expanded occurrence rows):
> 1) KPI strip (top)
> 2) 8-bucket due chart (left panel)
> 3) TOP TAGS (OPEN) Pareto chart (right panel)
>
> Release baseline: `v0.3.0`.

---

## 1) Goals

### Goals (current runtime)
- Provide a dashboard screen with shared-filter analytics that updates from the exact same visible-task selector used by Task List.
- Keep keyboard routing centralized with strict mode boundaries and no key leakage.
- Keep rendering legible at 104x24 with robust fallback behavior when width is constrained.

### Non-goals
- No dashboard-specific persistence or filter model.
- No custom widget layout editor.
- No new domain persistence fields.

---

## 2) Filter Parity Contract

Dashboard input is the same filtered list used by Task List:

```ts
type Filters = {
  status: "all" | "open" | "done" | "archived";
  due: "any" | "overdue" | "today" | "next7";
  tag?: string;
  tagFilter?: { all?: string[]; any?: string[]; none?: string[] };
  searchText?: string;
};
```

Single source of truth:
- `visibleTaskRows = buildVisibleTaskRows(state.tasks, state.filters, state.sortMode, now)`
- Dashboard does not reimplement filter semantics.
- Recurring series expand to virtual/materialized occurrence rows in the same selector.

---

## 3) Mode + Key Routing Contract

### Toggle + guards
- `b` / `B` toggles `LIST <-> DASHBOARD`.
- Toggle is ignored in text-entry contexts (`SEARCH`, `ADD`, `EDIT`, save-view-name prompt).

### Dashboard key contract
- Allowed: `b`/`B`, `f`, `g`, `t`, `Shift+T`, `up`, `down`, `enter`, `?`, `q`
- Blocked: list movement/action keys (`j/k`, paging, jumps, etc.)
- Routing remains centralized in `src/app/keyRouter.ts`.

### Top-tags drilldown
- `up` / `down` selects a row in `TOP TAGS (OPEN)`.
- `enter` applies selected tag as active legacy tag filter (`filters.tag = selectedTag`) and clears boolean `filters.tagFilter`.
- If status filter is `done` or `archived`, enter shows an availability hint instead of applying a tag.

---

## 4) Widget Contracts

## 4.1 KPI Strip (Top)

Rendered above the two dashboard panels.

KPIs (order fixed):
1. `OVERDUE`
2. `TODAY`
3. `NEXT7`
4. `OPEN`
5. `DONE7D`

Definitions:
- `OVERDUE`: open tasks overdue (date-based or explicit-time overdue on current day)
- `TODAY`: open tasks due today
- `NEXT7`: open tasks due in rolling window `[today..today+6]`
- `OPEN`: open tasks count
- `DONE7D`: done/closed tasks in the last 7 local days from the current filtered dataset

Rendering:
- Each KPI shows `label` and `value + meter` on the same line.
- Meters use Unicode block elements (`█▉▊▋▌▍▎▏`).
- Meters normalize to max KPI value in the strip.
- Narrow-width fallback uses compact text: `OVD:x  TOD:x  N7:x  OPN:x  D7:x`.
- Color contract:
  - `OVERDUE`, `TODAY`, `NEXT7`, `OPEN`: blue (`theme.accentBlue`)
  - `DONE7D`: green (`theme.ok`)

Layout contract:
- KPI cells must distribute available strip width across all five cells (no trailing unused gap).
- KPI strip container width must match dashboard content width used by the panel row.

## 4.2 Due Buckets Panel (Left)

Domain source: `computeDueBuckets8(tasks, now)`

Buckets:
- `OVD`, `TOD`, `+1`, `+2`, `+3`, `+4`, `+5`, `+6`

Rules:
- Local-day semantics.
- Tasks without `dueAt` are excluded.
- Minimum safe chart width enforced; too narrow renders friendly placeholder.

## 4.3 TOP TAGS (OPEN) Panel (Right)

Domain source: `computeTopTagsOpen(tasks, limit)`

Rules:
- Counts tags from open tasks only.
- Recurrence rows are counted as task rows; materialized instance rows suppress matching virtual occurrences.
- If active status filter is `done`/`archived`, panel shows:
  - `(Top tags available for OPEN tasks only)`
- If no tagged open tasks:
  - `(No tagged open tasks)`

Rendering contract:
- Pareto-style horizontal bars with fixed label column + fixed bar column behavior.
- Tag label and bar start positions are aligned across rows.
- Long tags truncate with ellipsis without shifting bar start.

---

## 5) Layout + Responsiveness Contract

- Dashboard body uses 2:1 split (due chart left, top tags right) when width permits.
- Fallback to stacked panels when minimum widths cannot be satisfied.
- Width guards:
  - right-panel minimum width
  - due-chart minimum width
  - chart bar-slot minimum width
- Render `(widen to view chart)` placeholders instead of corrupt/overlapping output.

---

## 6) Domain Computation Contracts

Pure domain helpers:

```ts
computeDueBuckets8(tasks: Task[], now: number): number[];
computeTopTagsOpen(tasks: Task[], limit: number): Array<{ tag: string; count: number }>;
computeDashboardKpis(tasks: Task[], nowMs: number): {
  overdue: number;
  today: number;
  next7: number;
  open: number;
  done7d: number;
};
```

Selector contract:

```ts
buildVisibleTaskRows(tasks: Task[], filters: Filters, sortMode: SortMode, now: number): VisibleTaskRow[];
```

Performance:
- Must stay responsive for approximately 2,000 tasks.
- Avoid O(n²) patterns in aggregations.

Persistence:
- No persistence format changes.

---

## 7) Documentation + Testing Contract

Docs must describe:
- dashboard keybindings (including `up/down + enter` top-tags drilldown)
- KPI strip definitions and compact mode abbreviations
- shared-filter parity with Task List

Tests should cover:
- due-bucket aggregation behavior
- top-tag aggregation behavior
- KPI aggregation date boundaries (`overdue`, `today`, `next7`, `done7d`)
- key routing for dashboard selection/drilldown and no leakage

---

## 8) Acceptance Criteria

- Dashboard metrics and Task List stay in sync under all shared filters.
- KPI strip renders above both panels and respects compact fallback.
- KPI color semantics match contract (`DONE7D` green, others blue).
- TOP TAGS rows remain aligned regardless of tag length.
- Enter on selected top tag applies `filters.tag` immediately.
- Dashboard toggling and resizing do not corrupt borders/layout.
