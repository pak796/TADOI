# TIT Milestone 1: Command Bar + Engine

## Scope
- Add in-app TIT command bar overlay in list mode.
- Add shared command parser/executor under `src/commands/*`.
- Commands: `add`, `done`, `due`, `help`.
- Single-line output format: `{ kind: "ok" | "error", text: string }`.

## Command Grammar
- Tokenization splits on whitespace, except inside double quotes.
- Supported token forms:
  - plain words
  - `#tag`
  - `key:value` (quoted value supported, e.g. `notes:"hello world"`)
- Validation:
  - `due:YYYY-MM-DD` must be a real calendar date.
  - `at:HH:MM` must be valid 24h time.
  - `at:` requires `due:`.

### add
`add <title> [due:YYYY-MM-DD] [at:HH:MM] [#tag ...] [notes:"..."]`

### done
`done`
`done @selected`
`done id:<task-id>`

### due
`due @selected YYYY-MM-DD [at:HH:MM]`
`due id:<task-id> YYYY-MM-DD [at:HH:MM]`
`due @selected clear`

### help
`help`
`help add|done|due`

## Keybinds
- Backtick (`) opens TIT in list mode.
- While active, TIT consumes `Esc`, `Enter`, `Up`, `Down` and suppresses list/global binds.
- `Esc` closes TIT.
- `Enter` parses + executes command.
- `Up/Down` browse command history.

## QA Checklist
1. Open TIT with backtick (`) in list mode; verify `j/k` do not move selection while open.
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
5. `help`:
   - `help`
   - `help add`
6. Restart app and verify TIT-created tasks persist.
