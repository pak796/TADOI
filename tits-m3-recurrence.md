# TITS Milestone 3: Recurrence (Scoped Spec)

**Project:** TADOI / TUI_TODO  
**Milestone:** 3  
**Date:** 2026-02-19  
**Status:** Scoped spec (implementation-ready)  
**Depends on:**  
- Milestone 1 (TITS command bar + shared engine) — implemented baseline  
- Milestone 2 (External CLI + lock + atomic save) — implemented baseline

---

## 0) Context and invariants

Milestone 3 extends the **existing shared command engine** (used by both TITS and the external `tadoi` CLI) and preserves these invariants:

- Command system lives in `src/commands/*` and is UI-agnostic.
- Command language: tokens, `#tag`, `key:value` (quoted values), and validation rules remain unchanged.
- `done` is deterministic (force `status="done"`) and, on `open -> done`, emits engagement actions (`recordCompletion`, `evaluateEngagement`).
- CLI rejects `@selected` targets; TITS may use `@selected`.
- CLI writes are lock-protected and use atomic saves.

---

## 1) Milestone 3 goals

### 1.1 Primary goals
1) **Add recurrence structure in the task model**
- Persist a recurrence rule on a task.
- Keep it minimal and local-first (no external scheduling service).

2) **Add a `recur` command** to the shared command engine
- TITS: `recur @selected ...` and `recur @selected clear`
- CLI: `recur id:<uuid> ...` and `recur id:<uuid> clear`

3) **Implement “on done, spawn next instance”**
- When a recurring task transitions `open -> done`, create a new open task instance representing the next occurrence.

### 1.2 Secondary goals (nice-to-have, small)
- Preserve UX continuity by selecting the spawned instance (when visible).
- Validate recurrence rules with actionable error messages.
- Ensure recurrence behavior is consistent across:
  - TITS `done`
  - CLI `done`
  - Any other completion pathways that mark tasks done (see §6).

---

## 2) Non-goals (Milestone 3)

- No ICS RRULE import/export of recurrence rules (can come later).
- No “virtual occurrences” UI (i.e., infinite computed rows). This milestone is **materialization** only.
- No sophisticated exception handling (skip dates, holiday rules, timezone overrides).
- No multi-instance generation ahead of time (only generate the next instance at completion time).

---

## 3) Data model changes

### 3.1 Task shape extension
Extend `Task` with:

```ts
export type RecurrenceRule = {
  freq: "daily" | "weekly" | "monthly";
  interval: number;              // >= 1
  byDay?: Array<"mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun">;  // weekly only
  byMonthDay?: number[];         // monthly only (1..31)
  anchorLocal?: {                // optional, but recommended
    hour: number;                // 0..23
    minute: number;              // 0..59
  };
};

export type Task = {
  // existing fields...
  recurrence?: RecurrenceRule;
};
```

### 3.2 Persisted schema and migrations
- Add `recurrence` as an optional field in persisted task objects.
- Migration strategy: old tasks load with `recurrence: undefined`.
- No new persistence file format; keep same JSON payload contract.

### 3.3 Behavioral constraints
- A task with `recurrence` **must** have a `dueAt` to act as the scheduling anchor.
  - If user attempts to set recurrence without `dueAt`, `recur` returns an error:
    - `Error: recurrence requires a due date (set due:YYYY-MM-DD [at:HH:MM] first).`

---

## 4) Command language changes (shared engine)

### 4.1 New command: `recur`

#### Forms
- Set recurrence:
  - `recur @selected every:day`
  - `recur @selected every:week on:mon,wed`
  - `recur @selected every:month on:1,15`
  - Optional interval:
    - `recur @selected every:week interval:2 on:mon`
- Clear recurrence:
  - `recur @selected clear`
  - `recur id:<uuid> clear`

#### Tokens
- `every:` required for setting rules:
  - `every:day|week|month` (aliases allowed: `daily|weekly|monthly`)
- `interval:` optional integer >= 1 (default 1)
- `on:` optional list:
  - for weekly: `mon,tue,wed,thu,fri,sat,sun`
  - for monthly: `1..31`

#### Validation rules
- `interval:` must be integer >= 1
- weekly:
  - `on:` required (at least one day) OR default to the weekday of `dueAt`
- monthly:
  - `on:` optional; default to day-of-month of `dueAt`
  - each `on:` day must be 1..31
- daily:
  - `on:` is invalid (error)
- Setting recurrence requires `task.dueAt` present

#### Effects
- Sets `task.recurrence = RecurrenceRule` on the target task.
- Updates `updatedAt = now`.

#### Outputs
- Set: `Recurrence set: <title> -> weekly (mon,wed) every 1`
- Clear: `Recurrence cleared: <title>`

---

## 5) “On done, spawn next instance” semantics

### 5.1 Trigger condition
When a task transitions `status: "open" -> "done"` **and** has `recurrence`:
- Mark the current task done as usual.
- Create the next instance task.

If a task is already `"done"` and a user runs `done` again:
- No spawn should occur (idempotent completion).
- Output remains `Done: <title>` (or `Already done: <title>` if you prefer).

### 5.2 Spawned task fields
The spawned task should copy “identity-like” fields and reset lifecycle fields:

