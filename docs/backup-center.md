# TADOI™ Backup Center (In-App)

This document describes the in-app data portability flow available in TADOI.
Runtime baseline: **v0.3.4**.

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
3. `Back`

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

## Safety Guarantees

- No new import/export semantics are introduced.
- Dry-run summary is shown before any write.
- Replace import requires exact typed `REPLACE`.
- Import/export logic is shared between CLI and TUI paths.

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
