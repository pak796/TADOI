# SPEC.md — ToDui (TypeScript + OpenTUI)

## 0) Summary

Build a keyboard-first terminal TUI todo app with a **retro Star Trek / LCARS-inspired layout**, using **OpenTUI** + **@opentui/react** on **Bun**.
Naming: replace LCARS with **ToDui** in the app UI and filenames.

v0.2.1 scope note:
- This version focuses on data safety and schema discipline.
- No net-new user-facing features are introduced in v0.2.1.

- Runtime: Bun (OpenTUI quick start uses Bun; `bun create tui`)  [oai_citation:0‡GitHub](https://github.com/anomalyco/opentui?utm_source=chatgpt.com)
- UI binding: @opentui/react provides React reconciler + patterns like `createRoot` and `useKeyboard`.  [oai_citation:1‡npm](https://www.npmjs.com/package/%40opentui/react?utm_source=chatgpt.com)
- OpenTUI is in development / not production-ready; MVP should keep dependencies minimal and tolerate API drift.  [oai_citation:2‡GitHub](https://github.com/anomalyco/opentui?utm_source=chatgpt.com)

Deliverables:
- Fully functional MVP (no sync) with **tag autocomplete**.
- Local persistence (JSON file) with safe writes.
- Single-screen ToDui layout with list + details/edit + left “rail”.

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
14. **Layout placement**: “TODUI” stays at the top of the left rail, and the top/bottom bars span only above/below the task list + details pane.
15. **Bottom bar**: add a bottom bar under the task list + details pane for future data/tabs/buttons.
16. **Section labels**: “TASK LIST” and “DETAILS” labels float above their respective borders.
17. **Pane outlines**: thin outlines for left rail, task list, and details pane.
18. **ToDui ASCII logo**: compact ASCII logo in the left rail.
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

### Non-Goals (MVP)
- Sync, accounts, multi-device
- Collaboration, sharing
- Advanced NLP date parsing (keep to ISO or explicit shortcut)
- Recurring tasks
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

## 3) App UX / Layout (LCARS)

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

### 3.2 LCARS visual rules
- Prefer **solid blocks** over ASCII borders.
- Use rounded borders sparingly (only major panes).
- All-caps headings.
- “Buttons” = colored box with centered label.
- Maintain readability in 80×24.

### 3.3 Theme tokens
Define a single `theme.ts` with colors + spacing:
- `bg`, `panel`, `accentOrange`, `accentPurple`, `accentBlue`, `ok`, `warn`, `text`, `muted`

(Exact hex values are up to implementation; keep consistent.)

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

Persistence:
- Save data with `schemaVersion` for migrations.
- Migration sets `hasExplicitTime=false` for legacy tasks without time.

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
```


---

# Appendix A — v0.2.0 Polished MVP (Focus Model + Modal Correctness + Scroll)

This appendix defines the “Layer 1” hardening work for v0.2.0. It is intentionally narrow:
- **Focus model**: consistent key routing and visible focus.
- **Modal correctness**: truly blocking modals with deterministic outcomes.
- **Scroll correctness**: selection-following scroll that works under navigation, filtering, and resize.

## A1) UI State vs Domain State

### Domain state (persisted)
- Tasks, tag index, filters, schemaVersion, etc.

### UI state (NOT persisted)
- `mode` (LIST/ADD/EDIT/SEARCH/HELP/MODAL_CONFIRM)
- `focus` (LEFT_RAIL / TASK_LIST / DETAILS / INPUT:<field> / MODAL)
- `selectedIndex`
- `scrollOffset`
- `modal` (type + payload)
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

### Key routing rules
1. If `mode === MODAL_CONFIRM`: **only** modal keys are handled; all other inputs are ignored.
2. If an input field is focused (ADD/EDIT/SEARCH): printable characters go to that input only.
3. List navigation keys (`j/k`, arrows) must NOT move selection when focus is in a text input.
4. `Esc` always backs out one layer:
   - MODAL → return to previous mode
   - HELP → return to previous mode
   - SEARCH → return to LIST (preserve search text, unless explicitly cleared)
   - ADD/EDIT → cancel draft and return to LIST

### Visible focus indicator
- Left rail shows **MODE** (already) and also a short **FOCUS** indicator (e.g., `FOCUS: LIST`, `FOCUS: TITLE`, `FOCUS: MODAL`) OR highlight the active section strongly enough to be unambiguous.

## A3) Modal Correctness

### Delete confirm modal
- Trigger: `d` in LIST mode.
- UI: centered overlay “DELETE? (y/n)” plus the task title or id snippet.
- Input capture: modal must block all other keybinds until resolved.
- Resolution:
  - `y`: delete task, close modal, return to LIST.
  - `n` or `Esc`: close modal, return to LIST, no changes.

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
- selection changes (j/k, arrows, mouse click if supported)
- filter/search changes visible list
- list length changes (delete, archive aging, etc.)
- terminal resizes (visibleRows changes)

### DoD for scroll correctness
- In a list longer than the viewport, holding `j`/`k` keeps the selected row on-screen.
- After filtering or deleting, selection is clamped and visible.
- Resizing the terminal keeps the selection visible and avoids crashes.

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
- `TODUI_DATA_PATH=/absolute/or/relative/path.json`

2. Default location (when `TODUI_DATA_PATH` is unset or empty):
- Linux/XDG:
- `$XDG_DATA_HOME/todui/todui_data.json`
- If `XDG_DATA_HOME` is unset/empty:
- `$HOME/.local/share/todui/todui_data.json`
- macOS:
- `$HOME/Library/Application Support/todui/todui_data.json`
- Windows:
- `%APPDATA%\\todui\\todui_data.json`
- Fallback when `%APPDATA%` is unavailable:
- `$HOME\\AppData\\Roaming\\todui\\todui_data.json`

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
- `todui_data.json.corrupt.YYYYMMDD-HHMMSS`
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

Persisted envelope remains unchanged:
- `{ schemaVersion, tasks, tagIndex }`
