# SPEC.md — TADOI (TypeScript + OpenTUI)

## 0) Summary

Build a keyboard-first terminal TUI todo app with a **retro Star Trek-inspired layout**, using **OpenTUI** + **@opentui/react** on **Bun**.
Naming: use **TADOI** consistently in the app UI and filenames.

v0.2.8 scope note:
- This version carries forward foundation polish, packaging readiness, data portability, and dashboard contracts from prior increments.
- It keeps persistence and routing discipline strict while aligning runtime/documentation behavior to current release expectations.
- It codifies graceful interactive exit teardown (`renderer.destroy()` in app handlers) and renderer-managed `Ctrl+C` behavior.
- Current app version surfaces are aligned to `v0.2.8` / `0.2.8`.
- Runtime addendum (post-v0.2.8 docs sync): notifications now surface as actionable overdue popups (modal queue) and theme registry includes expanded accessibility/brand palettes.

recurrence extension note:
- Recurring tasks are now implemented with RRULE-style metadata (`dtstart`, `rrule`, `exdates`, `series_id`) and sparse materialization (`instance_of` rows for per-occurrence overrides/history).
- Task-list/dashboard filtering now consumes a recurrence-aware visible-row selector so Today/Next7/Overdue and tag/search filters remain a single source of truth.

- Runtime: Bun (OpenTUI quick start uses Bun; `bun create tui`)  [oai_citation:0‡GitHub](https://github.com/anomalyco/opentui?utm_source=chatgpt.com)
- UI binding: @opentui/react provides React reconciler + patterns like `createRoot` and `useKeyboard`.  [oai_citation:1‡npm](https://www.npmjs.com/package/%40opentui/react?utm_source=chatgpt.com)
- OpenTUI is in development / not production-ready; MVP should keep dependencies minimal and tolerate API drift.  [oai_citation:2‡GitHub](https://github.com/anomalyco/opentui?utm_source=chatgpt.com)

Deliverables:
- Fully functional MVP (no sync) with **tag autocomplete**.
- Local persistence (JSON file) with safe writes.
- Single-screen TADOI layout with list + details/edit + left “rail”.

---

## 1) Goals / Non-Goals

### Goals (MVP)
1. **Task CRUD**: add, edit, toggle done, delete.
2. **Fast navigation** via keyboard-only.
3. **Filters**: status + due bucket + single-tag include (MVP).
4. **Search**: substring match on title and tags (live).
5. **Tag autocomplete**: `#`-triggered suggestions with ranking by prefix + usage.
6. **Persistence**: disk-backed JSON and load on startup.
7. **Date autocomplete**: right-arrow completes due date incrementally (year → month → day).
8. **Inline tag autocomplete**: as you type tags (with or without `#`), show a right-arrow inline completion for the remainder (e.g., `#wo` → `#work`); right arrow accepts.
9. **Colored tags**: tags display with automatically assigned colors (consistent per tag).
10. **Status colors**: default color coding for complete vs. incomplete tasks.
11. **Menu focus highlight**: selected menus are visibly highlighted to indicate current section.
12. **Selected task top bar**: selected task name shown in a centered top bar above the task list + details pane (not the left rail).
13. **Due-today pulse**: tasks due today and not complete should flash.
14. **Layout placement**: “TADOI” stays at the top of the left rail, and the top/bottom bars span only above/below the task list + details pane.
15. **Bottom bar**: add a bottom bar under the task list + details pane for future data/tabs/buttons.
16. **Section labels**: “TASK LIST” and “DETAILS” labels float above their respective borders.
17. **Pane outlines**: thin outlines for left rail, task list, and details pane.
18. **TADOI ASCII logo**: compact ASCII logo in the left rail with tightened letter spacing.
19. **Due-soon/due-later colors**: tasks due tomorrow–next 7 days are yellow; tasks due 8+ days out are blue.
20. **Closed date display**: completed tasks show closed date in details and list.
21. **Quick copy**: `c` duplicates a task into a new draft (completed → due today, future due date → same); user must save or Esc to cancel.
22. **Due-in indicator**: open tasks show “DUE IN # DAYS” on the right of the list row.
23. **Overdue flash**: overdue tasks flash more aggressively (red/yellow).
24. **Selected indicator**: a left-side marker shows the selected row.
25. **Wrap-around navigation**: list navigation wraps from end to start and vice versa.
26. **Left rail version**: a small version string appears under the logo.
27. **Top bar emphasis**: top bar text is visually emphasized (larger/stronger).
28. **Due label rules**: due today shows “DUE TODAY”; overdue shows “N DAYS OVERDUE”; due-in shows “DUE TODAY” instead of “DUE IN 0 DAYS”.
29. **Top bar due info**: top bar shows task name with due label beneath it.
30. **Bottom bar summary**: show counts labeled RED (overdue), DUE TODAY (yellow), and DUE THIS WEEK (blue).
31. **Bottom bar completed**: add “N COMPLETED THIS WEEK” (green).
32. **Bottom bar ticker**: auto-rotate every 6s between summary and top tags (top 5 tags with total counts, rendered as a single tag-colored pill: `N #tag`).
33. **Left rail date/time**: show `DATE: YYYY-MM-DD` and `TIME: HH:mm:ss` under the version label.
34. **Archive rules**: tasks completed >7 days ago become ARCHIVED; archived tasks are excluded from “ACTIVE” and only appear under ARCHIVED filter.
35. **Top bar center**: task name is centered and displayed in uppercase; due label centered beneath.
36. **Due-today color**: due-today uses yellow (not red) across list/details/top bar; top bar is static (no pulsing).
37. **Details emphasis**: when a due/overdue task is selected, highlight due date and status in the details pane.
38. **Filter highlights (status)**: in the left rail filters, STATUS shows colored highlight (DONE=green, OPEN=blue, ARCHIVED=grey).
39. **Filter highlights (due)**: in the left rail filters, DUE shows colored highlight (OVERDUE flashes red/yellow, TODAY=yellow, THIS WEEK=blue).
40. **Due label update**: left rail DUE label shows “THIS WEEK” for the rolling next-7-days filter.
41. **Task list flash scope**: only due-date and overdue/due-today indicators flash; task rows remain static.
42. **Selected overdue row**: if the selected task is overdue, the row highlight is red.
43. **Due-today right label**: the right-side “DUE TODAY” label is always yellow-highlighted (even when not selected).
44. **Startup archive aging**: on app startup load, apply archive aging before first render; only persist if changes occur.
45. **Date-only due semantics**: due dates are stored at local midnight and all comparisons use local calendar days (not time-of-day).
46. **Tag normalization**: tags are normalized to lowercase ASCII `[a-z0-9_-]`, max length 24, deduped per task, and sorted alphabetically.
47. **Optional due time**: due dates can include an optional HH:mm time; same-day labels become time-based and overdue can be time-based.
48. **Selection-following scroll**: task list auto-scrolls so the selected row stays visible.
49. **Details due time**: when a task has an explicit time, show `DUE TIME: HH:mm` in the details pane.
50. **Add-time autocomplete**: in Add mode, show a right-arrow hint to complete a suggested time (1 hour ahead, preserves minutes); Right Arrow completes hour first, then minutes.
51. **Theme switcher (MVP)**: support `default`, `retro`, `highContrast`, `neonHacker`, `lightSlate`, `paperWhite`, `midnightBlack`, `jester`, `sonora`, `tigers`, `tech`, `deuteranopia`, `protanopia`, `tritanopia`, `blueAngels`, `southwest`, and `rams` palettes with no visual change to `default`.
52. **Theme keybind in Help**: while Help is open, pressing `h` or `H` cycles to the next palette.
53. **Theme persistence**: persist selected theme in `settings.json` with startup load and debounced saves.
54. **Help theme status readout**: Help pane shows current theme mode (`rotating` includes active concrete theme).
55. **Left rail logo separator**: render a horizontal ASCII separator under TADOI logo before version/menu metadata.
56. **Help pane app version**: show the current app version in the Help overlay.
57. **Rotating theme mode**: support a `rotating` theme option that auto-cycles concrete palettes every 15 seconds.
58. **v0.2.8 version surfaces**: app version indicators and package metadata are aligned to `v0.2.8` / `0.2.8`.
59. **Daily-driver list navigation primitives**: add `gg` (top), `G` (bottom), page navigation (`ctrl+u` / `ctrl+d`, plus PageUp/PageDown), and attention jumps (`[`/`]` for overdue, `{`/`}` for due-today).
60. **Saved Views (filter presets)**: users can save/apply/delete up to 9 filter presets (`v`, `ctrl+s`, `1..9`) with persistence and schema migration support.
61. **Global active-tag cycle filter**: `t` cycles through tags from all active (open) tasks, not only the selected task.
62. **Sort toggles**: `s` cycles list sorting (`DUE`, `UPDATED`, `CREATED`, `TITLE`) and current sort is visible in UI.
63. **Selection stability by task id**: on filter/search/sort changes, keep the same selected task id when possible; otherwise clamp to nearest valid index.
64. **Flash mode toggle**: while Help is open, `m`/`M` toggles flash mode between `slow` and `static`, with persistence in settings.
65. **Static overdue emphasis**: in `static` flash mode, overdue indicators remain solid red (no pulsing).
66. **Dashboard-toggle input guard**: `b`/`B` must not switch modes while typing in SEARCH/ADD/EDIT or save-view name prompt.
67. **Task-row mouse selection**: clicking within the task-row highlight area selects that task.
68. **Left-rail menu mouse selection**: clicking within a highlighted MENU row triggers that menu action.
69. **Editor button mouse support**: SAVE/CANCEL mouse interaction uses OpenTUI-supported mouse events.
70. **Bottom-bar quick-filter mouse toggles**: clicking due-summary buckets and top-tag pills toggles filters; clicking active item again clears.
71. **Dashboard top-tags panel**: replace backlog trend with `TOP TAGS (OPEN)` Pareto bars using fixed label/bar alignment.
72. **Dashboard top-tags drilldown**: `up`/`down` selects tag rows and `Enter` applies selected tag to shared filter state.
73. **Dashboard KPI strip**: add top strip with `OVERDUE`, `TODAY`, `NEXT7`, `OPEN`, `DONE7D` and block-element meters.
74. **KPI compact fallback**: at narrow widths, KPI strip falls back to abbreviated compact text instead of wrapping.
75. **KPI color semantics**: `OVERDUE`/`TODAY`/`NEXT7`/`OPEN` render blue, `DONE7D` renders green.
76. **Due-sort priority refinement**: default `DUE` sorting keeps open tasks with due dates at the top before other status/due combinations.
77. **Recurring series creation/editing**: editor supports Repeat mode presets (daily/weekly/monthly/custom RRULE), interval, end conditions, and next-3 preview.
78. **Virtual occurrence rendering**: recurring series render virtual occurrence rows by due window without persisting all instances.
79. **Occurrence completion semantics**: completing a recurring occurrence does not close the series; it creates/updates a done materialized instance and excludes the original occurrence from future virtual expansion.
80. **Occurrence skip/snooze**: `x` skips one occurrence via EXDATE; `z` snoozes one occurrence by +1 local day by materializing/updating an instance row.
81. **Occurrence-vs-series editing**: `e` edits selected occurrence, `E` edits whole series rule/metadata.
82. **Timezone/DST stability**: recurrence expansion preserves local wall-clock behavior across DST boundaries.
83. **Persistence schema v4**: recurrence and instance metadata are validated, migrated, and portable through import/export.
84. **Editor pane scroll containment**: Add/Edit pane uses two explicit regions: scrollable form content and fixed footer for actions/hints.
85. **Editor overflow controls**: Add/Edit form supports page scrolling (`ctrl+u`/`ctrl+d`, `PageUp`/`PageDown`) without affecting task-list scroll state.
86. **Repeat chip row fit**: repeat mode chips (`OFF`, `DLY`, `WLY`, `MLY`, `CUS`) stay on one line within the editor pane width.
87. **Overdue notification popup queue**: Tier-1 notifications appear as actionable modal popups (queued FIFO) instead of passive in-band banners.
88. **Overdue modal action keys**: overdue popup supports `S` snooze (+10m), `D` mark done, `G` go to task, and `Esc` dismiss, with equivalent mouse actions.
89. **Recurring-aware overdue modal actions**: overdue snooze/done/go-to flows preserve recurring-series semantics and use occurrence-aware target resolution.
90. **Theme registry expansion**: include accessibility-oriented palettes (`deuteranopia`/`protanopia`/`tritanopia`) and additional brand palettes (`blueAngels`/`southwest`/`rams`) in manual/rotating cycles.

### Non-Goals (MVP)
- Sync, accounts, multi-device
- Collaboration, sharing
- Advanced NLP date parsing (keep to ISO or explicit shortcut)
- Multi-tag boolean logic (AND/OR) beyond “single include tag”

---

## 2) Tech Stack

### Required
- Bun runtime
- OpenTUI core: `@opentui/core`
- OpenTUI React: `@opentui/react`  [oai_citation:3‡GitHub](https://github.com/anomalyco/opentui?utm_source=chatgpt.com)

### Optional (v1.1)
- SQLite (if JSON becomes limiting)
- Component library add-ons (e.g., awesome-opentui list)  [oai_citation:4‡GitHub](https://github.com/msmps/awesome-opentui?utm_source=chatgpt.com)

---

## 3) App UX / Layout

### 3.1 Layout regions (single screen)
Use OpenTUI flex layout with nested `<box>` containers.

- **Left Rail (fixed width ~18–24 cols)**
  - App title
  - Mode indicator (LIST / ADD / EDIT / HELP / SEARCH)
  - Filter summary badges
  - Quick hotkey hints (minimal)
- **Center Main (flexGrow: 1)**
  - Task list (scrollable)
- **Right Pane (width ~38–50 cols)**
  - Details view (default)
  - Editor form (when adding/editing)
  - Tag autocomplete dropdown anchored to tag field when active

### 3.2 Visual rules
- Prefer **solid blocks** over ASCII borders.
- Use rounded borders sparingly (only major panes).
- All-caps headings.
- “Buttons” = colored box with centered label.
- Maintain readability in 80×24.

### 3.3 Theme tokens
Define semantic tokens in `src/theme/themes.ts` and map runtime aliases in `src/app/theme.ts`.

Required token shape:
- `bg`, `panel`, `text`, `mutedText`, `border`
- `accent`, `accent2`
- `ok`, `warn`, `danger`
- `selectionBg`, `selectionText`

Theme ids:
- `default`, `retro`, `highContrast`, `neonHacker`, `lightSlate`, `paperWhite`, `midnightBlack`, `jester`, `sonora`, `tigers`, `tech`, `deuteranopia`, `protanopia`, `tritanopia`, `blueAngels`, `southwest`, `rams`, `rotating`

Runtime compatibility:
- Existing component color usage may continue using runtime aliases (`accentOrange`, `accentBlue`, `accentPurple`, `dueSoon`, `dueLater`, `muted`, `outline`) as long as they resolve from active semantic tokens.

Behavior:
- `default` must match existing release visuals.
- Theme changes should re-render immediately.
- Theme switching is available from Help with `h/H`.

---

## 4) Data Model

### 4.1 Types
```ts
type TaskStatus = "open" | "done" | "archived";

type Task = {
  id: string;          // uuid
  title: string;       // required
  status: TaskStatus;  // open|done|archived
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
  dueAt?: number;      // epoch ms at local midnight or explicit local time
  hasExplicitTime?: boolean; // distinguishes date-only from real time
  closedAt?: number;   // epoch ms (when marked done)
  notes?: string;      // multiline
  tags: string[];      // normalized, deduped, sorted
};

type TagIndexEntry = {
  tagName: string;     // canonical lower-case
  usageCount: number;
  lastUsedAt: number;  // epoch ms
};

type Filters = {
  status: "all" | "open" | "done" | "archived";
  due: "any" | "overdue" | "today" | "next7"; // "next7" == THIS WEEK (rolling next 7 days incl. today)
  tag?: string;        // single include tag (MVP)
  searchText?: string; // live search
};

type SortMode = "due" | "updated" | "created" | "title";

type SavedView = {
  id: string;          // uuid
  name: string;        // display label (case-preserving)
  filters: Filters;    // snapshot at save-time
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
};

Persistence:
- Save data with `schemaVersion` for migrations.
- Persisted envelope is `{ schemaVersion, tasks, tagIndex, savedViews }`.
- Migration sets `hasExplicitTime=false` for legacy tasks without time.
- Migration `2 -> 3` introduces `savedViews: []` for older files.
- Sort mode is runtime state (not persisted) and defaults to `due` on startup.

THIS WEEK definition:
- Rolling next 7 days including today, based on local-day boundaries (not calendar week).

Archive rule:
- If a task is done and its closed date is >7 days ago, mark it ARCHIVED.
- “ACTIVE” excludes archived; ARCHIVED view only appears when filter is set to archived.

Startup archive aging:
- Apply archive aging immediately after loading persisted data and before first render.
- Persist only if archiving actually changed any task.

Due-date semantics:
- Store due dates at local midnight for the selected date.
- Compare due buckets using local-day boundaries (today/overdue/this week).
- If a time is provided, store `hasExplicitTime=true` and combine date+time into `dueAt`.
- Same-day overdue is time-based when explicit time exists; otherwise date-only rules apply.
- When due dates share the same local day, explicit-time tasks sort before date-only tasks; times sort ascending.
- For due-today with explicit time, label uses “DUE IN N HOURS/MIN” or “OVERDUE BY N HOURS/MIN”.

Tag normalization rules:
- Trim whitespace, remove leading `#`, lowercase.
- Allow characters: `[a-z0-9_-]` only; remove everything else (including emojis).
- Truncate to max length 24; discard if empty.
- Dedupe per task and sort alphabetically for stable ordering.
- Display tags with exactly one leading `#` (stored tags remain bare).

Tag colors:
- Tag color palette supports up to 16 distinct colors.

Saved Views (v0.2.5 daily-driver #2):
- A saved view captures `{ status, due, tag, searchText }`.
- It does not capture UI-only state (selection index, scroll offset, mode/focus).
- Sort mode is runtime-only and is not persisted in saved views or state files.
- Name dedupe policy is case-insensitive update-by-name.
- Max saved views is 9.
```


---

# Appendix A — v0.2.0 Polished MVP (Focus Model + Modal Correctness + Scroll)

This appendix defines the “Layer 1” hardening work for v0.2.0. It is intentionally narrow:
- **Focus model**: consistent key routing and visible focus.
- **Modal correctness**: truly blocking modals with deterministic outcomes.
- **Scroll correctness**: selection-following scroll that works under navigation, filtering, and resize.

Implementation status:
- v0.2.3 Step 1 implemented formal `Mode`/`FocusTarget` constants in `src/ui/modeFocus.ts`, UI-only state/reducer in `src/ui/state.ts`, a centralized key router (`handleKey`) that returns routed actions, and centralized Esc unwind behavior.

## A1) UI State vs Domain State

### Domain state (persisted)
- Tasks, tag index, filters, schemaVersion, etc.

### UI state (NOT persisted)
- `mode` (LIST/ADD/EDIT/SEARCH/HELP/MODAL_CONFIRM)
- `focus` (`TASK_LIST` / `SEARCH_INPUT` / `MODAL` / `EDITOR_TITLE` / `EDITOR_DUE_DATE` / `EDITOR_DUE_TIME` / `EDITOR_TAGS` / `EDITOR_NOTES`)
- `selectedIndex`
- `scrollOffset`
- `modal` (type + payload + previous mode/focus snapshot)
- transient banner/status messages
- ticker phase

**Rule:** UI state must be reconstructible on restart. Do not persist scroll/focus/mode.

## A2) Mode & Focus Model

### Modes
- `LIST`: normal navigation and actions
- `ADD`: editor pane open with new draft
- `EDIT`: editor pane open with existing task draft
- `SEARCH`: search input focused
- `HELP`: help overlay visible
- `MODAL_CONFIRM`: delete confirmation (and future confirmations)

### Focus targets
- `TASK_LIST` (default in LIST)
- `EDITOR_TITLE`, `EDITOR_DUE_DATE`, `EDITOR_DUE_TIME`, `EDITOR_TAGS`, `EDITOR_NOTES`
- `SEARCH_INPUT`
- `MODAL` (always captures input)
- Temporary compatibility targets used by current editor controls:
- `EDITOR_SAVE`, `EDITOR_CANCEL`

### Key routing rules
1. If `mode === MODAL_CONFIRM`: **only** keys for the active modal type are handled; all other inputs are ignored.
   - Delete modal: `y`, `n`, `Esc`.
   - Overdue modal: `s`, `d`, `g`, `Esc`.
2. If an input field is focused (ADD/EDIT/SEARCH): printable characters go to that input only.
3. List navigation keys (`j/k`, arrows) must NOT move selection when focus is in a text input.
4. `Esc` always backs out one layer:
   - MODAL → return to previous mode
   - HELP → return to previous mode
   - SEARCH → return to LIST (preserve search text, unless explicitly cleared)
   - ADD/EDIT → cancel draft and return to LIST
5. Routing precedence is centralized in a single router:
   - `MODAL_CONFIRM` → `HELP` → `SEARCH` → `ADD/EDIT` → `LIST`.
6. Advanced list navigation keys are LIST+TASK_LIST only:
   - `gg`: jump to top
   - `G`: jump to bottom
   - `ctrl+u` / `ctrl+d` (and PageUp/PageDown where supported): page up/down
   - `[` / `]`: previous/next overdue task
   - `{` / `}`: previous/next due-today task
   - If no match exists for attention jumps, show a brief non-modal banner.

### Visible focus indicator
- Left rail shows **MODE** (already) and also a short **FOCUS** indicator (e.g., `FOCUS: LIST`, `FOCUS: TITLE`, `FOCUS: DELETE`) OR highlight the active section strongly enough to be unambiguous.
- UI label rule: when internal mode is `MODAL_CONFIRM`, the left-rail mode/menu label should read `DELETE`.

## A3) Modal Correctness

### Delete confirm modal
- Trigger: `d` in LIST mode.
- UI: centered overlay “DELETE? (y/n)” plus the task title or id snippet.
- Input capture: modal must block all other keybinds until resolved.
- Resolution:
  - `y`: delete task, close modal, return to LIST.
  - `n` or `Esc`: close modal, return to LIST, no changes.

### Overdue notification modal
- Trigger: notification event on overdue transition while app is open.
- UI: centered “Task Overdue” popup with due details, overdue duration, and tags (when available).
- Input capture: popup modal blocks background keybinds until resolved.
- Resolution:
  - `s` (or click action): snooze task by +10 minutes.
  - `d` (or click action): mark task done.
  - `g` (or click action): jump/reveal task in list mode (including recurring fallback targets).
  - `Esc`: dismiss popup and continue to next queued overdue event.

### Post-delete selection rule
- If list becomes empty: selection is `0` / none.
- Else if deleted index was last item: select previous index.
- Else: keep same index (which now points at next item).

### DoD for modal correctness
- While modal is open, pressing navigation keys does not move selection.
- While modal is open, typing does not edit fields.
- Delete outcome is deterministic and selection remains valid/visible.

## A4) Scroll Correctness (Selection-Following)

### Goal
When selection changes, the selected task row must remain visible in the task list viewport.

### Definitions
- `visibleRows`: number of rows available for task rendering in the list pane.
- `scrollOffset`: index of first visible task.
- `selectedIndex`: index in the *visible* (filtered/sorted) tasks array.

### EnsureSelectedVisible algorithm
- If `selectedIndex < scrollOffset`: `scrollOffset = selectedIndex`
- Else if `selectedIndex >= scrollOffset + visibleRows`: `scrollOffset = selectedIndex - visibleRows + 1`
- Clamp `scrollOffset` to `[0, max(0, taskCount - visibleRows)]`

### Triggers
Call `ensureSelectedVisible()` whenever:
- selection changes (j/k, arrows, or mouse click in the task-row highlight hitbox)
- filter/search changes visible list
- list length changes (delete, archive aging, etc.)
- terminal resizes (visibleRows changes)

### DoD for scroll correctness
- In a list longer than the viewport, holding `j`/`k` keeps the selected row on-screen.
- After filtering or deleting, selection is clamped and visible.
- Resizing the terminal keeps the selection visible and avoids crashes.

### Daily-driver navigation behavior
- `gg` selects first visible task and keeps it visible.
- `G` selects last visible task and keeps it visible.
- Page navigation moves by `visibleRows - 1` and clamps in-range.
- `s` cycles sort mode in this order:
  - `DUE`: priority groups `open+due`, `open+no due`, `done+due`, `done+no due`, then archived groups; within same due day explicit-time tasks first, then time asc, then date-only, then stable fallback.
  - `UPDATED`: `updatedAt` desc.
  - `CREATED`: `createdAt` desc.
  - `TITLE`: title asc (case-insensitive).
- `t` cycles tag include-filter through the global active-task tag pool (open tasks), then clears.
- Attention jumps use current due semantics:
  - Overdue uses date-only and explicit-time same-day overdue rules.
  - Due-today uses local-day today.
- Attention jumps wrap and show a brief banner when no target exists.

### Selection reconciliation behavior
- Selection tracks task identity (`selectedId`) across sort/filter/search changes.
- If `selectedId` remains visible after list recompute, keep that task selected.
- If `selectedId` disappears, select the nearest valid index using prior list index clamped to new bounds.
- After reconciliation, run visibility guard so the selected row remains in viewport.

### Daily-driver saved views behavior
- List-mode keys:
  - `v`: toggle Saved Views overlay.
  - `ctrl+s`: open save prompt for current filter snapshot.
  - `1..9`: apply saved view slot directly when overlay is closed.
- Overlay keys:
  - `j/k` or arrows: move selected saved view.
  - `enter`: apply selected view.
  - `d`: delete selected view (non-modal confirm in MVP).
  - `esc` or `v`: close overlay.
- Save prompt keys:
  - `enter`: save/update view.
  - `esc`: cancel save prompt.
- Applying a view updates filters immediately and relies on existing selection clamp + scroll-visibility behavior.

## A5) v0.2.0 Quality Gates (manual, required)
1. **Focus routing**: in ADD/EDIT, typing never moves list selection; in LIST, typing does not “leak” into inputs.
2. **Modal correctness**: modal blocks background; y/n/Esc behave exactly as specified.
3. **Scroll correctness**: selected row stays visible during navigation, filtering, delete, and resize.


# Appendix B — v0.2.1 Data Safety & Storage

This appendix defines reliability and persistence discipline for v0.2.1.
It intentionally scopes to internal data safety and storage behavior, with no
new end-user feature requirements.
UI terminology and semantics remain unchanged (for example, internal `next7`
still maps to UI label `THIS WEEK` with rolling 7-day behavior).

## B1) Persistence Location

### Resolution order
1. Environment override (always wins):
- `TADOI_DATA_PATH=/absolute/or/relative/path.json`

2. Default location (when `TADOI_DATA_PATH` is unset or empty):
- Linux/XDG:
- `$XDG_DATA_HOME/tadoi/tadoi_data.json`
- If `XDG_DATA_HOME` is unset/empty:
- `$HOME/.local/share/tadoi/tadoi_data.json`
- macOS:
- `$HOME/Library/Application Support/tadoi/tadoi_data.json`
- Windows:
- `%APPDATA%\\tadoi\\tadoi_data.json`
- Fallback when `%APPDATA%` is unavailable:
- `$HOME\\AppData\\Roaming\\tadoi\\tadoi_data.json`

### Requirements
- Parent directories must be created if missing.
- The resolved data path must be visible for troubleshooting in at least one
debug-visible location (startup log and/or status/help line).

## B2) Safe Load & Corruption Recovery

### Startup behavior
- If data file does not exist:
- Start with empty state and continue.

- If file exists and any of these fail:
- JSON parse
- schema validation
- migration

Then:
- Back up the bad file in the same directory as:
- `tadoi_data.json.corrupt.YYYYMMDD-HHMMSS`
- If rename fails, attempt copy and keep original.
- Do not crash.
- Start with empty state at current `schemaVersion`.
- Show a persistent message:
- `Data file was corrupt and was backed up to <filename>`

### Safety rules
- Never write over a corrupt file without creating a backup first.
- Recovery must avoid infinite backup loops (for example, repeated failures on
fresh empty-state save should not create unbounded `.corrupt.*` files).
- If backup filename collides, append a numeric suffix.

## B3) Schema Versioning & Migrations

### Required schema discipline
- Persisted JSON must include `schemaVersion: number`.
- Any persisted schema change must:
- increment `schemaVersion`
- add one migration step `N -> N+1`
- add/update migration fixture tests

### Required load pipeline
1. Parse JSON.
2. Validate minimal shape (`schemaVersion` present, task array shape present).
3. Migrate step-by-step to current `schemaVersion`.
4. Validate again after migration.
5. Hydrate app state only after successful validation.

## B4) Data Integrity Invariants

After successful load/migration, the following invariants must hold:
- `task.id` is present and unique.
- `status` is one of `{open, done, archived}`.
- Tags are normalized/deduped/sorted, or normalized during migration.
- Timestamp fields are numeric when present:
- `dueAt`, `closedAt`, `createdAt`, `updatedAt`
- `hasExplicitTime` is boolean when present.
- `savedViews` is an array when present.
- Each saved view has non-empty `id` and `name`.
- Saved-view filters stay in allowed domains:
  - `status`: `{all, open, done, archived}`
  - `due`: `{any, overdue, today, next7}`
  - `tag`/`searchText` are strings when present.
- Unknown fields are tolerated and ignored unless they break parsing/validation.

## B5) Persistence Interfaces (Spec Guidance)

These interfaces are spec-level contracts for v0.2.1:

```ts
resolveDataPath(): string
validatePersistedState(input: unknown): ValidationResult
migratePersistedStateToCurrent(
  input: PersistedState,
  currentVersion: number
): PersistedState
safeLoadState(): {
  data: PersistedState
  bannerMessage?: string
  corruptBackupPath?: string
}
```

Persisted envelope:
- `{ schemaVersion, tasks, tagIndex, savedViews }`


# Appendix C — v0.2.2 Automated Tests & CI Gates

This appendix defines automated verification requirements for v0.2.2.
Scope is quality gates only: no new end-user product features.

## C1) Required Merge Gates

All pull requests and pushes to `main` must pass these checks:
- `ci (ubuntu-latest)`: `bun run test`, `bun run test:coverage`, `bun run typecheck`, `bun run brand:check`, `bun run pack:dry`, `bun run pack:inspect`, `bun run pack:smoke`
- `ci (macos-latest)`: `bun run test`, `bun run test:coverage`, `bun run typecheck`, `bun run brand:check`
- `ci (windows-latest)`: `bun run test`, `bun run test:coverage`, `bun run typecheck`, `bun run brand:check`

Merge policy:
- CI must be green before merge.
- Any failed required job blocks merge.

## C2) Test Categories

### Domain tests
- Task filtering/sorting behavior:
- due filter boundaries (`overdue`, `today`, `next7/THIS WEEK`)
- same-day sorting (`hasExplicitTime=true` tasks before date-only tasks, time asc)
- due label text rules:
- date-only today: `DUE TODAY`
- explicit-time today: `DUE IN N HOURS/MIN`
- explicit-time overdue today: `OVERDUE BY N HOURS/MIN`
- Tag normalization invariants:
- allowed chars `[a-z0-9_-]`
- max length 24
- emoji/non-ASCII stripping
- dedupe and alphabetical sort

### Persistence/schema tests
- Validation:
- missing/invalid `schemaVersion` rejected
- malformed task shape rejected
- Migration:
- legacy fixtures migrate stepwise to current schema and validate
- unsupported future schema errors are handled by recovery path
- Corruption recovery:
- parse/validation/migration failures back up corrupt data and return clean empty state with banner
- rename failure uses copy fallback path

### Data path tests
- `TADOI_DATA_PATH` override precedence.
- Linux/macOS/Windows default path resolution.
- Parent-directory creation before writes.

## C3) Local Developer Commands

Run locally before opening/merging a PR:

```bash
bun run test
bun run test:coverage
bun run typecheck
bun run brand:check
bun run pack:dry
bun run pack:inspect
bun run pack:smoke
```

Coverage:
- Coverage is reported in CI logs via `bun run test:coverage`.
- No percentage threshold is enforced in v0.2.2.

## C4) CI Workflow Contract

Workflow location:
- `.github/workflows/ci.yml`

Triggers:
- `pull_request`
- `push` to `main`

Runner baseline:
- Matrix: `ubuntu-latest`, `macos-latest`, `windows-latest`
- Bun setup via `oven-sh/setup-bun@v2` (pinned Bun `1.3.9`)

Execution:
- install dependencies with `bun install --frozen-lockfile`
- run required merge gates listed above
- run packaging commands (`pack:dry`, `pack:inspect`, `pack:smoke`) on the Ubuntu matrix leg


# Appendix D — v0.2.2 Theme Switching & Settings Persistence

This appendix defines the lightweight palette switcher delivered in v0.2.2.

## D1) Theme Registry

Single source of truth:
- `src/theme/themes.ts`

Contracts:
- `ThemeId = "default" | "retro" | "highContrast" | "neonHacker" | "lightSlate" | "paperWhite" | "midnightBlack" | "rotating"`
- `ThemeTokens` semantic keys:
- `bg`, `panel`, `text`, `mutedText`, `border`
- `accent`, `accent2`
- `ok`, `warn`, `danger`
- `selectionBg`, `selectionText`
- `THEMES: Record<ThemeId, ThemeTokens>`
- `THEME_ORDER` fixed order:
- `["default", "retro", "highContrast", "neonHacker", "lightSlate", "paperWhite", "midnightBlack", "rotating"]`
- `ROTATING_THEME_ORDER` concrete cycle order:
- `["default", "retro", "highContrast", "neonHacker", "lightSlate", "paperWhite", "midnightBlack"]`
- `cycleTheme(current)` returns the next theme in order and wraps.

Palette notes:
- `default` mirrors existing release colors.
- `retro` uses SNES-style cool greys.
- `neonHacker` uses a dark-green left rail and greener panel background.

## D2) Runtime Theme Application

Runtime adapter:
- `src/app/theme.ts` exports `applyTheme(themeId)` and a mutable runtime `theme`.
- Existing components continue using current keys; adapter remaps them from semantic tokens.
- Theme updates are immediate and do not require app restart.
- When selected theme is `rotating`, runtime applies a concrete theme from `ROTATING_THEME_ORDER` and auto-advances every 15 seconds.

## D3) Settings Persistence

Settings model:
- `TadoiSettings = { themeId, flashMode }`
- `flashMode` values: `"slow"` (default) or `"static"`

File location:
- Primary: `~/.config/tadoi/settings.json`
- Fallback: `~/.tadoi/settings.json`

Behavior:
- Startup: load settings, merge with defaults, apply theme/flash mode before first render.
- Save: debounce writes (`150ms`) and persist the most recent theme + flash mode.
- If primary write fails, attempt fallback path.

## D4) Help Pane UX

Help interactions:
- `h` or `H` while Help is open cycles theme.
- `m` or `M` while Help is open toggles flash mode (`slow` / `static`).
- `n` or `N` while Help is open toggles notifications master switch.
- `o` or `O` while Help is open toggles overdue popup notifications.
- `l` or `L` while Help is open toggles terminal bell notifications.
- `up` / `down` moves selected Help section.
- `left` / `right` collapses/expands selected Help section.
- `enter` / `space` toggles selected Help section.
- `ctrl+u` / `PageUp` and `ctrl+d` / `PageDown` page Help content.
- Help displays current theme id.
- For rotating mode, Help shows `Theme mode: rotating (active: <activeTheme>)`.

## D5) Left Rail Visual Separator

The left rail renders an ASCII horizontal separator directly below the TADOI logo to clearly separate branding from version/date/time/menu metadata.

# Appendix E — v0.2.3 Routing Hardening & Version Surfaces

This appendix captures the v0.2.3 hardening pass and release metadata alignment.

## E1) Central Key Routing

Routing contract:
- `src/app/keyRouter.ts` exports `handleKey(key, context)`.
- The function is pure and returns routed actions only (no side effects).
- `src/app/App.tsx` has a single `useKeyboard` entrypoint that:
- calls `handleKey(...)`
- dispatches returned UI/domain actions

Rules enforced:
- `MODAL_CONFIRM` blocks background keys and resolves only active-modal keys (`y`/`n`/`Esc` for delete, `s`/`d`/`g`/`Esc` for overdue popup).
- `SEARCH` and editor input modes do not leak list navigation keys.
- `Esc` always routes to unwind behavior and exits one layer.

## E2) Version Surfaces

Version contract:
- App version is centralized in `src/app/version.ts` as `APP_VERSION`.
- Left rail displays `APP_VERSION`.
- Help pane displays `App Version: <APP_VERSION>`.
- Package metadata in `package.json` matches the same release (`0.2.8`).

---

# Appendix F — v0.2.5 Foundation Polish (Platform Contract + Reliability + Performance)

This appendix captures the “Section 1” foundation work required to move from a polished MVP to a more robust product.
Scope is **clarification + hardening**: documented support boundaries, stronger failure-mode behavior, and explicit performance targets.
No new feature sets (sync/recurrence/etc.) are introduced in v0.2.5.

## F1) Platform Contract (Supported Environments)

### Supported terminals (documented)
TADOI must be verified on these baseline environments:
- macOS: Terminal.app and iTerm2
- Windows: Windows Terminal
- Linux: GNOME Terminal (baseline)

### Minimum terminal geometry
- Minimum supported size remains **80×24**.
- If below minimum, show a centered warning screen:
  - `Terminal too small (min 80x24) | Current: <WxH>`
- While below minimum, normal app interactions are paused to avoid layout churn.
- When the terminal returns to supported size, full UI rendering and interaction resume with current in-memory state.

### Data path troubleshooting surface
- The resolved **task data path** (from Appendix B) must be visible for troubleshooting in at least one user-visible place:
  - Help overlay line OR left-rail debug line OR startup log.

## F2) Reliability Hardening (Failure Modes)

### Save failure behavior (must not crash)
If persistence write fails (permissions, disk full, IO error):
- Keep app running (no crash).
- Show a persistent banner message containing:
  - short error summary
  - resolved data path
  - last successful save timestamp (if tracked)
- Do not spin/loop retries aggressively; retry only on the next domain mutation or on a manual “retry save” command if you add one later.

### Corruption recovery loop prevention
Corruption recovery (Appendix B) must not create unbounded `.corrupt.*` files:
- If a corrupt file was already backed up on this startup attempt, do not back up again in the same session unless the user explicitly points at another path.
- If an empty-state save fails, do not attempt repeated backup cycles.

### “Persist only on change” enforcement
UI-only ticks (clock, ticker, pulses) must never trigger writes.
Only domain mutations that change persisted state may schedule a save.

## F3) Performance Envelope (Explicit Targets)

### Performance target
Define a baseline target for v0.2.5:
- **2,000 tasks** (mixed due states, tags) should allow smooth list navigation without perceptible lag.
- Navigation latency target: selection update visible within ~50ms on typical laptop hardware.

### Measurement approach (lightweight)
- Add an optional debug mode (env flag) to log:
  - render tick duration (ms)
  - visible task count and window size
- Env flag: `TADOI_PERF_DEBUG=1`
- Avoid heavy profiling systems; keep this as console/log output only.

### Rendering constraints
- Task list should render only visible rows (windowing/virtualization) using `scrollOffset` + `visibleRows`.
- Sorting/filtering should be pure and efficient; avoid recomputing heavy indexes on every render tick.

## F4) v0.2.5 Manual QA Additions

In addition to existing quality gates:
1. **Below-min-size behavior**: shrink terminal below 80×24; verify clean “too small” message, no crash.
2. **Save failure**: point data path to an unwritable location; verify banner and continued operation.
3. **Large list**: load/generate 2k tasks; verify navigation remains responsive and selection-following scroll remains correct.

## F5) v0.2.5 Readiness Execution Log

Execution snapshot (2026-02-09 CST):
- Manual quality gate `T7.1` executed and passed:
  - Verified normal layout and interaction at `80x24`.
  - Verified centered guard at `79x23` with message:
    - `Terminal too small (min 80x24). Current: 79x23.`
  - Verified safe recovery to normal UI after restoring supported size.
- Manual quality gate `T7.2` executed and passed:
  - Ran with isolated persistence path (`TADOI_DATA_PATH=/tmp/tadoi-qa-interrupt.json`).
  - Created task data, interrupted runtime with `Ctrl+C`, restarted, and confirmed persisted JSON remained parseable and task data loaded.
- Documentation sync:
  - README keybindings now reflect current router behavior, including:
    - `gg` / `G`, paging (`ctrl+u` / `ctrl+d`), attention jumps (`[]`, `{}`),
      sort cycling (`s`), saved views (`v`, `ctrl+s`, `1..9`), and global active-tag cycling (`t`).

---

# Appendix G — v0.2.5 Packaging Readiness (Non-Live + Installer Scaffolding)

This appendix defines the packaging contract for pre-release distribution.
Scope is packaging infrastructure only. No public release or feature changes are included.

## G1) Non-Live Distribution Policy

- `package.json` remains `"private": true`.
- No `npm publish` / `bun publish` in this phase.
- Primary distribution artifact is a local/private npm tarball.
- CLI command remains `tadoi`.
- Runtime expectation remains Bun-based for CLI execution (`#!/usr/bin/env bun`).

## G2) Artifact Layout Contract

Standardized output paths:
- Tarball artifacts: `dist/tarball/*.tgz`
- Binary scaffolds (future): `dist/bin/macos/*`, `dist/bin/windows/*`
- Installer scaffolds (future): `dist/installers/*`

Release target matrix:
- `packaging/release-targets.json` tracks target ids and statuses:
  - `tarball` = active
  - `binary-macos` = planned
  - `binary-windows` = planned

## G3) Packaging Script Contract

Required scripts:
- `bun run pack:dry`
  - Builds tarball into `dist/tarball/`.
- `bun run pack:inspect`
  - Validates package file set using `bun pm pack --dry-run`.
  - Confirms required runtime files and rejects forbidden local/data/doc artifacts.
- `bun run pack:smoke`
  - Extracts the generated tarball into a temporary directory and runs `tadoi --help` via the packaged CLI entry.
  - Fails if CLI help output contract is broken.
- `bun run release:rc:check`
  - Runs pre-release gate sequence: test, typecheck, branding guard, tarball build, inspect, smoke.

## G4) CI Packaging Gate

CI workflow (`.github/workflows/ci.yml`) includes a cross-platform `ci` matrix job (`ubuntu-latest`, `macos-latest`, `windows-latest`).
Packaging commands run on the Ubuntu matrix leg:
- `bun run pack:dry`
- `bun run pack:inspect`
- `bun run pack:smoke`

Policy:
- Matrix job runs on `pull_request` and `push` to `main`.
- Merge must remain blocked on package gate failures.

## G5) Future DMG/EXE Track (Scaffold Only)

Scaffold scripts:
- `bun run build:bin:mac`
- `bun run build:bin:win`

Current behavior:
- Scripts create planning artifacts only.
- No real binary, DMG, EXE, or MSI is produced yet.

Future requirements (outside this phase):
- macOS signing + notarization pipeline.
- Windows code signing + installer toolchain selection.
- CI secrets and release hardening for installer generation.

---

# Appendix H — v0.2.5 Data Portability (Import/Export)

This appendix defines CLI-only portability for full persisted state transfer.
Scope is import/export tooling and documentation only; no interactive in-app import/export workflow is included.

## H1) CLI Surface

Export:
- `tadoi export --out <path> [--format json] [--pretty] [--redact]`

Import:
- `tadoi import --in <path> [--mode merge|replace] [--backup|--backup=false|--no-backup] [--dry-run] [--yes] [--pretty]`

Replace guard:
- `--mode replace` must include `--yes` or import exits non-zero.

## H2) Portability Payload Contract

Export payload includes:
- Persisted envelope: `{ schemaVersion, tasks, tagIndex, savedViews }`
- Settings sidecar: `{ settings }` where `settings.themeId` and `settings.flashMode` are persisted when available

Notes:
- Filters remain runtime/UI state and are not imported/exported because they are not persisted in the primary data envelope.
- Unknown extra fields remain tolerated by strict validation behavior.

## H3) Import Validation + Migration Pipeline

Required pipeline:
1. Parse JSON
2. Minimal validation
3. Migrate stepwise to current schema
4. Strict validation

Legacy handling:
- Missing `schemaVersion` is coerced to `0` and then migrated through required steps to current schema.
- Import fails non-zero if migration or strict validation fails.

## H4) Merge/Replace Policy

### Merge mode (default)
- Tasks are merged by `id`.
- Task conflict resolution:
1. Newest `updatedAt` wins (`missing => 0`)
2. If tied, newest `createdAt` wins (`missing => 0`)
3. If still tied, incoming wins (deterministic)
- Saved views merge by name (case-insensitive):
1. Newest `updatedAt` wins
2. If tied, incoming wins
- `tagIndex` is recomputed from merged tasks (stored tagIndex is not merged) for deterministic drift-free output.

### Replace mode
- Imported state replaces local persisted envelope.
- Requires `--yes`.
- Backup is performed before overwrite when enabled.

## H5) Backup + Write Safety

Backup behavior:
- Default backup is enabled for merge and replace.
- Backup filename pattern:
  - `tadoi_data.json.backup.YYYYMMDD-HHMMSS`
  - with numeric suffix (`.1`, `.2`, …) on collisions
- If backup creation fails, import aborts and does not overwrite local data.

Write behavior:
- State writes are atomic (temp + rename).
- Dry-run performs parse/validate/migrate/merge summary only; no backup/write side effects.
- If settings apply fails after state write, import exits non-zero with explicit partial-success messaging.

## H6) Help Overlay Documentation Contract

Help overlay must include a `DATA: IMPORT / EXPORT` section with:
- resolved data path
- export/import examples
- merge conflict note (`updatedAt` winner policy)
- replace overwrite warning + backup note
- sharing caution with `--redact`

---

# Appendix I — Dashboard Runtime Contract (Current)

This appendix defines the dashboard behavior currently shipped in runtime UI.
Scope includes interactive top-tag drilldown and KPI-strip rendering; dashboard state remains UI-only.

## I1) Mode + Key Routing Contract

Mode/focus additions:
- `Mode.DASHBOARD`
- `FocusTarget.DASHBOARD`

Toggle behavior:
- `b` / `B` toggles `LIST <-> DASHBOARD` from non-modal, non-text-entry flows.
- Dashboard toggle is blocked while modal-confirm is active (modal precedence remains highest).
- Dashboard toggle is also blocked while SEARCH/ADD/EDIT or save-view name prompt is active.

Dashboard key contract:
- Allowed: `b`/`B`, `f`, `g`, `t`, `up`, `down`, `enter`, `?`, `q`
- Blocked: list navigation/action keys (for example `j/k`, paging, jump keys)
- Routing remains centralized in `src/app/keyRouter.ts`.
- Exit teardown is graceful: `q` routes to renderer teardown (`renderer.destroy()`), not direct `process.exit(...)` from interactive app handlers.
- `Ctrl+C` behavior remains renderer-managed via `createCliRenderer({ exitOnCtrlC: true })`.

Top-tags interaction:
- `up`/`down` changes selected `TOP TAGS (OPEN)` row.
- `enter` applies selected tag to shared filter state (`filters.tag = selectedTag`).
- If status is `done`/`archived`, enter shows an availability hint instead of applying a tag.

## I2) Filter Parity Contract

Dashboard widgets use the exact same filtered dataset as task-list rendering:
- `visibleTasks = getVisibleTasks(state, now)`
- shared semantics for:
  - `status`
  - `due`
  - `tag`
  - `searchText` (when present)

Single source of truth:
- No dashboard-specific filter model is introduced.

## I3) Widget Aggregation Contracts

Pure domain functions:
- `computeDueBuckets8(tasks, now): [number, number, number, number, number, number, number, number]`
- `computeTopTagsOpen(tasks, limit): Array<{ tag: string; count: number }>`
- `computeDashboardKpis(tasks, nowMs): { overdue, today, next7, open, done7d }`

Due bucket contract (`computeDueBuckets8`):
- Buckets map to:
  1. overdue
  2. today
  3. +1 day
  4. +2 days
  5. +3 days
  6. +4 days
  7. +5 days
  8. +6 days
- Tasks with `dueAt` undefined are excluded.
- Uses local-day boundaries consistent with existing date helpers.

Top tags contract (`computeTopTagsOpen`):
- Counts tags from open tasks only.
- Sort order is count descending, then tag ascending.
- Non-positive limits return empty output.

KPI contract (`computeDashboardKpis`):
- `overdue`: open tasks overdue (day-based or explicit-time same-day overdue)
- `today`: open tasks due today
- `next7`: open tasks due within `[today..today+6]`
- `open`: open task count
- `done7d`: done/closed tasks in last 7 local days from current filtered dataset

## I4) Rendering + UX Contract

Layout behavior:
- In dashboard mode, main content renders dashboard widgets instead of list/details split.
- Left rail, top bar, and bottom bar remain active.
- Top bar shows dashboard context and current filtered task count.
- Dashboard has three visualization zones:
  - top: KPI strip
  - left panel: due buckets
  - right panel: `TOP TAGS (OPEN)` chart
- Body uses 2:1 split (due buckets left, top tags right) with stacked fallback when width is too narrow.
- Due-bucket panel enforces minimum render width; if too narrow it shows a friendly placeholder.

KPI strip rendering:
- KPI strip appears above both body panels.
- KPI cells distribute width across the full strip (no trailing unused gap).
- KPI colors:
  - `OVERDUE`, `TODAY`, `NEXT7`, `OPEN`: blue
  - `DONE7D`: green
- Meters use Unicode block elements and compact to abbreviated text at narrow widths.

Top tags rendering:
- Rows use fixed label and bar alignment so bars start at a consistent x-position.
- Long tags truncate with ellipsis without shifting bar starts.
- If status filter is `done` or `archived`, panel shows `(Top tags available for OPEN tasks only)`.

Readability:
- Must remain legible at minimum supported `80x24`.
- Existing below-min-size guard behavior remains the governing fallback.

Mode-transition redraw:
- Entering/leaving dashboard invalidates stale layout/border artifacts and forces fresh frame render.
- Border drawing remains stable after mode toggles and terminal resizes.

## I5) Documentation + Tests Contract

Docs:
- README keybindings include dashboard toggle and dashboard-mode key behavior.
- Help overlay includes dashboard section describing:
  - toggle behavior
  - shared filter parity
  - KPI + due-buckets + top-tags meaning
  - top-tags `up`/`down` + `enter` drilldown

Tests:
- Domain unit tests cover dashboard due-bucket, top-tags, and KPI aggregation behavior.
- Key-router tests verify:
  - `b`/`B` toggle routing
  - text-entry guard for `b`/`B` (SEARCH/ADD/EDIT/save-view prompt)
  - dashboard mode key allowlist (including `up`/`down` + `enter`)
  - list-key leakage prevention while dashboard is focused

---

# Appendix J — v0.2.8 Interaction Polish (Mouse + Flash + Input Guard)

This appendix defines interaction-polish contracts added after dashboard MVP scope.

## J1) Editor Mouse Contract

- Editor SAVE/CANCEL controls must respond to OpenTUI-supported mouse press handlers.
- Runtime implementation uses `onMouseDown` (not `onClick`) for consistent behavior.
- Left-click on SAVE routes to the same save flow as keyboard submit.
- Left-click on CANCEL routes to the same unwind/cancel flow as keyboard `Esc`/cancel focus.

## J2) Task List Mouse Selection Contract

- Each rendered task row is mouse-selectable.
- Click target is the same full rectangular row area that receives selection background highlight.
- Left-click selects by task id and preserves existing selection-visibility guarantees (`ensureSelectedVisible()` path still applies via selection effects).

## J3) Left-Rail MENU Mouse Contract

- MENU rows are mouse-selectable for: `LIST`, `DASHBOARD`, `ADD`, `EDIT`, `SEARCH`, `HELP`, `DELETE`.
- Click target is the same full rectangular row area used for menu highlight styling.
- Left-click routes through the same action handlers used by keyboard flows.
- `HELP` click while already in Help is a no-op to avoid overwriting return-context.

## J4) Dashboard Toggle Text-Entry Guard Contract

- `b`/`B` dashboard toggles are ignored while focus is in text-entry contexts:
  - `SEARCH`
  - `ADD`
  - `EDIT`
  - saved-view name prompt
- This guard prevents accidental dashboard toggles while typing the letter `b`.

## J5) Flash Mode Static Contract

- Help key `m`/`M` toggles flash mode between `slow` and `static`.
- Flash mode persists in settings (`settings.json`) with startup restore.
- In `static` mode, due/overdue pulsing is disabled.
- In `static` mode, overdue indicators remain solid red across list/details/left-rail due surfaces.

## J6) Bottom-Bar Quick-Filter Mouse Contract

- Bottom rotating info-bar pills are mouse-clickable:
  - due summary buckets (`OVERDUE`, `DUE TODAY`, `DUE THIS WEEK`)
  - top tag pills
- Clicking a quick-filter pill applies the corresponding shared list/dashboard filter.
- Clicking an already-active quick-filter pill clears that quick filter and resets to baseline.
- Pill hitboxes match highlighted pill rectangles; border/padding must not cause overflow or line-wrap artifacts.

## J7) Default DUE Sort Priority Contract

- Default `DUE` sort mode prioritizes by status/due presence before date/time ordering:
  1. open tasks with due date
  2. open tasks without due date
  3. done tasks with due date
  4. done tasks without due date
  5. archived tasks (same due/no-due grouping)
- Within equal-priority tasks sharing local due day:
  - explicit-time tasks sort before date-only tasks
  - explicit-time tasks sort by ascending time
  - final fallback uses stable deterministic tie-breaks

## J8) Add/Edit Pane Scroll-Containment Contract

- Add/Edit pane rendering is split into:
  - scrollable content region (form fields)
  - fixed footer region (SAVE/CANCEL + hints)
- Form content must never draw into the footer region.
- At constrained heights, form content scrolls while footer remains visible.
- Editor field focus changes auto-scroll to keep the focused field in view.
- Editor scrolling keys:
  - `ctrl+u` / `PageUp` scroll up one editor page
  - `ctrl+d` / `PageDown` scroll down one editor page
- Repeat mode chips (`OFF`, `DLY`, `WLY`, `MLY`, `CUS`) remain on one line.
