# TADOI™ Spec — Checklists & Subtasks (v0.1)

Updated: 2026-02-26  
Target runtime baseline: v0.3.8+  
Target persistence schema: **8** (bump from current schema 7)  
Stability taxonomy: **Current Behavior (May Change)** until promoted to Canonical

---

## 0) Summary

Add per-task **Checklist Items** (aka lightweight subtasks) with:

- fast toggle + progress visibility in LIST
- view/toggle in Details pane without opening EDIT
- full edit in ADD/EDIT forms
- recurrence-aware behavior (occurrence overrides materialize when checklist state changes)

This is **not** a full hierarchical project tree. It is a compact “subtasks inside a task” feature that fits terminal constraints and existing routing contracts.

---

## 1) Goals

### 1.1 User value

- Represent “task contains multiple steps” without creating separate tasks.
- Allow completion progress without marking the parent task done.
- Keep keyboard-first workflows intact (no mouse-only features).

### 1.2 Product / engineering constraints

- Preserve strict mode boundaries and key-router priority order.
- Preserve recurrence semantics exactly (complete/skip/snooze/delete/edit-series contract).
- Do not introduce new primary modes.
- Keep minimum terminal contract (104x24) and degrade gracefully under vertical pressure.
- Persisted state must remain backward compatible with normalization fallbacks.

---

## 2) Non-goals (v0.1)

- True nested tasks / arbitrary depth trees.
- Dependencies (“blocked by”), critical path, or task graphs.
- Background reminders or daemon behaviors.
- NLP parsing for checklist capture beyond deterministic tokens.
- Bulk checklist editing (handled by Bulk Ops spec separately).

---

## 3) Terminology

- **Checklist**: ordered list of items attached to a task.
- **Checklist Item**: `{ id, text, isDone, ... }`.
- **Template vs occurrence**: for recurring tasks, checklist structure lives on the **series root**; per-occurrence checklist completion can live on **materialized overrides**.

---

## 4) UX / UI Behavior

### 4.1 List rendering (task rows)

- If a task has checklist items, render a compact progress indicator in the row suffix:
  - `CL 0/3`, `CL 2/5`, `CL 5/5`
- If all items done and task status is still open, do **not** auto-mark parent task done (explicit user action remains `Space`).

### 4.2 Details pane rendering

Add a new Details section under the existing Links block:

```
CHECKLIST (2/5)
[ ] item text...
[x] item text...
...
```

If no checklist items:

- show nothing (preferred) or a single-line hint:
  - `CHECKLIST: (none) — add in EDIT`

### 4.3 Focus model in LIST mode (no new mode)

TADOI currently supports a Details Links focus accessed via `Tab`.

**Contract-preserving extension:**

- `Tab` / `Shift+Tab` still moves focus from Task List → Details (default subpane = Links, as today).
- While focus is in Details:
  - `ArrowLeft` / `ArrowRight` switches subpane: `LINKS` ↔ `CHECKLIST`
  - `Esc` returns focus to Task List

This preserves the existing “Tab gets me into details links” muscle memory while adding checklist access.

### 4.4 Checklist interaction keys (Details → Checklist subpane)

While checklist subpane is focused:

- `j/k` or `ArrowUp/ArrowDown`: move checklist selection
- `Space`: toggle selected checklist item done/open
- `Enter`: no-op in v0.1 (reserved for future inline edit)
- `d` / `Backspace`: **delete checklist item** (opens confirm modal)
- `a`: **add checklist item** (opens a small single-line input modal)
- `e`: **edit checklist item text** (opens small single-line input modal)
- `Esc`: return focus to task list (or to links subpane if you prefer a 2-step unwind; choose one and lock it with tests)

### 4.5 Add/Edit forms

Add an explicit Checklist editor section in both ADD and EDIT panes:

- Render as an ordered list with:
  - per-item text input
  - toggle done (for non-recurring tasks and for materialized instance overrides)
  - add/remove item controls
  - reorder: optional in v0.1 (see 7.3)

#### Recurring tasks: series vs occurrence

- `E` (edit series) edits the **series root** checklist structure (items + order + default done=false).
- `e` (edit occurrence) edits the **occurrence override** checklist state for that occurrence.

### 4.6 Recurrence semantics for checklist toggles

Checklist toggles must respect sparse materialization:

- **Non-recurring task**: toggle updates task directly.
- **Recurring series root row (real task row)**: toggle is treated as an occurrence-level change for the currently-visible occurrence:
  - If the selected row represents a virtual occurrence: toggling a checklist item must **materialize an override instance** for that occurrence date (same behavior class as “edit occurrence”).
  - If the selected row is already a materialized override: toggle updates that override.

**No EXDATE is added for checklist toggles.** EXDATE remains reserved for complete/skip/snooze/delete occurrence semantics.

### 4.7 Terminal size / compression rules