- `id: crypto.randomUUID()`
- `title: original.title`
- `tags: original.tags`
- `notes: original.notes` (optional)
- `status: "open"`
- `createdAt: now`
- `updatedAt: now`
- `dueAt: nextDueAt(original.dueAt, original.recurrence)`
- `recurrence: original.recurrence` (the rule stays attached to the *template lineage*)

**Selection behavior (recommended)**
- If the spawned task is visible under current filters, select it:
  - emit `setSelected` with spawned id
- Otherwise, keep selection on the next visible item (do not force selection to an invisible row).

### 5.3 Engagement interactions
Preserve existing engagement behavior for completion:
- When transitioning `open -> done`, continue emitting:
  - `recordCompletion` and `evaluateEngagement`
- Spawning a new task should **not** count as a completion.

---

## 6) Where to implement recurrence logic (consistency requirement)

Milestone 3 must ensure the spawn logic triggers regardless of completion pathway.

### Option A (recommended): centralize in a shared domain helper
Create a helper used by all completion entrypoints:

- `src/domain/recurrence.ts`
  - `computeNextDueAt(dueAt: number, rule: RecurrenceRule): number`
  - `completeTaskWithRecurrence(tasks, taskId, now): { tasks: Task[], spawnedId?: string }`

Then update:
- Command executor for `done` to call the helper.
- Any non-command completion (e.g., list-mode space toggle) to use the same helper when moving `open -> done`.

This approach avoids adding new store action types.

### Option B: reducer-driven completion action
Introduce a new store action like `completeTask` and have the reducer handle spawn.
This is clean but requires expanding the action union, which is higher risk (touches core store contracts).

**Decision for M3:** Choose Option A unless you explicitly want to refactor completion semantics into the reducer.

---

## 7) Next occurrence computation

### 7.1 General approach
All recurrence calculations are local-time based, anchored to the existing `dueAt` timestamp.

- Derive local components from `dueAt` (year, month, day, weekday, hour, minute).
- Compute next occurrence date according to the rule.
- Reconstruct `nextDueAt = new Date(y, m, d, hour, minute).getTime()`.

### 7.2 Rules

#### Daily
- Add `interval` days.
- Keep same local time.

#### Weekly
- Consider the set of weekdays in `byDay`.
- Find the next weekday after the current due date.
- If none remain in the current week, advance by `interval` weeks and pick the first weekday in `byDay` order.

#### Monthly
- Use `byMonthDay` if present; otherwise use the day-of-month of the anchor `dueAt`.
- If the target day doesn’t exist in a month (e.g., 31 in April), clamp to the last day of the month.
- Advance by `interval` months to find the next matching day after the current date.

**Note:** This is intentionally simple and deterministic.

---

## 8) File-by-file change list (Milestone 3)

### New files
- `src/domain/recurrence.ts`
  - `computeNextDueAt(...)`
  - `completeTaskWithRecurrence(...)`
- `docs/specs/tits-m3-recurrence.md` (this doc)

### Modified files
- `src/domain/models.ts`
  - Add `RecurrenceRule` type
  - Extend `Task` with `recurrence?: RecurrenceRule`
- `src/commands/types.ts`
  - Add `recur` command to `Command` union
- `src/commands/parse.ts`
  - Parse `recur` forms: set + clear
- `src/commands/execute.ts`
  - Implement `recur` (set/clear recurrence)
  - Update `done` execution to spawn next instance when applicable (via helper)
- `src/app/App.tsx` (or wherever non-command completion is handled)
  - If list-mode `space` can complete tasks, ensure it calls the shared helper on `open -> done`

### Optional (only if needed)
- `src/state/persistence.ts`
  - If schema validation exists, ensure `recurrence` passes through unchanged.

---

## 9) QA checklist (Milestone 3)

### 9.1 Command-level QA (TITS)
1) Set due and recurrence:
   - `due @selected 2026-03-05 at:09:00`
   - `recur @selected every:week on:mon,wed`
   - Expect: `Recurrence set: ...`
2) Complete:
   - `done`
   - Expect:
     - selected task becomes done
     - a new open task appears with next due date
3) Clear:
   - `recur @selected clear`
   - Expect: `Recurrence cleared: ...`

### 9.2 CLI QA
1) App closed:
   - `tadoi recur id:<uuid> every:week on:mon`
   - `tadoi done id:<uuid>`
   - Re-open app and verify next instance exists.
2) Validate CLI rejects selected:
   - `tadoi 'recur @selected every:day'` -> error

### 9.3 Edge cases
- Monthly on 31:
  - Due at Jan 31 + monthly -> Feb clamps to Feb 28/29, then March 31, etc.
- Weekly with interval 2:
  - Ensure skipping 1 week properly.
- Attempt to set recurrence without due date:
  - `recur @selected every:day` -> error requiring due first.
- Idempotency:
  - Running `done` on already-done recurring task should not spawn another task.

---

## 10) Acceptance criteria (Milestone 3)

- Task model includes `recurrence?: RecurrenceRule` and persists through load/save.
- `recur` command works in TITS and CLI (targets differ: `@selected` vs `id:`).
- When a recurring task transitions `open -> done`, the next instance is spawned with computed `dueAt`.
- Behavior is consistent across in-app TITS and external CLI, and any other completion pathway that marks tasks done.
- No regressions to existing M1/M2 command behaviors, locking, or persistence.

