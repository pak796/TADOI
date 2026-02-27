# TADOI™ Spec — Bulk Operations (Multi-select + Batch Mutations) (v0.1)

Updated: 2026-02-26  
Target runtime baseline: v0.3.8+  
Persistence schema: **no change** (UI-only state)  
Stability taxonomy: **Current Behavior (May Change)** until promoted to Canonical

---

## 0) Summary

Add **bulk selection** (multi-select) in LIST mode and a **bulk command surface** via TITS + CLI:

- mark multiple rows
- execute batch operations safely and deterministically
- preserve existing single-item keybind semantics (especially `Space`, `d`, recurrence actions)

Primary execution path is through **TITS** (`bulk ...`) to minimize new keybind surface area.

---

## 1) Goals

### 1.1 User value
- Fast batch tagging, due changes, stage/assignee/project assignments, and completion across many tasks.
- Reduce repetitive single-task edits without introducing mouse dependency.

### 1.2 Contract constraints
- No new primary modes; remain in LIST.
- Preserve routing priority order (modals > TITS > … > list actions).
- Preserve recurrence semantics for `Space/x/z/d/e/E`.
- No destructive refactors; keep shared parse/execute architecture.

---

## 2) Non-goals (v0.1)

- Bulk operations from DASHBOARD (can be v0.2).
- Multi-user / sync / collaborative batch edits.
- Background batch jobs.
- “Undo stack” (explicitly out unless already planned).
- Bulk operations inside BACKUP_CENTER flows.

---

## 3) Bulk Selection Model

### 3.1 UI state (non-persisted)
Add to UI state (not domain state):
- `bulkMarked: string[]` (task IDs, stable order not required)
- `bulkCount: number` derived
- `bulkActive: boolean` derived (`bulkMarked.length > 0`)

### 3.2 Selection scope rule (safety-first)
Bulk operations apply to **currently visible, currently filter-matching** tasks only.

When filters/search change:
- any marked tasks that are no longer visible are automatically unmarked.

Rationale: prevents “hidden batch mutation” surprises.

### 3.3 Recurrence rows
- If a row is a real task row with a stable task ID: it can be marked.
- If a row is a *pure virtual occurrence* with no stable task ID:
  - v0.1 behavior: show a toast/banner: `Bulk selection does not support virtual occurrences (yet).`
  - (Optional v0.2: support marking occurrence keys and applying occurrence-level ops.)

---

## 4) UX / UI Behavior

### 4.1 Marking tasks
In LIST mode:
- `m`: toggle mark/unmark for the currently selected row.
- Marked rows show a prefix indicator:
  - `[*]` marked
  - `[ ]` unmarked (optional; keep minimal visual noise)

### 4.2 Bulk HUD / affordance
When `bulkActive`:
- Bottom bar shows:
  - `BULK: <n> marked  |  ` + "` bulk ...  |  Esc clear" + `
- Left-rail or footer hints include `m` toggling and the primary action surface (TITS).

### 4.3 Clearing marks
- `Esc` in LIST mode:
  - if `bulkActive`: clears marks (no modal), consumes the key
  - else: existing behavior unchanged

### 4.4 Execution surface
**Primary:** TITS command bar (already list-only, already suppresses list keybinds)
- open: `` ` ``
- execute: `Enter`
- close: `Esc`

Bulk commands operate on the marked set.

**Secondary (optional v0.1):** a small “bulk action quick panel” is out of scope; keep this command-driven.

---

## 5) Bulk Operations (what to support)

### 5.1 v0.1 operations (recommended minimal set)
- `bulk done` — mark all selected tasks done (same semantics as per-task done)
- `bulk reopen` — reopen tasks (if supported in your model)
- `bulk tag add #tag`
- `bulk tag rm #tag`
- `bulk due YYYY-MM-DD [at:HH:MM]`
- `bulk due clear`
- `bulk priority <P?>` (align with existing priority model)
- `bulk assignee <value>` / `bulk assignee clear`
- `bulk project <value>` / `bulk project clear`
- `bulk stage <todo|doing|blocked|done>` (align with existing workflowStage model)
- `bulk delete` — **gated** (see 6.3)

### 5.2 Ordering / atomicity
- Apply operations deterministically in ascending task-id order (or stable visible-row order).
- Persist once after batch apply, not per-task, to minimize IO and reduce partial-state risk.
- If one task fails validation (rare), fail the entire bulk operation with an error summary and **no partial writes**.

---

## 6) Safety & Modal Semantics

