# TASKS.md — TADOI (Codex Task List)

## Conventions
- Each task includes **Definition of Done (DoD)**.
- Status labels: Complete / Pending / In Progress / Testing.
- Implement in small, reviewable commits.
- Keep "domain" logic pure; write unit tests where appropriate.

v0.2.5 scope note:
- This version focuses on foundation polish for real users: platform contract, reliability hardening, and performance envelope.
- It adds daily-driver navigation and saved-view ergonomics while keeping routing and persistence discipline strict.
- It keeps all completed phases through v0.2.3 and tracks Phase 13 foundation work for v0.2.5.

---

## Phase 0 — Bootstrap

### T0.1 Create project scaffold
**Status**: Complete
**Steps**
- `bun create tui` (or equivalent OpenTUI starter)
- Add TypeScript config if needed
- Add lint/format (optional but recommended)

**DoD**
- `bun run dev` (or start command) renders a basic screen without errors.
- Repo contains `src/index.tsx` and builds/runs.

Refs: OpenTUI quick start (`bun create tui`).  [oai_citation:8‡GitHub](https://github.com/anomalyco/opentui?utm_source=chatgpt.com)

### T0.2 Confirm TADOI naming in app and files
**Status**: Complete
**Implement**
- Update UI titles/labels to "TADOI"
- Rename data file to `tadoi_data.json` and update any references
- Update README and any filenames/mentions that include legacy name tokens

**DoD**
- No visible legacy name tokens in the app UI or file names.

---

## Phase 1 — App Shell + Theme

### T1.1 Theme module
**Status**: Complete
**Implement**
- `src/app/theme.ts`: color tokens + common styles (panel, heading, button)

**DoD**
- Theme imported and used by at least one component.

### T1.2 TADOI shell layout
**Status**: Complete
**Implement**
- Layout in `src/app/App.tsx`: left rail, center main, right pane using `<box>` flex.
- Placeholder or real content in each region.

**DoD**
- App renders 3 regions and survives terminal resize.

---

## Phase 2 — State + Persistence

### T2.1 Define domain models
**Status**: Complete
**Implement**
- `src/domain/models.ts`: Task, TagIndexEntry, Filters types

**DoD**
- Types compile; imported in store.

### T2.2 Store + reducer
**Status**: Complete
**Implement**
- `src/state/store.ts`: AppState, actions, reducer, selectors (visible tasks)

**DoD**
- App can render a list from state (even dummy data).

### T2.3 Persistence layer (JSON, atomic writes)
**Status**: Complete
**Implement**
- `src/state/persistence.ts`:
  - `loadState(): Promise<LoadedData>`
  - `saveStateDebounced(data)`
  - atomic write: temp + rename

**DoD**
- On startup, loads prior tasks if file exists.
- Mutations trigger debounced save; file contents valid JSON.

### T2.4 Archive aging rule
**Status**: Complete
**Implement**
- When a task is done and its closed date is >7 days ago, mark it ARCHIVED
- Archived tasks are excluded from “ACTIVE” and only shown when status filter is ARCHIVED

**DoD**
- Done tasks older than 7 days disappear from ACTIVE/OPEN/DONE views
- ARCHIVED view shows only archived tasks

### T2.5 Startup archive aging
**Status**: Complete
**Implement**
- Apply archive aging immediately after loading persisted data and before first render
- Persist only if archiving actually changed any task

**DoD**
- Launching the app archives eligible tasks without user interaction
- No redundant save occurs when no tasks are archived

### T2.6 Startup archive aging test
**Status**: Complete
**Implement**
- Add unit test for startup archive aging with deterministic `now`

**DoD**
- Test verifies tasks older than 7 days archive and newer ones remain done

### T2.7 Schema version + due time migration
**Status**: Complete
**Implement**
- Add `schemaVersion` to persisted JSON
- Migrate legacy tasks to `hasExplicitTime=false`

**DoD**
- Loading older data sets schemaVersion and preserves date-only semantics

---

## Phase 3 — Task List MVP

### T3.1 Task list component
**Status**: Complete
**Implement**
- `TaskList.tsx` in `<scrollbox>`
- `TaskRow` with selection highlight + status icon

**DoD**
- Can navigate selection with Up/Down (or j/k).
- Selected row visually distinct.

### T3.2 Keyboard shortcuts (list mode)
**Status**: Complete
**Implement**
- Global `useKeyboard` in App:
  - j/k or arrows: selection
  - Space: toggle done
  - a: switch to add mode
  - e: edit mode
  - c: copy/duplicate
  - d: delete confirm
  - /: search mode
  - q: quit

**DoD**
- All bindings function; no crashes.
Refs: `useKeyboard` patterns.  [oai_citation:9‡GitHub](https://github.com/remorses/ghostty-opentui?utm_source=chatgpt.com)

### T3.11 Wrap-around navigation
**Status**: Complete
**Implement**
- Up/Down navigation wraps from end to start and vice versa

**DoD**
- Pressing down on last item selects first; up on first selects last

### T3.16 Daily-driver navigation primitives
**Status**: Complete
**Implement**
- Add list-only jump/page shortcuts:
  - `gg`: top
  - `G`: bottom
  - `ctrl+u` / `ctrl+d` and PageUp/PageDown: page navigation
- Add attention jumps:
  - `]` / `[` for next/previous overdue
  - `}` / `{` for next/previous due-today
- Keep strict mode/focus routing so these keys do not leak into SEARCH/ADD/EDIT/HELP/MODAL.
- Add a brief non-modal banner when no matching attention item exists.
- Add pure unit tests for next/previous matching-index logic.

**DoD**
- All shortcuts work in long lists and selection remains visible.
- Shortcuts are inert outside LIST mode with TASK_LIST focus.
- Help overlay documents the new shortcuts.
- Tests cover matching-index search and due-attention predicates.

### T3.17 Daily-driver saved views (filter presets)
**Status**: Complete
**Implement**
- Add saved-view model and persistence:
  - `SavedView` type in domain state
  - persisted envelope includes `savedViews`
  - schema migration `2 -> 3` introduces `savedViews: []`
- Add saved-view domain helpers:
  - snapshot/apply filters
  - save by name (case-insensitive update)
  - delete by index
  - max 9 views
- Add LIST-mode UX:
  - `v`: toggle views overlay
  - `ctrl+s`: open save prompt for current filters
  - `1..9`: apply view slots
  - overlay controls: `j/k` move, `enter` apply, `d` delete, `esc`/`v` close
- Ensure applying a view updates filters immediately and existing selection clamp/visibility logic keeps selection valid.
- Add tests for:
  - apply/snapshot behavior
  - create/update/full/delete flows
  - migration and validation with `savedViews`

**DoD**
- User can save a view, restart app, and apply it from persisted data.
- Applying a view updates list filters (`status`, `due`, `tag`, `searchText`) immediately.
- Saved views do not persist UI-only state (selection/scroll/mode/focus).
- `bun test` and `bun run typecheck` pass.

### T3.18 Global active-tag filter cycle
**Status**: Complete
**Implement**
- Update `t` tag-filter behavior to cycle through tags from all active (open) tasks, not just tags on the currently selected task.
- Keep cycle order deterministic (alphabetical), and clear the tag filter after the last tag.

**DoD**
- Pressing `t` iterates through global active-task tags regardless of current selection.
- After the last tag, the next `t` clears the tag filter.

### T3.19 Sort toggles (LIST mode)
**Status**: Complete
**Implement**
- Add LIST-mode key `s` to cycle sort modes:
  - `DUE` (default)
  - `UPDATED`
  - `CREATED`
  - `TITLE`
- Update query sorting pipeline so visible tasks are sorted by active `sortMode`.
- Show current sort mode in UI (left rail/help).

**DoD**
- Pressing `s` cycles all sort modes in order and updates list ordering immediately.
- `ctrl+s` behavior for Saved Views remains unchanged.
- Help and left rail show sort key/mode info.

### T3.20 Selection stability across list changes
**Status**: Complete
**Implement**
- Reconcile selection by task id on visible-list recompute:
  - keep same task when still visible
  - if missing, clamp to nearest valid index
- Keep selection visible by running scroll-visibility guard after reconciliation.
- Add pure unit tests for selection reconciliation behavior.

**DoD**
- Sort/filter/search changes keep selection on the same task id when possible.
- If selected task disappears, selection moves to nearest valid item (not forced to top).
- Selection remains visible after list changes.

### T3.3 Sorting + filtering + search pipeline
**Status**: Complete
**Implement**
- `src/domain/query.ts`: pure functions:
  - `filterTasks(tasks, filters, now)`
  - `sortTasks(tasks, now)`
- Store selector: `getVisibleTasks(state)`

**DoD**
- Filters change visible list deterministically.
- Search matches title and tag substrings case-insensitive.

### T3.3b Due filter boundary tests
**Status**: Complete
**Implement**
- Add unit tests covering due filter boundaries for THIS WEEK (today, +7 days, +8 days)

**DoD**
- Tests confirm today/+7 included and +8 excluded

### T3.3c Date-only due semantics
**Status**: Complete
**Implement**
- Normalize due dates to local midnight on input/edit
- Use local-day comparisons for overdue/today/this week buckets

**DoD**
- Due dates behave consistently regardless of time-of-day

### T3.3d Date helpers DST test
**Status**: Complete
**Implement**
- Add a unit test that exercises local-day math across a DST boundary (when applicable)

**DoD**
- Test verifies day differences remain correct across DST shifts

### T3.3e Optional due time logic
**Status**: Complete
**Implement**
- Same-day overdue when explicit time has passed
- For due today with explicit time, show “DUE IN N HOURS/MIN” or “OVERDUE BY N HOURS/MIN”
- Same-day sorting: explicit time tasks before date-only, time asc

**DoD**
- Tests cover time-based labels, sorting, and same-day overdue

### T3.4 Status color coding
**Status**: Complete
**Implement**
- Apply default colors for complete vs. incomplete tasks in list rows
- Ensure selected row remains legible with status coloring

**DoD**
- Done tasks show a distinct color from open tasks
- Selected row contrast is readable

### T3.5 Due-today pulse for open tasks
**Status**: Complete
**Implement**
- Flash only the due-date / DUE TODAY indicators for tasks due today
- Keep task rows static so the list remains readable

**DoD**
- Any open task with due date = today has a pulsing due label in the list
- Done tasks do not pulse; top bar remains static

### T3.15 Selection-following scroll
**Status**: Complete
**Implement**
- Track scroll offset for the task list
- Ensure selected row stays visible when navigating or when filters/resize change the list

**DoD**
- Holding j/k keeps the selection on-screen in long lists
- Selection remains visible after filtering or resize

### T3.8 Overdue aggressive flash
**Status**: Complete
**Implement**
- Overdue open tasks flash aggressively (red/yellow) on due-date and overdue indicators only

**DoD**
- Overdue indicators alternate red/yellow faster than due-today pulse

### T3.13 Selected overdue row highlight
**Status**: Complete
**Implement**
- When the selected task is overdue, use a red row highlight instead of blue

**DoD**
- Selected overdue tasks show a red row background

### T3.14 Due-today right label highlight
**Status**: Complete
**Implement**
- Right-side “DUE TODAY” label is always yellow-highlighted (even when not selected)
- Keep the flash subtle by toggling text contrast only

**DoD**
- DUE TODAY indicator stays yellow and remains readable when unselected

### T3.9 Due-in indicator
**Status**: Complete
**Implement**
- Show “DUE IN # DAYS” on the right for open, non-overdue tasks

**DoD**
- Right-side due-in text appears for open tasks with future due dates
- Due-today shows “DUE TODAY” instead of “DUE IN 0 DAYS”

### T3.12 Due label rules
**Status**: Complete
**Implement**
- Due-today shows “DUE TODAY”
- Overdue shows “N DAYS OVERDUE”

**DoD**
- List and details display the updated due labels

### T3.6 Due-soon and due-later color coding
**Status**: Complete
**Implement**
- Yellow for tasks due today and tomorrow through next 7 days
- Blue for tasks due 8+ days out
- Apply to list rows and selected top bar

**DoD**
- Due-today and due-soon tasks are yellow in the list
- Due-later tasks are blue in the list
- Selected top bar reflects due-soon/due-later colors

### T3.7 Quick copy/duplicate task
**Status**: Complete
**Implement**
- `c` duplicates selected task into a new Add draft
- Completed tasks default to today’s due date
- Future due dates copy as-is
- Requires Save to create; Esc cancels

**DoD**
- Pressing `c` opens a prefilled draft
- Save creates the duplicated task; Esc cancels

### T3.10 Selection indicator column
**Status**: Complete
**Implement**
- Add a left gutter indicator for the selected row
- Keep text aligned in a fixed column

**DoD**
- Selected rows show a larger indicator without shifting text

---

## Phase 4 — Details Pane + Editor

### T4.1 Details pane
**Status**: Complete
**Implement**
- `DetailsPane.tsx`: show selected task full info

**DoD**
- Selection changes update details.

### T4.1b Details due/status emphasis
**Status**: Complete
**Implement**
- When a due-today or overdue task is selected, highlight its due date and status

**DoD**
- Due date and status are visually emphasized for due/overdue selections

### T4.1c Details due time display
**Status**: Complete
**Implement**
- When a task has an explicit time, show `DUE TIME: HH:mm` in the details pane

**DoD**
- Details pane shows a due time line for tasks with explicit time

### T4.2 Add/Edit form skeleton
**Status**: Complete
**Implement**
- `EditorPane.tsx` with inputs:
  - title (required)
  - due (optional, ISO date)
  - tags (placeholder)
  - notes (optional; single-line acceptable for MVP)
  - Save/Cancel buttons (as boxes)

**DoD**
- `a` opens add mode with empty draft.
- `e` opens edit mode with selected task draft.
- Save commits changes; Esc cancels.

### T4.3 Due date right-arrow autocomplete
**Status**: Complete
**Implement**
- Add incremental date autocomplete in the due input:
  - Right arrow completes year, then month, then day
  - Works with partial `YYYY`, `YYYY-MM`, `YYYY-MM-` input
- Show a subtle hint for the suggested completion (inline or helper line)

**DoD**
- Typing `2026` then Right arrow yields `2026-`
- Typing `2026-02` then Right arrow yields `2026-02-`
- Typing `2026-02-0` then Right arrow yields `2026-02-08` (or today’s day)

### T4.3b Optional due time input
**Status**: Complete
**Implement**
- Add optional TIME (HH:mm) field in Add/Edit
- Validate HH:mm strictly; empty means no time
- When time provided, store `hasExplicitTime=true` and combine date+time

**DoD**
- Time input accepts `14:30` and rejects invalid values
- Date-only tasks behave as before

### T4.3c Add-mode time autocomplete
**Status**: Complete
**Implement**
- When Add Task opens, compute a suggested time one hour ahead (preserve minutes)
- Show right-arrow hint; Right Arrow completes hour, then minutes
- Hide hint for complete valid times or invalid input

**DoD**
- `12:45` suggests `13:45` and `23:30` suggests `00:30`
- Right Arrow completes hour then minutes in two steps
- No effect for invalid or complete times

### T4.4 Closed date display
**Status**: Complete
**Implement**
- Track `closedAt` when marking tasks done
- Show closed date in details pane
- Show completed date in task list rows

**DoD**
- Completed tasks display a closed date in details
- Task list shows DONE date on the right for completed tasks

---

## Phase 5 — Tag Autocomplete (Core Requirement)

### T5.1 Tag normalization + index logic
**Status**: Complete
**Implement**
- `src/domain/tagIndex.ts`:
  - `normalizeTag(raw): string | null`
  - `updateTagIndex(tagIndex, tags, now)`
  - `rankTags(tagIndex, query): string[]`

**DoD**
- Unit tests for normalization and ranking (optional but recommended).
- Ranking matches spec rules.

### T5.1b Tag normalization rules
**Status**: Complete
**Implement**
- Allow only `[a-z0-9_-]`, lowercase, trim, remove leading `#`
- Truncate to 24 chars, discard empty results
- Dedupe per task and sort tags alphabetically

**DoD**
- Normalization tests cover emoji stripping, max length, and dedupe

### T5.2 Tag token parsing and replacement
**Status**: Complete
**Implement**
- `TagInput.tsx`:
  - Parse tokens and detect current `#token` (last token)
  - Derive query string (after `#`)
  - On suggestion selection, replace current token with chosen tag

**DoD**
- Typing `#wo` identifies query `wo`.
- Selecting suggestion replaces only the current token.

### T5.2b Tag autocomplete normalization
**Status**: Complete
**Implement**
- Normalize tag query using the same rules as stored tags

**DoD**
- Suggestions align with normalized tags (no emoji/invalid chars)

### T5.3 Inline suggestions UI
**Status**: Complete
**Implement**
- Show an inline tag suggestion while typing without stealing input focus
- Keep dropdown optional; inline suggestion is primary

**DoD**
- Inline suggestion appears when a prefix matches a known tag
- Input remains focused and typing continues smoothly

### T5.4 Inline tag autocomplete (right-arrow accept)
**Status**: Complete
**Implement**
- Support typing tags with or without leading `#`
- Right arrow accepts the inline suggestion into the current token
- Space or comma can delimit multiple tags
- Display tags with exactly one leading `#`

**DoD**
- As user types `#wo`, a suggestion like `#work` appears inline
- Right arrow fills the current token with the suggested tag

### T5.5 Colored tags
**Status**: Complete
**Implement**
- Automatically assign a consistent color per tag
- Display tags as colored pills in list rows and details

**DoD**
- Same tag uses the same color across the UI
- Tags are visually distinct and readable on the background

---

## Phase 6 — Filters UI + Help + Polish

### T6.1 Filters UI
**Status**: Complete
**Implement**
- Filter summary in left rail:
  - status toggle (All/Open/Done)
  - due toggle (Any/Overdue/Today/Next7)
  - tag include selector (simple)
- Keyboard shortcuts to cycle filters

**DoD**
- Filters change visible tasks and are displayed in rail.

### T6.2 Delete confirm modal
**Status**: Complete
**Implement**
- modal overlay: "DELETE? (y/n)"
- handle y/n keypress

**DoD**
- Prevent accidental deletes.
- Delete confirmation popup is centered on screen.

### T6.3 Help overlay
**Status**: Complete
**Implement**
- `?` toggles overlay listing keybindings

**DoD**
- Overlay appears/disappears; does not break focus.

### T6.4 Menu focus highlight
**Status**: Complete
**Implement**
- Visually highlight the active menu/section (e.g., list, editor, search, help)
- Ensure highlight is visible in the left rail or header

**DoD**
- User can tell which section is active at a glance

### T6.5 Selected task top bar
**Status**: Complete
**Implement**
- Display selected task name in a centered top bar above the task list and details pane only
- Ensure the left rail is excluded from the top bar
- Keep TADOI at the top of the left rail

**DoD**
- Selected task name is visible at the top center over list + details
- Left rail remains separate with TADOI at its top

### T6.6 Bottom bar scaffold
**Status**: Complete
**Implement**
- Add a bottom bar under the task list + details pane (exclude left rail)
- Reserve space for future data/tabs/buttons

**DoD**
- Bottom bar visible under list + details only
- Top bar and left rail remain unaffected

### T6.13 Bottom bar summary counts
**Status**: Complete
**Implement**
- Show counts labeled `N OVERDUE` (red), `N DUE TODAY` (yellow), `N DUE THIS WEEK` (blue)
- Add `N COMPLETED THIS WEEK` (green)
- Color-highlight each section

**DoD**
- Bottom bar displays four labels with correct colors and counts

### T6.13b Bottom bar info ticker
**Status**: Complete
**Implement**
- Auto-rotate every 6 seconds between summary view and a top-tags view
- Top-tags view shows top 5 tags as a single colored pill `N #tag` using canonical tag colors
- Truncate or drop tags to avoid wrapping

**DoD**
- Bottom bar alternates between summary and top-tags without flicker
- Tag name color matches canonical tag color
- Tag count and tag name share the same colored pill

### T6.14 Filter highlight colors
**Status**: Complete
**Implement**
- In the left rail filters, color-highlight STATUS:
  - DONE = green
  - OPEN = blue
  - ARCHIVED = grey
- In the left rail filters, color-highlight DUE:
  - OVERDUE flashes red/yellow
  - TODAY = yellow
  - THIS WEEK = blue (rolling next 7 days incl. today)

**DoD**
- Status and due filter values render with the specified highlights

### T6.7 Section labels outside borders
**Status**: Complete
**Implement**
- Add top-left section labels above the list and details panes (outside the borders)

**DoD**
- TASK LIST and DETAILS labels appear above their respective bordered panels

### T6.8 TADOI ASCII logo in left rail
**Status**: Complete
**Implement**
- Replace plain TADOI text with the provided ASCII logo
- Ensure the left rail is wide enough to display it

**DoD**
- ASCII logo renders fully without wrapping

### T6.9 Pane outlines
**Status**: Complete
**Implement**
- Add thin outlines to the left rail, task list, and details pane

**DoD**
- Outlines are visible and match the design inspiration

### T6.10 Left rail version string
**Status**: Complete
**Implement**
- Show a small version label under the logo in the left rail

**DoD**
- Version string is visible and easy to update

### T6.10b Left rail date/time
**Status**: Complete
**Implement**
- Add `DATE: YYYY-MM-DD` under the version label
- Add `TIME: HH:mm:ss` under the date

**DoD**
- Date and time (with seconds) are visible in the left rail

### T6.11 Top bar emphasis
**Status**: Complete
**Implement**
- Make the selected-task top bar text more prominent (larger/stronger)
- Center-align task name and due label
- Display task name in uppercase

**DoD**
- Top bar text stands out visually and is centered

### T6.12 Top bar due label
**Status**: Complete
**Implement**
- Show due label under the task name in the top bar

**DoD**
- Top bar displays task name + due status text

---

## Phase 7 — Quality Gates

### T7.1 80x24 & resize smoke test
**Status**: Complete
**DoD**
- UI usable at 80x24.
- Resize does not crash or overlap catastrophically.
**QA Notes (2026-02-09 CST)**
- Verified baseline render at `80x24` using `stty size` and `bun run dev`; full rail/list/details layout rendered and remained interactive.
- Verified `<80x24` guard at `79x23`; app rendered centered warning: `Terminal too small (min 80x24). Current: 79x23.` with `Resize terminal to continue` and `Press q to quit`.
- After returning terminal to `80x24`, normal UI resumed on next launch with no crash and no broken persisted state.

### T7.2 Persistence corruption prevention test
**Status**: Complete
**DoD**
- Kill app mid-use (Ctrl+C), restart: JSON still parseable and tasks mostly intact (atomic rename prevents partial file).
**QA Notes (2026-02-09 CST)**
- Ran app with isolated path: `TADOI_DATA_PATH=/tmp/tadoi-qa-interrupt.json`.
- Created task `alpha task`, then interrupted app with `Ctrl+C` during active runtime.
- Verified persisted file exists and parses: `schemaVersion 3`, `tasks 1`, first task title `alpha task`.
- Restarted app with same data path and confirmed task reloaded in UI (`ALPHA TASK` shown in top bar/details).

### T7.3 Packaging / run docs
**Status**: Complete
**DoD**
- README includes:
  - install (bun)
  - run commands
  - data file location
  - keybindings
**Implementation notes**
- README keybindings were synchronized to the centralized key router behavior:
  - list navigation (`gg`, `G`, `ctrl+u/d`, `[]`, `{}`),
  - sort cycling (`s`),
  - saved views (`v`, `ctrl+s`, `1..9`),
  - and global active-task tag-cycle behavior for `t`.

---

## Nice-to-haves (v1.1)
- Multi-tag filter (AND)
- Notes multiline (textarea if available)
- User-defined/custom-imported color palettes
- SQLite persistence


---

# Phase 8 — v0.2.0 Polished MVP (Focus + Modals + Scroll)

> Scope note: this phase is about **predictability** (focus + modals) and **readability** (scroll), not new product features.

## T8.1 Formalize mode + focus state machine
**Status**: Complete
**Implement**
- Define `Mode` enum: `LIST | ADD | EDIT | SEARCH | HELP | MODAL_CONFIRM`
- Define `FocusTarget` enum (at minimum): `TASK_LIST | SEARCH_INPUT | MODAL | EDITOR_TITLE | EDITOR_DUE_DATE | EDITOR_DUE_TIME | EDITOR_TAGS | EDITOR_NOTES`
- Store mode/focus in UI state (not persisted)
- Add a single key routing function that dispatches based on `(mode, focus)`
- Implemented in:
- `src/ui/modeFocus.ts` (formal mode/focus constants + predicates)
- `src/ui/state.ts` (`UIState`, `uiReducer`, and `unwind(state)`)
- `src/domain/models.ts` (mode/focus re-export for app/component compatibility)
- `src/app/keyRouter.ts` (pure routing resolver)
- `src/app/App.tsx` (single keyboard entrypoint using router)
- `src/app/uiState.ts` (focus mapping and modal/list helpers)
- `src/app/keyRouter.test.ts`, `src/app/uiState.test.ts`, and `src/ui/state.test.ts` (mode/focus + unwind tests)

**DoD**
- In LIST mode, `j/k` moves selection.
- In ADD/EDIT, typing does not move selection and list keys do not leak.
- `Esc` unwinds exactly one layer (modal/help/search/editor) back to LIST as specified in Appendix A.

## T8.2 Visible focus indicator / highlight
**Status**: Complete
**Implement**
- Add a clear, always-visible indication of current focus target:
  - either a `FOCUS:` line in left rail, or strong highlight of the active section
- Ensure focus indication updates immediately on focus changes

**DoD**
- User can tell where keystrokes will go (list vs editor field vs modal) at a glance.

## T8.3 Modal correctness: hard-block key routing
**Status**: Complete
**Implement**
- When modal is open, all non-modal key handlers must be disabled/ignored
- Only accept modal keys: `y`, `n`, `Esc` (and optionally Enter mapped to `y`)

**DoD**
- With modal open, selection cannot change and inputs cannot be edited.
- `y` deletes, `n`/`Esc` cancels, and app returns to LIST.

## T8.4 Post-delete selection clamping + visibility
**Status**: Complete
**Implement**
- After delete, clamp `selectedIndex` using the Appendix A rules
- Immediately call `ensureSelectedVisible()` to keep selection visible

**DoD**
- Deleting the last item selects the previous one (if any)
- Deleting an item in the middle keeps selection index and shows the next item
- Selection never becomes invalid or invisible

## T8.5 Scroll correctness hardening (ensureSelectedVisible)
**Status**: Complete
**Implement**
- Centralize `ensureSelectedVisible(selectedIndex, scrollOffset, visibleRows, taskCount)`
- Use it on:
  - navigation
  - filter/search changes
  - list length changes
  - resize
- Ensure `scrollOffset` is UI-only state

**DoD**
- Holding `j` or `k` through a long list always keeps the selected row visible.
- Filtering/clearing filters keeps selection visible and stable (no jumps unless needed).

## T8.6 Resize hook: recompute visibleRows, clamp, and re-scroll
**Status**: Complete
**Implement**
- On terminal resize:
  - recompute list pane height → `visibleRows`
  - clamp `selectedIndex` to `[0, taskCount-1]` (or none if empty)
  - clamp `scrollOffset`
  - call `ensureSelectedVisible()`

**DoD**
- Resizing smaller/larger does not crash.
- Selected row remains visible after resize.

---

# Phase 9 — v0.2.1 Data Safety & Schema Discipline

> Scope note: this phase is reliability-only (data safety, path resolution, schema discipline). No new end-user features.

## T9.1 Resolve data file path (platform defaults + env override)
**Status**: Complete
**Implement**
- Add `resolveDataPath()` in `src/state/persistence.ts`.
- Resolution order:
- `TADOI_DATA_PATH` override (always wins).
- Linux: `$XDG_DATA_HOME/tadoi/tadoi_data.json`, fallback `$HOME/.local/share/tadoi/tadoi_data.json`.
- macOS: `$HOME/Library/Application Support/tadoi/tadoi_data.json`.
- Windows: `%APPDATA%\\tadoi\\tadoi_data.json`, fallback `$HOME\\AppData\\Roaming\\tadoi\\tadoi_data.json`.
- Ensure parent directories are created before writes.
- Surface resolved path in a debug-visible location (log and/or help/status line).

**DoD**
- With `TADOI_DATA_PATH` set, TADOI always uses that path.
- Without override, platform defaults resolve correctly (Linux XDG, macOS App Support, Windows AppData).
- Save path directory is auto-created when missing.

## T9.2 Safe load with corruption backup + banner
**Status**: Complete
**Implement**
- Add safe-load orchestration in `src/state/persistence.ts`.
- On parse/validation/migration failure:
- move file to `tadoi_data.json.corrupt.YYYYMMDD-HHMMSS` in same directory.
- if rename fails, attempt copy and keep original.
- start empty state at current `schemaVersion`.
- expose persistent banner text in UI state/message channel:
- `Data file was corrupt and was backed up to <filename>`.
- Prevent infinite backup loops if recovery save fails.

**DoD**
- Given intentionally corrupt JSON, app starts, backs up file, and remains usable.
- Recovery path never overwrites corrupt data before backup.
- Banner/message remains visible long enough for user troubleshooting.

## T9.3 Schema validation + migration pipeline
**Status**: Complete
**Implement**
- Add `validatePersistedState()` in `src/state/validation.ts`.
- Add `migratePersistedStateToCurrent()` in `src/state/migrations.ts`.
- Enforce load sequence in `src/state/persistence.ts`:
1. parse
2. minimal shape validation
3. stepwise migration (`N -> N+1` until current)
4. post-migration validation
5. hydrate
- Require `schemaVersion` in persisted envelope.
- Keep persisted envelope stable: `{ schemaVersion, tasks, tagIndex }`.

**DoD**
- Legacy fixtures migrate to latest schema and pass validation.
- Invalid shape/migration errors route to corruption recovery path.
- Unknown extra fields are tolerated unless parsing/validation fails.

## T9.4 Migration fixture tests
**Status**: Complete
**Implement**
- Add fixture-driven tests in existing state test area and/or `src/state/__fixtures__/`.
- Cover:
- current schema fixture loads unchanged.
- legacy schema fixture migrates stepwise to latest.
- malformed JSON / invalid shape / migration throw trigger recovery decision path.
- Include path resolution matrix tests where practical (override + OS default branches).

**DoD**
- `bun test` passes reliably with migration and recovery fixture coverage.
- Boundary cases are deterministic and do not rely on wall-clock timing.

## T9.5 Persist-only-on-change guard
**Status**: Complete
**Implement**
- Ensure persistence writes only when domain state changes.
- Confirm ticker/clock/renders and other UI-only updates never trigger disk writes.
- Add/adjust tests around save scheduling behavior in `src/state/persistence.ts` tests.

**DoD**
- Running app idle does not rewrite `tadoi_data.json` repeatedly.
- Saves occur only after task/tag/filter domain mutations that affect persisted data.

---

# Phase 10 — v0.2.2 Automated Tests + CI

> Scope note: this phase adds automated verification and CI merge gates only. No new user-facing features.

## T10.1 Test harness structure + deterministic clock helpers
**Status**: Complete
**Implement**
- Standardize test execution via package scripts:
- `bun run test`
- `bun run test:coverage`
- `bun run typecheck`
- Keep test placement under `src/**/*.test.ts`.
- Remove `Date.now()` dependence from test setup defaults where unnecessary and use fixed timestamps.

**DoD**
- `bun run test` executes all test files locally and in CI.
- New tests use deterministic timestamps and do not rely on wall-clock time.

## T10.2 Domain query + due-time + label tests
**Status**: Complete
**Implement**
- Expand `src/domain/query.test.ts` with:
- due filter boundaries for `today` and `overdue`
- rolling-window coverage for `next7/THIS WEEK`
- same-day sort assertions (explicit-time before date-only, ascending explicit time)
- Expand due label tests for explicit-time minute-level overdue cases.
- Extend tag normalization tests for combined max-length + dedupe + sorting behavior.

**DoD**
- Domain behavior boundaries are covered for due filters, ordering, and labels.
- Tag normalization invariants are enforced with explicit tests.

## T10.3 Schema/migration/validation tests with fixtures
**Status**: Complete
**Implement**
- Add fixture files under `src/state/__fixtures__/`:
- `persisted.v1.json`
- `persisted.v2.json`
- `persisted.invalid.json`
- Use fixtures in migration/validation tests to verify stepwise migration and strict validation.

**DoD**
- Legacy fixture migrates to current schema and validates.
- Invalid fixture fails validation predictably.

## T10.4 Corruption recovery + backup path tests (mock FS boundary)
**Status**: Complete
**Implement**
- Cover corruption decision logic in `src/state/persistence.test.ts`:
- parse failure
- validation failure
- migration failure
- Assert backup path branch and banner behavior.
- Verify rename failure path falls back to copy.

**DoD**
- Recovery path behavior is deterministic and tested without requiring fragile integration setup.

## T10.5 Data path resolution tests (platform/env + dir creation)
**Status**: Complete
**Implement**
- Verify `resolveDataPath()` precedence and platform defaults.
- Add explicit test asserting parent directory creation for nested save path via mocked `fsOps.mkdir`.

**DoD**
- `TADOI_DATA_PATH` override wins.
- Linux/macOS/Windows defaults are tested.
- Save path directory creation is verified.

## T10.6 GitHub Actions CI workflow (cross-platform matrix)
**Status**: Complete
**Implement**
- Add `.github/workflows/ci.yml`:
- triggers: `pull_request`, `push` to `main`
- single `ci` job with matrix runners:
  - `ubuntu-latest`
  - `macos-latest`
  - `windows-latest`
- Bun setup via `oven-sh/setup-bun@v2` pinned to `1.3.9`
- install: `bun install --frozen-lockfile`
- gates: `bun run test`, `bun run test:coverage`, `bun run typecheck`, `bun run brand:check`
- Add concurrency cancellation for in-progress superseded runs.

**DoD**
- CI fails on test, coverage, typecheck, or branding errors.
- CI runs automatically on PRs and pushes to `main`.

## T10.7 Coverage step in CI
**Status**: Complete
**Implement**
- Add CI coverage command: `bun run test:coverage`.
- Expose coverage output in CI logs without enforcing a percentage threshold.

**DoD**
- CI logs include coverage output.
- Coverage collection does not destabilize required gates.

## T10.8 Left rail modal label terminology
**Status**: Complete
**Implement**
- Update left-rail terminology so modal confirmation displays as `DELETE` instead of `MODAL`.
- Keep internal mode naming unchanged (`modal_confirm`) for state machine compatibility.

**DoD**
- Left rail MODE and MENU display `DELETE` when delete-confirm modal is active.
- Spec wording reflects `DELETE` as the UI label for modal confirm state.

## T10.9 ASCII logo spacing polish
**Status**: Complete
**Implement**
- Tighten spacing between logo characters in the left-rail ASCII `TADOI` mark (notably between `T` and `O`) while preserving logo alignment.

**DoD**
- Logo reads clearly as `TADOI` with tighter spacing and no visual clipping/wrapping.

---

# Phase 11 — v0.2.2 Theme Switcher + Palette Polish

> Scope note: this phase adds lightweight theme selection and persistence with minimal UI changes.

## T11.1 Theme registry and cycling contract
**Status**: Complete
**Implement**
- Add `src/theme/themes.ts` with:
- `ThemeId = "default" | "retro" | "highContrast" | "neonHacker"`
- `ThemeTokens`
- `THEMES`
- `THEME_ORDER`
- `cycleTheme(current)`
- Keep `default` palette equivalent to existing release colors.

**DoD**
- Theme IDs and semantic tokens compile as a single source of truth.
- Cycling order is deterministic and wraps.
- Default palette remains visually unchanged.

## T11.2 Runtime theme adapter compatibility
**Status**: Complete
**Implement**
- Refactor `src/app/theme.ts` to support semantic themes with `applyTheme(themeId)`.
- Preserve existing runtime keys used across components (`accentOrange`, `accentBlue`, `accentPurple`, `dueSoon`, `dueLater`, `muted`, `outline`) via adapter mapping.

**DoD**
- Existing UI components render without broad refactors.
- Theme changes apply immediately at runtime.

## T11.3 Settings persistence for theme selection
**Status**: Complete
**Implement**
- Add `src/settings/settings.ts` with:
- `TadoiSettings = { themeId }`
- `resolveSettingsPaths()` using:
- primary: `~/.config/tadoi/settings.json`
- fallback: `~/.tadoi/settings.json`
- `loadSettings()` with default merge/validation
- `saveSettingsDebounced()` with 150ms debounce and fallback-write behavior
- Add `src/state/settingsStore.ts` reducer with `setTheme` + `cycleTheme`.

**DoD**
- Startup loads saved theme and applies it before first render.
- Theme changes persist and restore across app restarts.
- Save failures on primary path attempt fallback path.

## T11.4 Help pane theme control and preview
**Status**: Complete
**Implement**
- In Help mode, bind `h` and `H` to theme cycling.
- Show current theme in Help.
- Add preview swatches for `accent`, `warn`, and `ok`.

**DoD**
- Pressing `h` in Help cycles through all 4 palettes.
- Help reflects the active theme and preview colors.

## T11.5 Palette tuning pass
**Status**: Complete
**Implement**
- Update `retro` palette to SNES-inspired cool greys.
- Update `neonHacker` with dark-green left rail and greener list/details panel backgrounds.

**DoD**
- Retro theme reads as grayscale SNES-style.
- Neon Hacker left rail and panels match requested green styling.

## T11.6 Left rail logo separator
**Status**: Complete
**Implement**
- Add a horizontal ASCII separator directly beneath TADOI logo artwork in left rail before version/date/time and menu metadata.

**DoD**
- Logo area is visually separated from metadata and menu content.

## T11.7 Rotating theme mode (auto-cycle)
**Status**: Complete
**Implement**
- Extend theme ids to include `rotating`.
- Include `rotating` in `THEME_ORDER` while keeping concrete palette order as:
- `default`, `retro`, `highContrast`, `neonHacker`
- When `rotating` is selected, auto-cycle concrete themes every 15 seconds.
- Keep settings persistence on `themeId` and allow `rotating` as a saved value.
- Update Help pane theme line to show `rotating (<activeTheme>)` and auto-rotate hint.

**DoD**
- Theme cycling from Help includes `rotating`.
- In rotating mode, palette changes automatically every 15 seconds.
- Restart preserves rotating mode when selected.
- Theme tests cover new cycle order including `rotating`.

---

# Phase 12 — v0.2.3 Routing Hardening + Version Surfaces

> Scope note: this phase focuses on keyboard-routing determinism and release/version consistency only.

## T12.1 Central key router with action output
**Status**: Complete
**Implement**
- Replace scattered per-mode keyboard handlers with a single pure router:
- `src/app/keyRouter.ts` exports `handleKey(key, context)`.
- Router returns action lists split by scope (`ui` and `domain`) and has no side effects.
- `src/app/App.tsx` uses one `useKeyboard` entrypoint that executes routed actions.

**DoD**
- Modal mode blocks all background keys except modal keys (`y`, `n`, `Esc`).
- Typing in SEARCH/ADD/EDIT does not move list selection.
- LIST mode keybinds continue to work.
- `Esc` consistently unwinds one layer.

## T12.2 Version bump and help-pane version display
**Status**: Complete
**Implement**
- Bump package version to `0.2.3`.
- Centralize app display version in `src/app/version.ts` (`APP_VERSION = "v0.2.3"`).
- Use `APP_VERSION` in left rail version label.
- Add app version line in Help pane.

**DoD**
- Left rail shows `v0.2.3`.
- Help pane displays `App Version: v0.2.3`.
- `package.json` version is `0.2.3`.

## T12.3 Version surfaces sync to v0.2.5
**Status**: Complete
**Implement**
- Update `APP_VERSION` to `v0.2.5`.
- Update `package.json` version to `0.2.5`.
- Keep left rail and help pane bound to centralized `APP_VERSION`.

**DoD**
- Left rail shows `v0.2.5`.
- Help pane displays `App Version: v0.2.5`.
- `package.json` version is `0.2.5`.

---

# Phase 13 — v0.2.5 Foundation Polish (Platform Contract + Reliability + Performance)

> Scope note: this phase tightens “real user” robustness without adding major new features.

## T13.1 Document supported terminals + min size contract
**Status**: Complete
**Implement**
- Update README (or spec-facing docs) to explicitly list supported terminals:
  - macOS Terminal.app + iTerm2
  - Windows Terminal
  - Linux baseline terminal (choose one and name it)
- Re-affirm minimum terminal size: 80×24.
- Ensure below-min-size behavior is documented (message, no overlap).

**DoD**
- Docs clearly state support matrix and 80×24 minimum.
- Below-min-size message behavior is described and consistent with UI behavior.

**Implementation notes**
- README updated with support matrix, minimum size contract, and below-min-size behavior.
- Linux baseline fixed as GNOME Terminal.

## T13.2 Below-min-size guard behavior
**Status**: Complete
**Implement**
- Add a guard in layout/render pipeline:
  - If terminal < 80×24: render a single centered warning screen.
  - Disable other interactions to avoid crashes/layout churn.
- Ensure resizing back above min restores the full UI.

**DoD**
- Shrinking below 80×24 shows a stable “Terminal too small” message.
- Growing back restores UI with no crash and preserves selection if possible.

**Implementation notes**
- Added `src/app/layoutGuard.ts` with pure size guard helpers + tests.
- `App` now renders a centered guard screen below `80x24` and blocks normal key routing while too small.

## T13.3 Persistence save-failure handling + banner
**Status**: Complete
**Implement**
- In persistence layer, catch write errors (permissions, disk full, IO).
- Surface a persistent banner containing:
  - short error summary
  - resolved data path
  - last successful save timestamp (if tracked; otherwise omit)
- Ensure failure does not crash the app.
- Ensure retries are not aggressive:
  - retry only on next domain mutation or explicit retry action (no automatic tight loop).

**DoD**
- With data path set to an unwritable location, app continues running and shows banner.
- App does not spam retries or create repeated corrupt backups.
- When path becomes writable again (or env override changed), next domain mutation successfully saves and banner clears (or updates).

**Implementation notes**
- `saveStateDebounced` now supports callback results for success/failure payloads.
- App tracks a persistent save-failure banner with resolved path + optional last successful save time.
- Retry behavior remains mutation-driven only (no UI-tick-triggered writes).

## T13.4 Corruption recovery loop prevention test
**Status**: Complete
**Implement**
- Add unit test(s) to ensure corruption recovery does not generate unbounded `.corrupt.*` backups in one session.
- Introduce a simple session-scoped guard in safe-load orchestration (if not already present).

**DoD**
- Tests confirm at most one backup per startup attempt for a given resolved data path.
- No repeated `.corrupt.*` creation on subsequent save failures during the same run.

**Implementation notes**
- Added session-scoped recovery map keyed by resolved path in persistence layer.
- Added tests for same-path single-backup behavior and separate-path backup behavior.

## T13.5 Performance target + debug measurement hook (optional)
**Status**: Complete
**Implement**
- Add an optional debug flag (env) that logs:
  - render/update durations (ms)
  - visible rows / total task count
- Ensure the task list renders only visible rows (windowed) using existing `scrollOffset` + `visibleRows` state.
- Avoid adding heavy profiling dependencies.

**DoD**
- With debug flag enabled, logs show basic timing + counts.
- Large list (2,000 tasks) remains navigable with no perceptible lag.
- No behavior changes when debug flag is disabled.

**Implementation notes**
- Added `TADOI_PERF_DEBUG=1` hook in `App` that logs render duration + terminal/window counts.
- No behavior change when flag is disabled.

---

# Phase 14 — v0.2.5 Packaging Readiness (Non-Live + Future Installer Scaffolding)

> Scope note: this phase adds packaging infrastructure only. No public publish and no end-user feature changes.

## T14.1 Non-live tarball packaging workflow
**Status**: Complete
**Implement**
- Keep `package.json` as `"private": true` (no live publish).
- Add deterministic packaging scripts:
  - `pack:dry`
  - `pack:inspect`
  - `pack:smoke`
  - `release:rc:check`
- Add package `files` allowlist and Bun engine contract.

**DoD**
- Tarball can be generated locally in `dist/tarball/`.
- Tarball workflow is usable without publishing to a registry.
- Public publish remains disabled.

**Implementation notes**
- Added scripts in `package.json` and runtime file allowlist.
- Added Bun engine requirement and retained private package policy.

## T14.2 Package content validation guard
**Status**: Complete
**Implement**
- Add `scripts/inspect-package.ts` to validate dry-run package contents.
- Assert required runtime files exist and forbidden local/doc/data files are excluded.

**DoD**
- `bun run pack:inspect` fails when required files are missing.
- `bun run pack:inspect` fails when forbidden files are included.

**Implementation notes**
- Inspection now parses `bun pm pack --dry-run` output and enforces file-set guardrails.

## T14.3 Tarball install smoke test
**Status**: Complete
**Implement**
- Add `scripts/package-smoke-test.ts`:
  - extract generated tarball in a temporary workspace
  - run packaged CLI entry with `--help`
  - assert expected help output contract

**DoD**
- `bun run pack:smoke` validates packaged CLI payload and basic CLI execution.
- Failure output is explicit and blocks release-check flow.

**Implementation notes**
- Smoke test now checks app name/tagline/usage text from extracted tarball CLI payload.

## T14.4 CI packaging gate
**Status**: Complete
**Implement**
- Extend `.github/workflows/ci.yml` matrix `ci` job with Ubuntu-only packaging steps:
  - `bun run pack:dry`
  - `bun run pack:inspect`
  - `bun run pack:smoke`
- Keep packaging checks required while avoiding OS-specific packaging fragility on non-Ubuntu runners.

**DoD**
- PR and `main` push matrix runs include packaging verification on the Ubuntu leg.
- Packaging failures block CI.

**Implementation notes**
- Added conditional packaging steps (`if: matrix.os == 'ubuntu-latest'`) in the matrix `ci` job.

## T14.5 Future installer scaffolding (DMG/EXE preparation)
**Status**: Complete
**Implement**
- Add scaffold script `scripts/build-binary.ts` with stable interface:
  - `--target macos|windows`
  - `--format raw|installer`
- Add planning docs:
  - `packaging/macos/README.md`
  - `packaging/windows/README.md`
- Add release target matrix:
  - `packaging/release-targets.json`

**DoD**
- Scaffold commands exist and produce planning artifacts only.
- No real DMG/EXE/MSI generation in this phase.

**Implementation notes**
- Added `build:bin:mac` / `build:bin:win` scripts that generate scaffold outputs under `dist/`.

## T14.6 Actual installer generation (future phase)
**Status**: Pending
**Implement**
- Implement real binary build pipeline.
- Implement macOS DMG packaging with signing/notarization.
- Implement Windows EXE/MSI packaging with signing.

**DoD**
- Signed installer artifacts are produced in CI for macOS/Windows targets.
- Installer QA matrix and rollback strategy are documented.

---

# Phase 15 — v0.2.5 Data Portability (Import/Export)

> Scope note: this phase adds CLI-based full-state portability only. No interactive import/export UI is added to runtime TUI flows.

## T15.1 CLI export command
**Status**: Complete
**Implement**
- Add `tadoi export --out <path> [--format json] [--pretty] [--redact]`.
- Load local state through strict pipeline (`parse -> validate -> migrate -> validate`) without corruption-recovery side effects.
- Export current schema envelope and settings sidecar.
- Write output atomically (temp + rename).
- Add optional redaction (blank title/notes) for share-safe exports.

**DoD**
- Export writes file to `--out` and exits non-zero on validation/load/write failures.
- Success summary prints out path, task count, and schemaVersion.

## T15.2 CLI import command (merge/replace, backup, dry-run)
**Status**: Complete
**Implement**
- Add `tadoi import --in <path> [--mode merge|replace] [--backup|--backup=false|--no-backup] [--dry-run] [--yes] [--pretty]`.
- Default mode is `merge`; default backup is enabled.
- `replace` requires explicit `--yes`.
- Accept missing `schemaVersion` by coercing to `0` then migrate stepwise to current schema.
- Merge tasks by `id` with conflict policy:
  - newest `updatedAt` wins,
  - then newest `createdAt`,
  - final tie-breaker: incoming wins.
- Saved views merge by name with newest `updatedAt`; incoming wins ties.
- Recompute `tagIndex` from resulting tasks for deterministic drift-free state.
- Replace mode overwrites persisted state after optional backup.
- Dry-run executes full pipeline and summary only; no writes.

**DoD**
- Merge mode applies deterministic conflict resolution and writes validated current schema state.
- Replace mode refuses to run without `--yes`.
- Backup precedes overwrite and import aborts if backup creation fails.
- Settings sidecar is applied when present; settings-write failure returns non-zero with explicit partial-success message.

## T15.3 Help overlay data portability docs
**Status**: Complete
**Implement**
- Update Help overlay with `DATA: IMPORT / EXPORT` section.
- Show resolved data path.
- Include export/import command examples and safety notes (merge conflict policy, replace overwrite caution, redaction guidance).

**DoD**
- Help overlay presents copyable command examples and current resolved data path.
- Merge/replace safety semantics are visible in-app.

## T15.4 Portability test coverage + fixtures
**Status**: Complete
**Implement**
- Add pure-function tests for merge conflict resolution, missing timestamp handling, deterministic tie-breakers, tag-index recompute, and redaction behavior.
- Add CLI parser tests for required args, unknown flags, default mode/backup behavior, and replace `--yes` guard.
- Add legacy import fixture without `schemaVersion` and verify migration to current schema.
- Add import integration test for backup naming/content prior to replace overwrite.

**DoD**
- Tests cover conflict/tie policy, guard rails, legacy migration, and backup behavior.
- `bun run test`, `bun run test:coverage`, `bun run typecheck`, and `bun run brand:check` remain green.
