# TITS Milestone 1: Command Bar + Engine (Implemented Baseline)

## Purpose
This document is the canonical M1 baseline for follow-up TITS milestone specs.

## Implemented scope
- In-app TITS command bar overlay in list mode.
- Shared command subsystem in `src/commands/*` with no React/OpenTUI imports.
- Commands: `add`, `done`, `due`, `help`.
- Single-line output state:
  - `{ kind: "ok" | "error", text: string }`

## Command bar behavior
- Open: backtick (`` ` ``) in list mode.
- Close: `Esc`.
- Execute: `Enter`.
- History: `Up` / `Down`.
- While active, TITS suppresses list/global binds and handles only TITS keys.
- Command text is read from the latest input buffer value at execute time (avoids stale first-Enter reads).

## Command language
- Tokenization: split by whitespace except inside double quotes.
- Supported token kinds:
  - plain words
  - `#tag`
  - `key:value` (quoted values supported, e.g. `notes:"hello world"`)
- Validation:
  - `due:YYYY-MM-DD` must be a real calendar date.
  - `at:HH:MM` must be valid 24h local time.
  - `at:` requires `due:`.

### add
`add <title> [due:YYYY-MM-DD] [at:HH:MM] [#tag ...] [notes:"..."]`
- If first post-`add` token is option-like (`due:`/`at:`/`notes:`/`#`), title must be quoted.
- Emits actions: `setTasks`, `setTagIndex`, `setSelected`.
- Output: `Added task: <title> (id:<id>)`.

### done
`done`
`done @selected`
`done id:<task-id>`
- M1 behavior is deterministic: force `status="done"` (not toggle).
- Emits actions: `setTasks`, `setSelected`.
- On `open -> done` only, additionally emits:
  - `recordCompletion`
  - `evaluateEngagement`
- Output: `Done: <title>`.

### due
`due @selected YYYY-MM-DD [at:HH:MM]`
`due id:<task-id> YYYY-MM-DD [at:HH:MM]`
`due @selected clear`
`due id:<task-id> clear`
- `clear` is supported for both `@selected` and `id:<task-id>` (id-target clear was added in M2 and remains compatible with TITS).
- Emits actions: `setTasks`, `setSelected`.
- Output: `Due set: ...` or `Due cleared: ...`.

### help
`help`
`help add|done|due`
- No state mutations.
- Output: single-line help text.

## Persistence and state boundaries
- TITS UI state stays local to `App.tsx` (`useState` + refs).
- No TITS UI state is persisted.
- Existing persistence contract is unchanged.

## QA checklist (M1)
1. Open TITS with backtick and verify `j/k` do not move selection while open.
2. `add`:
   - `add "Buy milk" #errands`
   - `add Buy milk due:2026-02-28 at:17:30 #errands`
   - `add "X" due:2026-02-29` (error)
   - `add "X" at:09:00` (error)
3. `done`:
   - `done` marks selected task done.
4. `due`:
   - `due @selected 2026-03-05 at:09:00`
   - `due @selected clear`
   - `due id:<task-id> clear`
5. `help`:
   - `help`
   - `help add`
6. Restart app and verify TITS-created tasks persist.
