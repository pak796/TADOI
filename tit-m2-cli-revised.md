# TIT Milestone 2: External CLI (Revised)

**Project:** TADOI / TUI_TODO  
**Milestone:** 2  
**Date:** 2026-02-19  
**Status:** Implemented baseline (aligned to shipped M2 behavior)  
**Depends on:** Milestone 1 (implemented) — TIT command bar + shared command engine

---

## 0) Context: implemented Milestone 1 baseline (anchor)

Milestone 2 is built directly on the already-implemented TIT command system:

- In-app TIT command bar overlay in list mode.
- Shared command subsystem in `src/commands/*` with no React/OpenTUI imports.
- Commands: `add`, `done`, `due`, `help`.
- Single-line output state: `{ kind: "ok" | "error"; text: string }`.
- Open key in list mode: **backtick** (`` ` ``), not `:`.

### M1 command semantics that M2 must preserve
- Tokenization: whitespace split except inside double quotes.
- Tokens supported: plain words, `#tag`, `key:value` (quoted values supported).
- Validation:
  - `due:YYYY-MM-DD` must be a real calendar date.
  - `at:HH:MM` must be valid 24h local time.
  - `at:` requires `due:`.
- `add` emits: `setTasks`, `setTagIndex`, `setSelected`.
- `done` is deterministic: forces `status="done"` (not toggle).
  - Emits: `setTasks`, `setSelected`.
  - On `open -> done` only, additionally emits: `recordCompletion`, `evaluateEngagement`.
- `due` emits: `setTasks`, `setSelected`.
  - `clear` now supported for both `@selected` and `id:<task-id>`.

### Persistence boundary
- TIT UI state stays local to `App.tsx` and is not persisted.
- Existing persistence contract remains unchanged (data file stays schema-compatible).

---

## 1) Milestone 2 goals

### 1.1 Primary goals
1) Add an **external CLI entrypoint** that reuses the **same** parse/execute engine:
- New file: `src/cli/main.ts`
- Uses: `parseCommand(...)` and `executeCommand(...)` from `src/commands/*`

2) Support two invocation styles:
- Subcommand wrapper:
  - `tadoi add "New task" due:2026-02-28 at:14:30 #work`
  - `tadoi done id:<uuid>`
  - `tadoi due id:<uuid> 2026-03-05 at:09:00`
- Raw DSL passthrough:
  - `tadoi 'add "New task" due:2026-02-28 at:14:30 #work'`

3) Add **locking** + **atomic writes** so CLI edits are safe and cannot be silently overwritten:
- Lock file prevents CLI writes while the TUI app is running.
- Atomic save ensures no corruption on crash/power loss.

### 1.2 Secondary goals (deferred from M2 implementation)
- `--json` output mode for scripting:
  - Print `{ ok, output, changedIds? }`
- `--data-file <path>` override for tests and power-users.

---

## 2) Non-goals (Milestone 2)

- No “live merge” while the TUI app is running (writes are blocked by lock).
- No interactive shell/PTY.
- No recurrence (`recur`) command or next-instance spawning (Milestone 3).
- No expanded query language beyond what M1 already accepts.

---

## 3) CLI UX contract

### 3.1 Output + exit codes
- Success: print one line matching M1 output style (human readable), exit `0`.
- Parse/validation error: print `Error: ...`, exit `2`.
- Target not found / ambiguous: print `Error: ...`, exit `3`.
- Locked: print `Error: TADOI is running (lock present).`, exit `4`.
- IO failure: print `Error: could not read/write data file ...`, exit `5`.

### 3.2 Targeting rules (important)
- `@selected` is **not valid** in CLI context.
  - If parsed, CLI must error with: `@selected is only available in-app. Use id:<uuid>.`
- For determinism, CLI should prefer `id:<uuid>` targets.

### 3.3 “due clear” parity adjustment (M2-required)
M1 supports `due @selected clear`, but CLI cannot use `@selected`.
Therefore, Milestone 2 must extend command support to allow:

- `due id:<uuid> clear`

This is a minimal extension that keeps the command language coherent across TIT + CLI.

> Implementation note: this is best done by extending the existing `due` parser/executor to accept `clear` for any target, not just `@selected`.

---

## 4) Architecture: reuse parse/execute + apply via reducer

### 4.1 High-level flow (write commands)
1) Acquire lock (fail fast if locked).
2) Load state from the same persistence path the app uses.
3) Build command string:
   - If subcommand wrapper, convert argv to the DSL string (preserve quotes).
   - If raw DSL, use argv[0] as-is.
4) Parse with `parseCommand`.
5) Execute with `executeCommand(command, ctx)`.
6) Apply resulting store `Action[]` to state using the **existing reducer**.
7) Save state **atomically**.
8) Print `result.output.text`.

