# DASHBOARD_SPEC_MVP — TADOI Dashboard MVP Mini-Spec

> Scope: add a **Dashboard mode** with two widgets: **8‑bar due bucket chart** and a **burndown‑ish trend**. Dashboard must **reuse the exact same filter semantics** as the Task List: **status**, **due**, **tag** (and optionally `searchText` if already supported by the list).

---

## 1) Goals

### Goals (MVP)
- Provide a **dashboard screen** that summarizes the filtered task set using:
  1) **8‑bar due bucket chart** (Overdue + Today + next 6 days)
  2) **Burndown‑ish trend** (open backlog over last 7 days)
- **Filter parity** with Task List:
  - `status` (all/open/done/archived)
  - `due` (any/overdue/today/next7)
  - `tag` (single include tag)
- **Keyboard-first** interaction consistent with existing routing/overlay behavior (no key leakage across modes).

### Non-goals (MVP)
- No custom dashboard layout editor / widget library beyond the two widgets.
- No persistence of dashboard UI-only state (selection, cursor, scroll).
- No new domain concepts (recurrence, multi-tag boolean logic, etc.).

---

## 2) Platform & UX Constraints

- Must remain usable at **80×24 minimum terminal size**; below that, show the existing guard screen behavior.
- Date logic uses **local-day boundaries** (date-only due semantics) consistent with the core app.
- Dashboard must not trigger persistence writes by itself (UI-only ticks are not domain mutations).

---

## 3) Mode, Navigation, Keybindings

### New Mode
- Add `DASHBOARD` to the mode/focus model (UI-only state).
- Routing precedence remains centralized and deterministic.

### Keybindings (MVP)
- `b` / `B`: enter **Dashboard** from anywhere (unless a modal overlay has focus).
- `b` / `B`: toggle back to **List** (Dashboard ↔ List).
- `f`: cycle **status filter** (same behavior as list)
- `g`: cycle **due filter** (same behavior as list)
- `t`: cycle **tag filter** (same behavior as list; active tag cycles)
- `Esc`: unwind overlays/help as usual

#### Optional (recommended) drill-down
- `←/→`: move selection across bars (within the focused widget)
- `Enter`: “drill to list” (applies a temporary due constraint and returns to LIST)

> Note: Saved Views should apply equally to List and Dashboard since they snapshot filters.

---

## 4) Filters Contract (Parity with Task List)

Dashboard must use the existing `Filters` model and semantics (single source of truth).

```ts
type Filters = {
  status: "all" | "open" | "done" | "archived";
  due: "any" | "overdue" | "today" | "next7"; // rolling 7 days incl today
  tag?: string; // single include tag (MVP)
  searchText?: string; // if already part of list filtering, dashboard respects it too
};
```

- Dashboard widgets must render using **the same visible task set** as the List selector (i.e., “what the list would show right now”).
- Definitions:
  - `next7` = rolling next 7 local days including today.
  - Archived tasks follow the existing archive aging rules (e.g., done > N days ago → archived), if present.

---

## 5) Widget A — 8‑Bar Due Bucket Chart

### Purpose
Show at-a-glance distribution of upcoming due work for the next week window plus overdue.

### Buckets (8 bars)
Index | Bucket | Inclusion rule (local-day)
---|---|---
0 | Overdue | due date < today
1 | Today | due date == today
2 | Day+1 | due date == today+1
3 | Day+2 | due date == today+2
4 | Day+3 | due date == today+3
5 | Day+4 | due date == today+4
6 | Day+5 | due date == today+5
7 | Day+6 | due date == today+6

### Counting rules
- Count **tasks with a due date** only; `dueAt` undefined → excluded.
- Widget receives already-filtered `visibleTasks`.
- Recommended MVP behavior to avoid “overdue done tasks” confusion:
  - If `filters.status` is `open` or `all`: count **open tasks only** in these buckets.
  - If `filters.status` is `done`/`archived`: count tasks matching that status only.

