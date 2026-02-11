# Backup Center (In-App)

This document describes the in-app data portability flow available in TADOI.
Runtime baseline: **v0.3.0**.

## Entry Point

- Open Help with `?`
- Press `1` to open `DATA: Backup / Export / Import`

## Menu Options

1. `Export backup (recommended)`
2. `Import data...`
3. `Show data path`

## Export Flow

- Exports through the shared portability pipeline (`src/state/backupService.ts`).
- Uses a timestamped filename:
  - `tadoi-backup-YYYYMMDD-HHMMSS.json`
- Defaults to a `backups/` directory beside the active data file.
- Handles path collisions with `.1`, `.2`, etc.

## Import Flow

1. Enter/paste import file path.
2. Choose mode:
   - `merge` (default, recommended)
   - `replace` (destructive)
3. If mode is `replace`, typed confirmation `REPLACE` is required.
4. Dry-run always executes before commit and displays summary counts.
5. Commit import writes data and creates a pre-import backup by default.

## Safety Guarantees

- No new import/export semantics are introduced.
- Dry-run summary is shown before any write.
- Replace import requires exact typed `REPLACE`.
- Import/export logic is shared between CLI and TUI paths.

## Shared Service and Sources

- Shared service:
  - `src/state/backupService.ts`
- Merge/replace semantics source of truth:
  - `src/state/portability.ts`
- Data-path and backup primitives:
  - `src/state/persistence.ts`