### 4.2 Applying actions
Use existing reducer as the single source of truth:

- Initialize state from `initialState`.
- Apply `{ type: "load", data }` to hydrate.
- Then apply each action from `result.actions` sequentially.

This ensures any future side-effects baked into the reducer (or shared domain logic) are consistent across:
- TIT (in-app dispatch)
- CLI (offline apply)

---

## 5) Locking spec

### 5.1 Lock location
- Lock lives next to the data file.
- Recommend:
  - `lockPath = join(dirname(getDataFilePath()), "tadoi.lock")`

### 5.2 App-side lock management (implemented)
- On app startup: create lock file (best effort).
- On clean exit/destroy: remove lock file.
- Lock file content (JSON):
  - `pid`
  - `startedAt`
  - `version` (optional)
  - `dataFile` (optional)

### 5.3 CLI-side behavior (implemented)
- If lock exists:
  - Exit `4` with a clear message.
- No stale-lock `--force` handling in M2 (deferred).

---

## 6) Atomic save spec

### 6.1 Requirements
- Never partially overwrite the main data file.
- Must be robust to interruption (crash/power loss).

### 6.2 Mechanism
- Write full JSON payload to temp file in same directory:
  - `<dataFile>.tmp.<pid>`
- Flush file (`fsync`).
- Rename temp file to the final data file (atomic on POSIX; best-effort on Windows).
- Best-effort directory sync on POSIX (optional but recommended).

### 6.3 Persistence payload
- Must match what the app expects to load.
- Must not introduce a new format or secondary file.

---

## 7) File-by-file change list (Milestone 2)

### New files
- `src/cli/main.ts`
  - argv parsing
  - lock check
  - load/execute/apply/save
  - output + exit codes
- `src/cli/argv.ts` (optional)
  - turns argv into:
    - `{ mode: "dsl" | "subcommand", input: string, flags }`
- `src/state/saveStateAtomic.ts` (or extend `src/state/persistence.ts`)
  - atomic write helper used by CLI (and later tooling)
- `docs/specs/tit-m2-cli.md` (this document, checked in)

### Modified files
- `src/state/persistence.ts`
  - export a non-debounced, atomic save function (or delegate to helper)
  - export data file path getter if not already exposed
- App bootstrap location (wherever `loadState()` is called in TUI):
  - create + remove lock file

### Minimal engine updates (required for parity)
- `src/commands/parse.ts` / `execute.ts`
  - Extend `due` to support `clear` for `id:<uuid>` targets.

---

## 8) QA checklist (Milestone 2)

### 8.1 CLI smoke tests (app closed)
1) `tadoi 'add "X" #t'` → exit 0, prints “Added task …”
2) Launch app → task appears.
3) `tadoi done id:<uuid>` → task is done when app opens.
4) `tadoi due id:<uuid> 2026-03-05 at:09:00` → due set.
5) `tadoi due id:<uuid> clear` → due cleared.

### 8.2 Lock tests (app open)
1) Launch app (lock created).
2) Run: `tadoi 'add "Y" #t'` → exit 4 with locked message.
3) Close app (lock removed).
4) Run again → success.

### 8.3 Atomicity tests
- Simulate interrupted write (best effort): verify original data file remains valid and loadable.
- Verify temp files are cleaned up or safely ignored on next run.

---

## 9) Milestone 3 hooks (recurrence)

Milestone 2 is intentionally shaped to make Milestone 3 additive and consistent across TIT + CLI.

### 9.1 Milestone 3 deliverables (preview)
- Add recurrence structure to the task model, e.g. `task.recurrence?: RecurrenceRule`.
- Add `recur` command to the same command engine:
  - TIT: `recur @selected every:week on:mon,wed`
  - CLI: `recur id:<uuid> every:week on:mon,wed`
- Implement: **“on done, spawn next instance”**
  - When a recurring task transitions `open -> done`, create a new task instance with the next computed `dueAt`.

### 9.2 Why M2 enables M3 cleanly
- CLI uses the same parse/execute engine and applies actions through the reducer.
- Locking + atomic save provide safe state mutation regardless of front-end.
- Extending the engine with `recur` becomes purely additive (new command + model field + done behavior augmentation).

---

## 10) Acceptance criteria (Milestone 2)

- A `tadoi` CLI exists (via `src/cli/main.ts`) that:
  - Reuses `parseCommand` + `executeCommand`.
  - Supports both `tadoi add ...` and `tadoi 'add ...'`.
  - Refuses writes while app is running (lock file).
  - Writes state atomically.
- CLI mutations appear in the TUI on next launch.
- CLI supports clearing due dates via `due id:<uuid> clear` (parity adjustment).
- No changes break the M1 TIT behavior or persistence contract.
