# TITS Milestone 2: External CLI (Implemented Contract)

## Scope
- Reuse `src/commands/*` parser + executor from M1.
- Add external CLI command path for: `add`, `done`, `due`, `help`.
- Add lock-file write blocking for CLI mutations while TUI is running.
- Add atomic save path for CLI state writes.
- Add parity support for `due id:<task-id> clear`.

## Invocation forms
- Subcommand wrapper:
  - `tadoi add ...`
  - `tadoi done id:<task-id>`
  - `tadoi due id:<task-id> ...`
  - `tadoi recur id:<task-id> ...`
  - `tadoi help ...`
- Raw DSL passthrough:
  - `tadoi 'add "Task" due:2026-03-05 #tag'`
  - Raw DSL handling is enabled when the post-binary argv is a single TITS command string.
- Interactive routing:
  - `tadoi` -> launch TUI
  - `tadoi --interactive` -> launch TUI
  - unknown top-level token/flag -> fail fast with usage (`exit 2`, no TUI fallback)
- Wrapper help and literal delimiter:
  - `tadoi add --help` / `done --help` / `due --help` / `recur --help` / `help --help` -> topic help, no mutation
  - `tadoi add -- --help` -> literal title token `--help`
- Scriptability flags (non-interactive commands):
  - `--json` structured output envelope
  - `--quiet` suppresses non-essential non-error output
  - `--data-file <path>` per-invocation data-path override (higher precedence than `TADOI_DATA_PATH`)

## Exit codes
- `0`: success
- `2`: parse/validation error
- `3`: target resolution error (`done`/`due` id not found)
- `4`: locked (lock file present for write command)
- `5`: IO error (lock check/load/save failure)

## Locking
- Lock file path: `join(dirname(dataFilePath), "tadoi.lock")`.
- TUI behavior:
  - creates lock on startup (best effort)
  - removes lock on clean exit/destroy
- CLI behavior:
  - `add|done|due` refuse write when lock exists (`exit 4`)
  - `help` remains read-only and bypasses lock.

## Command rules in CLI
- `@selected` is rejected in CLI:
  - `Error: @selected is only available in-app. Use id:<uuid>.`
- This includes implicit selected targets (`tadoi done` without `id:` is rejected with exit code `2`).
- `due` supports both:
  - `due @selected clear` (in-app behavior unchanged)
  - `due id:<task-id> clear` (M2 parity addition)

## Persistence behavior
- CLI loads existing data via current persistence pipeline.
- CLI applies emitted actions via reducer (`load` then action replay).
- CLI saves full schema payload atomically:
  - write temp `<dataFile>.tmp.<pid>[.<n>]`
  - fsync temp
  - rename temp to data file
  - best-effort directory fsync on POSIX
  - best-effort temp cleanup on failure

## QA checklist
1. App closed: `tadoi 'add "X" #t'` succeeds (`0`), task appears on next app launch.
2. App open: `tadoi 'add "Y"'` returns locked (`4`).
3. `tadoi due id:<uuid> clear` removes due date.
4. `tadoi 'add "X" due:2026-02-29'` returns parse/validation (`2`).
5. `tadoi done id:not-a-real-id` returns target resolution (`3`).