### 6.1 Confirmations
Bulk operations that are destructive or high-impact must use `MODAL_CONFIRM`:
- `bulk delete` always confirms
- `bulk due clear` may confirm if >N tasks (optional threshold)
- `bulk stage done` might not need confirm (non-destructive)

### 6.2 Confirmation copy
Delete confirmation modal should include:
- count of tasks
- how many are recurring series roots vs non-recurring (if cheap to compute)
- example: `Delete 12 tasks? (2 recurring series)  y/n`

### 6.3 Recurring delete constraints (v0.1)
To avoid breaking established recurring delete semantics:
- `bulk delete` only operates on **task entities**, not occurrence-level deletions.
- If marked set includes any rows that would require “this vs this+future” per-occurrence choices:
  - v0.1: block with actionable message:
    - `Bulk delete cannot delete recurring occurrences. Unmark occurrences or delete individually (d).`

### 6.4 Locking & concurrency
- CLI bulk writes remain lock-gated if TUI lock exists, consistent with current behavior.
- TUI bulk operations use the existing atomic save policy.

---

## 7) Commands (TITS + CLI)

### 7.1 TITS commands (in-app)
New command namespace: `bulk`

Examples:
- `bulk done`
- `bulk tag add #home #errands`
- `bulk tag rm #home`
- `bulk due 2026-03-01 at:09:00`
- `bulk due clear`
- `bulk stage doing`
- `bulk delete`

Validation rules:
- If `bulkMarked` is empty, command fails with:
  - `No tasks marked. Press 'm' to mark tasks first.`
- Commands are deterministic and must not fall back to operating on `@selected` implicitly (avoid surprise).

### 7.2 CLI parity
Because CLI cannot use `@selected` and has no marked set, add a deterministic target spec:

Option A (recommended): repeated `id:<task-id>` tokens
- `tadoi bulk:done id:abc id:def id:ghi`
- `tadoi bulk:tag:add id:abc id:def #tag`
- etc.

Option B: `ids:<comma-separated>`
- `tadoi bulk:done ids:abc,def,ghi`

Pick one and keep parsing simple; **do not** accept ambiguous freeform lists.

Exit code semantics remain consistent with the existing matrix:
- `2` parse/validation
- `3` target resolution mismatch
- `4` lock present
- `5` IO/runtime failure

---

## 8) Keybindings (additions)

In LIST mode:
- `m`: mark/unmark current task row
- `Esc`: if any marked, clear marks and consume; otherwise unchanged
- No change to `Space`, `d`, `x`, `z`, `e`, `E`, `/`, filters, or dashboard toggles.

Help + generated canonical keybind docs must be updated so keybind audit remains green.

---

## 9) Acceptance Criteria

### Functional
1. User can mark multiple tasks in LIST mode with `m`; marked rows display an indicator.
2. `Esc` clears marks when any exist (no modal), and does not affect other Esc unwind behavior.
3. TITS `bulk ...` commands operate only on marked tasks, and fail if none are marked.
4. Bulk operations are deterministic and commit as a single atomic mutation (no partial writes).
5. `bulk delete` is safely gated and does not violate recurring delete semantics.

### Quality gates
All required local validation commands pass:
- `bun run test`
- `bun run test:coverage`
- `bun run typecheck`
- `bun run brand:check`
- `bun run pack:dry`
- `bun run pack:inspect`
- `bun run pack:smoke`

---

## 10) Test Plan (minimum)

### Automated
- Unit tests for parser + executor:
  - `bulk` command parsing (TITS + CLI variants)
  - empty-marked-set failure path
  - deterministic ordering and “no partial writes” behavior
- Key router tests:
  - `m` toggles marks in LIST and does not leak into other modes
  - `Esc` clears marks only when active; otherwise existing behavior unchanged
- Integration tests:
  - bulk tag add/remove across tasks
  - bulk due set/clear validation (including `at` requires `due` rule)

### Manual QA (new IDs)
- `QA-BULK-001` mark/unmark behavior + visual indicators
- `QA-BULK-002` filter/search change clears non-visible marks
- `QA-BULK-003` bulk tag add/rm correctness
- `QA-BULK-004` bulk due set/clear correctness (including due+at validation)
- `QA-BULK-005` bulk delete gating + confirmation copy
- `QA-BULK-006` recurring rows cannot be bulk-deleted in forbidden cases

---

## 11) Rollout Notes
- Ship as “Current Behavior (May Change)” until at least one release proves no routing regressions.
- Prefer keeping bulk execution via TITS to avoid keybind surface sprawl.