### Drill-down behavior (recommended MVP)
- Selecting a bar + `Enter` returns to LIST and applies a temporary constraint:
  - Overdue → `due=overdue`
  - Today → `due=today`
  - Day+N → transient “exact date” constraint (UI-only) OR reuse an existing query facility if one exists (do **not** persist a new domain field).

### Rendering requirements
- Labels must fit 80×24:
  - Suggested labels: `OVD`, `TOD`, `+1`, `+2`, `+3`, `+4`, `+5`, `+6`
- Always show numeric counts (above or inside bars).
- Cap bar height; do not let one huge value flatten the week visually.

---

## 6) Widget B — Burndown‑ish Trend (Open Backlog, Last 7 Days)

### Purpose
Show whether the open backlog is rising or falling over the last week.

### Definition
Compute a 7-point series: **open task count at end-of-day** for each of the last 7 local days (including today).

For day `d`, a task contributes if:
- `createdAt` is on or before end-of-day `d`, AND
- `closedAt` is either undefined OR after end-of-day `d`

### Output
- Render as a simple **sparkline / line plot** in TUI characters.
- Provide:
  - min/max labels
  - delta vs 7 days ago (e.g., `Δ +3`)

### Notes on accuracy & performance
- Historical reconstruction is O(tasks × days). This is acceptable for MVP with bounded day range.
- Recompute on domain mutation/filter change; avoid UI-only tick thrash.

---

## 7) Data & Computation Contracts

### Inputs
- `visibleTasks = getVisibleTasks(state, now)` (existing selector logic)

### Aggregations (pure functions)
Add a domain-pure module, e.g. `src/domain/dashboard.ts`:

```ts
export function computeDueBuckets8(tasks: Task[], now: Date): number[];
export function computeBacklogTrend7(tasks: Task[], now: Date): number[]; // 7 points
```

- Must be deterministic and unit-testable.
- Must respect local-day semantics consistent with due filters and archive rules.
- Performance target: responsive at ~2,000 tasks.

---

## 8) UI Layout (MVP)

### Suggested regions
- Main pane replaces List content with:
  - Top: `DASHBOARD` header + filter summary chips (status/due/tag)
  - Body: two framed panels in a **2:1 split** (chart left, trend right)

### Layout robustness contract
- Due-bucket panel enforces a minimum width (`MIN_DUE_BUCKET_CHART_WIDTH`) so labels/bars/counts remain legible.
- If split layout cannot satisfy minimum widths for both panels, fallback to **stacked layout** (chart above trend).
- If chart panel width drops below safe render size, show a friendly placeholder (e.g., `"(widen to view chart)"`) instead of corrupt output.

- Left rail remains unchanged (logo/date/time/filters/mode indicators).

---

## 9) Help / Documentation Updates

- Add a **Dashboard** section to Help overlay:
  - How to enter/exit Dashboard (`b` / `B`)
  - What each widget means
  - Drill-down controls (if included)
- README keybindings should include the dashboard toggle and any new navigation keys.

---

## 10) Acceptance Criteria (Definition of Done)

### A) Filter parity
- Changing `status/due/tag` in List instantly changes Dashboard metrics and vice versa (single source of truth).

### B) 8‑bar chart correctness
- Overdue/today/next 6 days counts match task due dates using local-day semantics.
- Tasks without due dates do not appear in the chart.

### C) Burndown trend correctness
- Trend line matches historical reconstruction using `createdAt` / `closedAt`.
- Recomputes after domain mutations and filter changes; does not thrash on idle ticks.

### D) Layout robustness
- At wide widths, dashboard renders side-by-side chart/trend panels.
- At narrow widths, dashboard falls back to stacked layout.
- Chart never renders corrupted/overlapping content; it shows a friendly placeholder when too narrow.

### E) UX + routing
- No key leakage: list navigation keys do not fire while dashboard has focus contexts that should consume input.

### F) 80×24
- Dashboard renders legibly at 80×24 and respects the below-min-size guard.
