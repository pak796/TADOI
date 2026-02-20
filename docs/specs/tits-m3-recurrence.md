# TITS Milestone 3: Recurrence

## Scope
Milestone 3 adds recurrence rules to tasks, a `recur` command in the shared command engine (TITS + CLI), and automatic next-instance spawning on `open -> done` transitions.

## Command grammar
- `recur <target> clear`
- `recur <target> every:day|week|month [interval:N] [on:...]`
- `<target>`: `@selected` (TITS only) or `id:<task-id>`

`on:` forms:
- weekly: `on:mon,wed`
- monthly: `on:1,15`
- daily: `on:` is invalid

Defaults:
- `interval` defaults to `1`
- weekly with no `on:` defaults to due date weekday
- monthly with no `on:` defaults to due date month-day

## Behavior
- `recur` requires target task to have `dueAt`.
- `done` remains deterministic (`status = "done"`) and on `open -> done` still emits:
  - `recordCompletion`
  - `evaluateEngagement`
- For recurring tasks (`recurrence.freq` present), `open -> done` spawns a new open task with next `dueAt`.
- `done` on already-done task does not spawn.
- List-mode space/toggle completion uses the same recurrence completion helper.

## CLI policy
- CLI supports `recur` in both wrapper and raw DSL forms.
- CLI rejects `@selected` targets with:
  - `Error: @selected is only available in-app. Use id:<uuid>.`
- Existing lock and atomic-save behavior from M2 remains unchanged.

## QA checklist
1. TITS: `due @selected 2026-03-05 at:09:00`
2. TITS: `recur @selected every:week on:mon,wed`
3. TITS: `done` => original done + spawned next open instance
4. TITS: `recur @selected clear`
5. CLI (app closed): `tadoi recur id:<uuid> every:week on:mon`
6. CLI (app closed): `tadoi done id:<uuid>` => spawned next instance persists
7. Edge checks:
   - `recur` without due => error
   - monthly `on:31` clamps to month end
   - weekly `interval:2` skips one week cycle
