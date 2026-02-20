# TADOI — TIT Command Engine + Command Bar Overlay (Milestone 1)

**Feature:** TIT (Terminal‑in‑Terminal) Command Bar  
**Milestone:** 1 (Command engine + in-app command bar)  
**Date:** 2026-02-19  
**Spec version:** v0.2 (implemented baseline)

---

## 1) Goal and scope

### 1.1 Goals (Milestone 1)
- Add an **in-app command bar overlay** (“TIT”) that accepts a compact CLI syntax.
- Implement a **shared command engine** (parser + executor) for:
  - `add` — create task
  - `done` — mark task done
  - `due` — set/clear due date/time
  - `help` — show help text (no mutation)
- Display **single-line command output**:
  - Success: `Added task: …`
  - Error: `Error: invalid date …`

### 1.2 Non-goals (Milestone 1)
- No external `tadoi` CLI binary yet (Milestone 2 framework only).
- No recurrence command yet (Milestone 3 framework only).
- No interactive shell/PTY terminal emulator.
- No autocompletion (leave an extension point; not required).

### 1.3 Design principles
- **Single command language**, multiple front-ends (TIT now, external CLI later).
- **Executor is pure**: `Command + Context -> Action[] + Output`.
- **Reducer remains the authority** for domain mutations:
  - The command engine emits **existing store actions** where possible.
- **Keep M1 minimal**:
  - Do *not* add new store action types for command UI state (store UI state locally in `App.tsx` for fastest delivery).

---

## 2) Inputs and UX

