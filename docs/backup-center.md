# TADOI™ Backup Center (In-App)

This document describes the in-app data portability flow available in TADOI.
Runtime baseline: **v0.4.0**.

## Entry Point

- Open Help with `?`
- Press `1` to open `DATA: Backup / Export / Import`

## Menu Options

1. `Export backup (recommended)`
2. `Import data...`
3. `Show data path`
4. `Calendar (ICS)...`

Calendar submenu:
1. `Export Calendar (.ics)`
2. `Import Calendar (.ics)`
3. `Cloud Backups -> GitHub (CLI)`
4. `Back`

## Export Flow

- Exports through the shared portability pipeline (`src/state/backupService.ts`).
- Uses a timestamped filename:
  - `tadoi-backup-YYYYMMDD-HHMMSS.json`
- Defaults to a `backups/` directory beside the active data file.
- Handles path collisions with `.1`, `.2`, etc.

## Import Flow

1. Open `Import data...` to launch the backup picker.
2. Backup Center scans the default backup directory (`backups/` beside the active data file), auto-creates it if needed, and lists recognized files:
   - `tadoi-backup-YYYYMMDD-HHMMSS(.N).json`
   - Sorted newest to oldest by file modified time.
3. Select a file with keyboard navigation (`↑/↓`, `PgUp/PgDn`, `Home/End`) and press `Enter`.
   - `m` opens manual path fallback (`import_path`) if needed.
4. Choose mode:
   - `merge` (default, recommended)
   - `replace` (destructive)
5. If mode is `replace`, typed confirmation `REPLACE` is required.
6. Dry-run always executes before commit and displays summary counts.
7. Commit import writes data and creates a pre-import backup by default.

## Calendar Export Flow (.ics)

1. Intro explains one-way export behavior and timezone context.
2. Choose range:
   - `next7` (default)
   - `month`
   - `all`
3. Choose optional saved view filter (same semantics as list/dashboard visibility path).
4. Choose privacy:
   - `minimal` (default)
   - `full`
5. Choose output path (blank uses timestamped path under backups folder).
6. Confirm and export.

Output summary includes event counts, recurring series count, instance override count, and EXDATE count.

## Calendar Import Flow (.ics)

1. Intro explains round-trip identity and merge-default behavior.
2. Enter input path.
3. Choose range (`next7` default, `month`, `all`).
4. Choose optional saved view filter.
5. Choose mode:
   - `merge` (default)
   - `update`
   - `create`
6. Set horizon days (default `365`, max `3650`).
7. Optional tag for newly created tasks.
8. Mandatory dry-run.
9. Commit (blocked until dry-run is valid and error-free).

Safety:
- Dry-run is mandatory before commit.
- Pre-import backup of `tadoi_data.json` is created before calendar commit.
- RRULE validity/horizon/hard-cap safeguards remain enforced by the calendar import service.
- High-impact imports (`mode=update` or `range=all`) require typed `IMPORT` confirmation.
- Non-fatal warnings (for example report-write failures after successful processing) are shown in dry-run/commit summaries and do not block commit by themselves.

## Cloud Backups: GitHub (CLI)

Scope (v1):
- Optional flow under Backup Center only (no background live sync).
- Personal repository only (`owner/repo` owner must match active `gh` account).
- Uses GitHub CLI auth state from `gh`; no PAT/token storage in TADOI settings.

Status panel shows:
- `gh` detected / logged-in state
- active account username
- configured repo (`owner/repo`)
- auto-push policy value (`off` default in v1)
- last push timestamp
- last restore-pull timestamp

### Connect flow

1. Open `Cloud Backups -> GitHub (CLI)`.
2. Choose:
   - create private repo (default name `tadoi-backups`), or
   - use existing `owner/repo`.
3. Existing repo path validates:
   - owner matches active `gh` username (personal-only gate),
   - repo privacy check (public requires explicit typed `PUBLIC` confirmation).
4. Saves non-secret config only (`ownerRepo`, `branch`, `deviceId`, `pathPrefix`, policy, push metadata).
5. If connected repo is public, Backup Center shows an explicit warning in the GitHub status panel.

### Push snapshot now

- Push creates restore-grade artifacts in remote repo:
  - timestamped `*.state.json`
  - timestamped `*.settings.json`
  - timestamped `*.manifest.json`
  - coherent `latest/state.json`, `latest/settings.json`, `latest/manifest.json`
- Path layout:
  - `/<pathPrefix>/snapshots/YYYY/MM/<timestamp>.state.json`
  - `/<pathPrefix>/snapshots/YYYY/MM/<timestamp>.settings.json`
  - `/<pathPrefix>/snapshots/YYYY/MM/<timestamp>.manifest.json`
  - `/<pathPrefix>/latest/*`
- Push skips when unchanged (same `stateRevision` + settings hash as last push).

### Restore from GitHub

1. List snapshots newest-first from remote manifests.
2. Select snapshot and download state/settings/manifest into local staging.
3. Build staged import payload and route into the existing JSON import path.
4. Existing safety gates remain unchanged:
   - mandatory dry-run
   - summary review
   - commit path with pre-import backup + atomic/lock-safe write behavior.

## Safety Guarantees

- No new import/export semantics are introduced.
- Dry-run summary is shown before any write.
- Replace import requires exact typed `REPLACE`.
- Import/export logic is shared between CLI and TUI paths.

## CLI Parity

Calendar flows are available through CLI and in-app Backup Center:
- `calendar:export`
- `calendar:import`

Import exit codes:
- `0`: success
- `1`: usage/validation/parse/import-domain errors
- `2`: filesystem errors

## Shared Service and Sources

- Shared service:
  - `src/state/backupService.ts`
- Calendar shared services:
  - `src/state/calendarExportService.ts`
  - `src/state/calendarImportService.ts`
- Backup Center calendar controller:
  - `src/state/backupCenterCalendarController.ts`
- Merge/replace semantics source of truth:
  - `src/state/portability.ts`
- Data-path and backup primitives:
  - `src/state/persistence.ts`
