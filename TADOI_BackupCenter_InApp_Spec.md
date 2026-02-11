# TADOI™ — In‑App Import/Export + Backup Center (TUI) — Spec Sheet (Codex-ready)

**Repo version context:** v0.3.0 (current runtime baseline)  
**Generated:** 2026-02-10 21:35:46

---

## 1) Objective

Ship a **Backup Center** inside the TUI that makes existing **CLI import/export** discoverable, safe, and guided.

**Key outcomes**
- Users can **export a timestamped backup** without leaving the app.
- Users can **import** a backup via **merge (default)** or **replace (destructive with explicit confirmation)**.
- Users see a **dry-run summary** (added/changed/overwritten counts) before committing an import.
- **No new domain logic**: the TUI reuses the existing CLI pipeline internally.

---

## 2) Scope (v1)

### Entry point
- Help menu item: **`DATA: Backup / Export / Import`**

### Backup Center options (v1)
1. **Export backup (recommended)**
   - Writes timestamped export to a default backup folder
   - Shows the final path in-app
2. **Import**
   - User pastes a path
   - Chooses mode:
     - `merge` (default)
     - `replace` (requires explicit confirmation)
   - Shows **dry-run summary** before commit
3. **Show data path**
   - One-keystroke readout of the live data directory path

---

## 3) Non-goals (v1)

- No new import/export semantics, formats, or schema changes.
- No file picker UI beyond “paste path input”.
- No cloud sync.
- No background jobs beyond a simple progress/status state.

---

## 4) Repo Integration Points (Concrete)

Your tree indicates these primary integration surfaces:

### CLI Entrypoint
- **`bin/tadoi.js`** (packaged CLI launcher)
- **`src/cli/`** (actual CLI command implementation)

### App / TUI Shell
- **`src/index.tsx`** (app boot)
- **`src/app/`** (routing / screen orchestration)
- **`src/ui/`** + **`src/components/`** (views & UI primitives)
- **`src/state/`** (state machine/store)
- **`src/settings/`** (config + persisted settings)
- **`src/domain/`** (domain logic; must not be duplicated)
- **`src/brand/`**, **`src/theme/`** (styling/branding)

### Packaging / Distribution (FYI)
- **`packaging/`**, **`dist/`**, **`scripts/build-binary.ts`**
- This feature must behave consistently when bundled.

---

## 5) Architecture Principle (DoD-critical)

### Zero new domain logic
All export/import work must flow through the same logic used by the CLI today.

**Implementation expectation**
- If CLI logic is currently embedded in command handlers, refactor to a shared service module **called by both CLI and TUI**.

**Recommended module location**
- `src/domain/io/` or `src/domain/backup/`  
  (Pick the pattern you already use for domain services.)

---

## 6) UX / Screen Spec

### 6.1 Help Menu
Add menu item:
- `DATA: Backup / Export / Import`

Selecting opens Backup Center.

---

### 6.2 Backup Center Screen (Menu)

**Title:** `Backup Center`

**Options**
- `1) Export backup (recommended)`
- `2) Import data…`
- `3) Show data path`
- `Esc) Back`

**Keybindings**
- `1/2/3` activate
- `Enter` confirm
- `Esc` back/cancel

---

### 6.3 Flow A — Export backup

**Behavior**
1. Create default backup directory if missing
2. Generate timestamped filename:
   - `tadoi-backup-YYYYMMDD-HHMMSS.<ext>`
3. Call existing export pipeline
4. Show completion view

**Export Completion View**
- `Backup created`
- `Path: <full path>`
- Optional: `Size: <bytes>`
- `[Enter] Done` / `[Esc] Back`

**Default backup directory**
- Prefer whatever the CLI already uses (config/env).
- Otherwise: use the app’s resolved data directory + `/backups`

---

### 6.4 Flow B — Import data (path → mode → dry-run → commit)

#### Step 1: Path input
Prompt:
- `Paste export file path:`

Validation (minimal):
- file exists
- readable
- optional: extension sanity check (or defer to pipeline)

#### Step 2: Mode selection
- `Merge (default)`
- `Replace (destructive)`

#### Step 3: Replace confirmation gate
If Replace:
- Require typed confirmation: `REPLACE`
- Any other input cancels back to mode selection

#### Step 4: Dry-run summary (always before commit)
Show counts returned by pipeline:
- `Added: N`
- `Updated: N`
- `Overwritten: N` (or equivalent semantics from existing logic)
- Optional: `Unchanged: N`
- Optional: warnings/errors list