### 2.1 Open/close and navigation
- Open TIT: backtick (`` ` ``) in list mode
- Execute: `Enter`
- Close: `Esc`
- History: `Up` / `Down`
- While TIT is open:
  - Suppress list-mode global binds (`j/k/a/e/t/...`)
  - Suppress editor-mode keybinds if you later allow TIT in editor modes (out of scope for M1; list mode only recommended)

### 2.2 UI placement
- Render an **absolute overlay** at the bottom of the root `<box>` in `App.tsx`.
- Content:
  - Prompt label `:`
  - Input control (`<input focused .../>`)
  - Output line (single line, truncation/ellipsis acceptable)

### 2.3 Output line rules
- Keep output to **one line** in M1 for both TUI readability and future CLI parity.
- Store last output as:
  - `{ kind: "ok" | "error"; text: string }`

---

## 3) Command language (Milestone 1)

### 3.1 Token rules
- Split by whitespace **except inside double quotes** (`"..."`).
- Support:
  - `#tag` tokens
  - `key:value` tokens (value may be quoted)
- Normalize tags using existing `normalizeTag(...)` and de-dupe.

### 3.2 Date/time rules
- `due:YYYY-MM-DD` must be a real calendar date.
  - Example: `2026-02-29` is invalid (not a leap year) → error.
- `at:HH:MM` is 24-hour local time.
- `at:` requires `due:` (error if time is provided without a due date).

### 3.3 Commands

#### A) `add`
**Form**
- `add <title> [due:YYYY-MM-DD] [at:HH:MM] [#tag ...] [notes:"..."]`

**Title rules**
- Title can be quoted or unquoted.
- If the first token after `add` starts with `due:`/`at:`/`notes:`/`#`, then title **must** be quoted or the parser returns a friendly error.

**Effect**
- Creates a new `Task` with:
  - `id = crypto.randomUUID()`
  - `status = "open"`
  - `createdAt/updatedAt = now`
  - `dueAt = parsed timestamp (optional)`
  - `tags = normalized`
  - `notes = optional`
- Updates tag index.

**Output**
- `Added task: <title> (id:<id>)`

---

#### B) `done`
**Form**
- `done` (defaults to selected task in TIT)
- `done @selected`
- `done id:<uuid>`

**Target resolution**
- In TIT, `done` implies `@selected`.
- If no selected task exists → error.

**Effect**
- **Force done** in M1: set `status="done"` always and set `updatedAt`/`closedAt`.
- Emit engagement actions only when transitioning `open -> done`:
  - `recordCompletion`
  - `evaluateEngagement`

**Output**
- `Done: <title>`

---

#### C) `due`
**Form**
- `due @selected YYYY-MM-DD [at:HH:MM]`
- `due id:<uuid> YYYY-MM-DD [at:HH:MM]`
- `due @selected clear`
- `due id:<uuid> clear`

**Rules**
- `clear` removes `dueAt`.
- Current implementation supports both `@selected` and `id:<uuid>` clear forms.
- `at:` optional and only valid when setting a date.

**Output**
- `Due set: <title> -> 2026-03-05 09:00`
- `Due cleared: <title>`

---

#### D) `help`
**Form**
- `help`
- `help add|done|due`

**Effect**
- No state mutation.
- Output is a single-line summary:
  - `Commands: add, done, due, help. Try: help add`

---

## 4) Command engine (shared)

### 4.1 Modules
Create a new command subsystem:

- `src/commands/types.ts`
- `src/commands/parse.ts`
- `src/commands/validate.ts`
- `src/commands/execute.ts`
- `src/commands/help.ts`

### 4.2 Types (authoritative)

**AST**
- `Command`
  - `add`: title, dueDate?, atTime?, tags[], notes?
  - `done`: target
  - `due`: target, dueDate?/atTime? or clear
  - `help`: topic?

**Targets**
- `@selected` (TIT only; CLI will error if used)
- `id:<uuid>`
- optional title match (M1 optional)

**Result**
- `CommandResult`
  - `actions: Action[]` (store actions; see §5)
  - `output: { kind: "ok" | "error"; text: string }`

### 4.3 Parser contract
`parseCommand(input: string) -> { ok:true, command } | { ok:false, error }`

Parser requirements:
- Reject unknown commands with actionable help.
- Enforce `at:` requires `due:`.
- Validate key names and token formats (date/time) early, with clear errors.

### 4.4 Executor contract
`executeCommand(command, ctx) -> CommandResult`

Executor requirements:
- Pure function: no dispatch, no I/O, no time calls other than using `ctx.now`.
- Use existing domain helpers where applicable (`parseDueDate`, `normalizeTag`, `updateTagIndex`).
- Emit only existing store actions in Milestone 1 (see §5).

---

## 5) Store integration (must match existing action union)

### 5.1 Current store reducer action type strings (exact)
```
"load", "recordCompletion", "evaluateEngagement", "triggerEngagementMilestone",
"pushEngagementToast", "tickEngagementToast", "popEngagementToast",
"setSelected", "setFilters", "setEditor", "updateEditor",
"setTasks", "setSavedViews", "setSortMode", "setTagIndex"
```

### 5.2 Command engine emits these actions (Milestone 1)

#### `add`
- `{ type: "setTasks", tasks: Task[] }`
- `{ type: "setTagIndex", tagIndex: Record<string, TagIndexEntry> }`
- `{ type: "setSelected", id: string }`

#### `done`
- `{ type: "setTasks", tasks: Task[] }`
- `{ type: "setSelected", id }`
- `{ type: "recordCompletion", taskId, at, tags }` on `open -> done` only
- `{ type: "evaluateEngagement", at }` on `open -> done` only

#### `due`
- `{ type: "setTasks", tasks: Task[] }`

#### `help`
- No actions.

### 5.3 Command bar UI state (Milestone 1)
- Keep TIT UI state **local to `App.tsx`** (via `useState`) to avoid expanding the store action union in M1:
  - `commandActive: boolean`
  - `commandText: string`
  - `history: string[]`
  - `historyIndex: number | null`
  - `output: {kind,text} | null`

> **Expansion note:** If you later want command state in the store for persistence or cross-component coordination, introduce new action types in a later milestone (not M1).

---

## 6) App.tsx changes (wiring and routing)

### 6.1 Key routing priority (implemented)
Current `useKeyboard` routing for TIT:

1) if `commandActive`, handle only `Esc` / `Enter` / `Up` / `Down`, then return
2) in `LIST` mode, open TIT on backtick (`` ` ``) when views/save overlays are closed
3) otherwise continue existing router/modal/help/search/editor/list handling

### 6.2 Execution pipeline in TIT
On `Enter` when command bar is open:

1) read latest input text from the command input value buffer
2) `parseCommand(commandText)`
2) If parse error:
   - set `output = { kind:"error", text }`
   - keep input intact
3) If parse ok:
   - Build context:
     - `now = Date.now()`
     - `state`
     - `visibleTasks = getVisibleTasks(state, now)`
     - `selectedTaskId = state.selectedId ?? visibleTasks[0]?.id`
   - `result = executeCommand(command, ctx)`
   - `result.actions.forEach(dispatch)`
   - set `output = result.output`
   - push into history
   - clear input (keep command bar open)

### 6.3 UI rendering
Add a bottom overlay in the root `<box>`:

- Visible only when `commandActive === true`
- Contains:
  - output line
  - prompt + input

---

## 7) File-by-file change list (Milestone 1)

### New files
- `src/commands/types.ts` — AST types + `CommandResult`
- `src/commands/parse.ts` — tokenizer + parser
- `src/commands/validate.ts` — date/time validators (leap year, HH:MM)
- `src/commands/help.ts` — help strings for commands
- `src/commands/execute.ts` — translates `Command` into store `Action[]`

### Modified files
- `src/app/App.tsx`
  - Add command bar local state (`useState`)
  - Add key routing: backtick opens, `Esc/Enter/Up/Down` handled while active
  - Add overlay rendering at bottom
  - Integrate parse/execute pipeline and dispatch resulting store actions

### No changes required (Milestone 1)
- `src/state/store.ts` (no new action types required in M1)
- `src/state/persistence.ts` (no new persistence behavior required in M1)

---

## 8) Framework for Milestone 2 (External CLI) — structure baked in

### 8.1 CLI concept
Add a terminal command `tadoi` that can run the same DSL and mutate the same persisted data file, e.g.:
- `tadoi 'add "New task" due:2026-02-28 at:14:30 #work'`
- `tadoi done id:<uuid>`

### 8.2 Required design constraints (supported by M1)
- Command engine lives in `src/commands/*` and has **no UI dependencies**.
- Executor depends only on:
  - current state
  - selected task id (optional)
  - now

### 8.3 Milestone 2 work items (not implemented in M1)
- `src/cli/main.ts`:
  - parse argv → command string
  - `loadState()`
  - `executeCommand(...)`
  - apply resulting `Action[]` to state (either by importing reducer or a small `applyActions` helper)
  - write state back atomically (add a non-debounced save function)
- Concurrency guard:
  - lock file (recommended): if app running, CLI refuses with a clear message

---

## 9) Framework for Milestone 3 (Recurrence) — structure baked in

### 9.1 Data model extension (future)
- Extend `Task` with:
  - `recurrence?: RecurrenceRule`

Minimal `RecurrenceRule` (example):
- `freq: "daily" | "weekly" | "monthly"`
- `interval: number`
- `byDay?: ("mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun")[]`
- `byMonthDay?: number[]`

### 9.2 Command expansion (future)
Introduce command:
- `recur @selected every:week on:mon,wed`
- `recur @selected clear`

### 9.3 Behavioral expansion (future)
When a recurring task transitions `open -> done`:
- create a new task instance with next `dueAt` computed
- keep original instance as completed (audit trail)

**M1 prep benefit:** `done` logic is centralized in the executor, so recurrence behavior can be added without duplicating mutation logic.

---

## 10) QA checklist (Milestone 1)

### 10.1 Parser validation
- `add "Test" #a #b` → ok, tags normalized, de-duped
- `add Test due:2026-02-28` → ok
- `add due:2026-02-28` → error (missing title; suggests quoting)
- `add "X" due:2026-02-29` → error (invalid date; leap-year validation)
- `add "X" at:09:00` → error (at requires due)
- `due @selected clear` → ok
- `due id:<uuid> clear` → ok
- `due @selected 2026-03-05 at:25:00` → error (invalid time)

### 10.2 Executor action emission
- `add` emits: `setTasks`, `setTagIndex`, `setSelected`
- `done` emits: `setTasks`, `setSelected`, and conditional engagement actions on `open -> done`
- `due` emits: `setTasks`, `setSelected`
- `help` emits: none

### 10.3 UI/key routing regressions
- backtick (`` ` ``) opens command bar only in list mode
- While command bar active:
  - `j/k` do not move selection
  - `a/e/d/t` do not trigger actions
  - `Esc` closes command bar
  - `Enter` executes
  - `Up/Down` navigates history
- Output line updates correctly after each execution attempt.

### 10.4 Persistence
- After `add` from TIT, restart → task is present (existing `saveStateDebounced` path)
- No command UI state is persisted (persistence payload remains the existing app contract).

---

## 11) Acceptance criteria (Milestone 1)
- TIT overlay can be opened via backtick (`` ` ``), accepts input, and executes:
  - `add`, `done`, `due`, `help`
- Each command produces a single-line success/error output.
- Added/updated tasks persist via current persistence flow.
- Command engine exists under `src/commands/*` and is reusable for Milestone 2/3.