- Under vertical constraint, checklist panel collapses to:
  - `CHECKLIST (2/5) — press Tab → → to view`
- Checklist list should be scrollable (line-based) within details pane bounds.

---

## 5) Commands (TITS + CLI)

### 5.1 TITS commands (in-app command bar)

Add deterministic commands for scriptable checklist management:

- `check add @selected "text..."`
- `check toggle @selected <index>`
- `check edit @selected <index> "new text"`
- `check del @selected <index>`
- `check clear @selected`

Rules:

- `<index>` is 1-based display index in the current checklist ordering.
- `@selected` remains allowed only in TITS (not CLI), consistent with existing constraints.

### 5.2 CLI parity

Add CLI equivalents requiring explicit targets:

- `tadoi check:add id:<task-id> "text..."`
- `tadoi check:toggle id:<task-id> <index>`
- `tadoi check:edit id:<task-id> <index> "new text"`
- `tadoi check:del id:<task-id> <index>`
- `tadoi check:clear id:<task-id>`

Exit codes and validation must follow the existing matrix.

---

## 6) Data Model & Persistence

### 6.1 Domain model additions

In `Task`:

```ts
checklist?: ChecklistItem[];
```

`ChecklistItem`:

```ts
type ChecklistItem = {
  id: string; // stable UUID
  text: string; // trimmed, non-empty
  isDone: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  completedAt?: string; // ISO when isDone true
  sort: number; // stable ordering key
};
```

Notes:

- `sort` supports stable ordering without depending on array index.
- `completedAt` is optional and can be omitted if not needed for analytics in v0.1.

### 6.2 Schema bump

- Bump persistence schema from 7 → **8**
- Migration 7→8:
  - For every task missing `checklist`, set `checklist = []` (or leave undefined and normalize to empty at runtime; pick one strategy and enforce it consistently).

### 6.3 Portability / Backup Center / Import-export

- Full JSON export/import includes `checklist` fields.
- Import merge rules:
  - Task ID is the identity key; checklist merges are last-write-wins per task (consistent with other task fields unless you already do field-wise merge).
- Calendar ICS export/import: checklist is **not represented** (non-goal).

---

## 7) Validation, Safety, and Edge Cases

### 7.1 Input validation rules

- Checklist item `text`:
  - trim whitespace
  - reject empty after trim
  - reject control characters consistent with existing security posture
- Cap checklist length:
  - default max items per task: **100** (hard cap; configurable later)

### 7.2 Modal semantics

Checklist delete uses `MODAL_CONFIRM` with consistent `y/n/Esc` behavior.

### 7.3 Ordering / reorder (scope)

v0.1:

- Support add/edit/delete/toggle only.
- Reorder is optional; if included:
  - `Shift+Up/Down` is _not_ allowed unless already canonical.
  - Prefer deterministic reorder commands in EDIT pane (e.g., “Move Up/Down” buttons or `[`/`]` while focused in checklist editor subpane).

### 7.4 Recurrence-specific edge cases

- When series checklist structure changes, existing occurrence overrides:
  - retain existing items by `id`
  - any missing series items are appended as `isDone=false`
  - any override-only items remain (not deleted automatically)

---

## 8) Acceptance Criteria

### Functional

1. Tasks can store a checklist; checklist renders with `CL x/y` in list rows.
2. Checklist toggles in Details pane do not require entering EDIT mode.
3. Checklist toggles on virtual recurring occurrences materialize an override instance without EXDATE.
4. `Tab` behavior to reach Links focus remains intact; switching to Checklist uses left/right inside Details focus.
5. JSON export/import round-trips checklist data with schema 8.
6. Help + keybinding docs updated and keybind canonical check remains green.

### Quality gates

- All required local validation commands pass:
  - `bun run test`
  - `bun run test:coverage`
  - `bun run typecheck`
  - `bun run brand:check`
  - `bun run pack:dry`
  - `bun run pack:inspect`
  - `bun run pack:smoke`

---

## 9) Test Plan (minimum)

### Automated

- Add/extend contract tests:
  - Checklist focus routing does not leak list navigation keys while focused.
  - Checklist toggle on recurring virtual occurrence materializes override without EXDATE.
  - Schema migration 7→8 loads legacy data and normalizes checklist to empty.
  - CLI parsing/validation for `check:*` commands.

### Manual QA (new IDs)

- `QA-CL-001` add/edit/delete checklist items on non-recurring task
- `QA-CL-002` toggle checklist items from Details pane
- `QA-CL-003` checklist persists through export/import (merge + replace)
- `QA-CL-004` recurring occurrence: toggle checklist on a virtual row creates override and persists
- `QA-CL-005` terminal size compression keeps app usable; checklist collapses cleanly

---

## 10) Rollout Notes

- Ship as v0.3.x minor if stable, or v0.4.0 if schema bump policy prefers major/minor boundary.
- Keep feature “Current Behavior (May Change)” until at least one release cycle of real usage.