Actions:
- `[Enter] Commit import`
- `[Esc] Cancel`

#### Step 5: Commit
Run import without dry-run.
Show result view with counts and success/failure.

---

### 6.5 Flow C — Show data path
View:
- Title: `Data location`
- `Path: <resolved data directory>`

Actions:
- `[Enter/Esc] Back`
- Optional v1.1: `[c] Copy` if you already have clipboard utility

---

## 7) Functional Requirements

### 7.1 Export
- Must write a timestamped backup to default folder
- Must display absolute/normalized path
- Must surface errors (permission denied, disk full, invalid path)

### 7.2 Import
- Must support `merge` (default) and `replace`
- Replace requires explicit typed confirmation
- Must show dry-run summary before commit
- Must surface parse/version errors clearly
- Must not introduce new semantics; rely on existing pipeline behavior

### 7.3 Data path
- Must show the exact data directory the app is using at runtime

---

## 8) API / Service Contract (Internal)

Introduce (or standardize) a shared service layer. Proposed interface:

```ts
// Example: src/domain/io/backupService.ts
export type ImportMode = "merge" | "replace";

export type ImportDryRunSummary = {
  added: number;
  updated: number;
  overwritten: number; // or replaced depending on your existing semantics
  unchanged?: number;
  warnings?: string[];
};

export async function exportBackup(opts?: {
  outputDir?: string;     // default resolved
  outputPath?: string;    // if specified, overrides outputDir+filename
  filename?: string;      // optional
}): Promise<{
  outputPath: string;
  bytesWritten?: number;
}>;

export async function importBackup(opts: {
  inputPath: string;
  mode: ImportMode;
  dryRun: boolean;
}): Promise<ImportDryRunSummary>;

export async function getDataPath(): Promise<string>;
```

**Important:** If you already have analogous functions, reuse them and only wrap as needed.

---

## 9) State / UI Wiring (Repo-specific guidance)

Suggested state shape (in `src/state/`):
- `backupCenter: { screen: "menu"|"exporting"|"export_done"|"import_path"|"import_mode"|"import_confirm"|"import_dryrun"|"importing"|"import_done"|"show_path"|"error"; ... }`

Suggested UI components (in `src/ui/` or `src/components/`):
- `BackupCenterScreen`
- `ExportBackupScreen`
- `ImportPathScreen`
- `ImportModeScreen`
- `ReplaceConfirmScreen`
- `DryRunSummaryScreen`
- `ShowDataPathScreen`
- `BackupErrorScreen`

Routing (in `src/app/`):
- Register Backup Center entry
- Connect Help menu item to route open

---

## 10) Error Handling Requirements

Errors must be caught and rendered as a UI state:
- Title: `Operation failed`
- Message: human readable + raw error (single-line)
- Action: `[Enter] Back`

Common errors:
- `ENOENT` file not found
- `EACCES` permission denied
- parse errors / incompatible export version

---

## 11) Definition of Done (DoD)

- Help menu contains **`DATA: Backup / Export / Import`**
- User can:
  1) Export a timestamped backup and see its path
  2) Import via merge or replace
  3) See dry-run summary before commit
  4) Restore from a created backup without leaving the app
  5) View data path from inside the app
- **No new domain semantics**: TUI calls existing CLI pipeline/shared service
- Replace mode includes typed confirmation gate
- Errors are surfaced in-app with actionable messaging

---

## 12) Codex Task List (Implementation Sequence)

1. **Locate** existing CLI import/export implementation under `src/cli/` and identify the core functions.
2. **Refactor** CLI handlers to call a shared domain service:
   - create `src/domain/io/backupService.ts` (or your preferred domain folder)
3. **Add** Help menu item and new route/screen in `src/app/`.
4. **Implement** Backup Center menu UI (in `src/ui/`).
5. **Implement** Export flow UI + call `exportBackup()`.
6. **Implement** Import flow UI:
   - path input
   - mode select
   - replace confirm
   - dry-run summary
   - commit + results
7. **Implement** Show data path view calling `getDataPath()`.
8. **Add** minimal tests (if you have a harness):
   - export filename/path generation
   - import dry-run returns counts
   - replace confirm gate blocks commit without `REPLACE`

---

## 13) Packaging Notes (Repo-specific)

Because you ship binaries (`scripts/build-binary.ts`) and have `dist/install-check`, ensure:
- default backup directory resolves correctly under packaged runtime
- paths are normalized for macOS/windows
- error strings remain readable when bundled

---

*End of spec.*
