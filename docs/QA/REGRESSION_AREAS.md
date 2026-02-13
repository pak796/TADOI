# TADOI™ Regression Areas

Verified as of 2026-02-13 (v0.3.6).

High-severity regression surfaces to re-check after every change.

## Mode Boundaries
- LIST/ADD/EDIT/SEARCH/HELP/BACKUP_CENTER/TAG_FILTER/DASHBOARD/MODAL_CONFIRM boundaries
- Esc/Enter contracts and modal semantics

## Recurrence Semantics
- Complete occurrence: `EXDATE` + done history
- Skip occurrence: `EXDATE` + remove matching override
- Snooze occurrence: `EXDATE` + open override due `+1 day`
- Delete occurrence modal: `y` this event, `f` this+future, `n`/`Esc` cancel
- `E` edits series, not single occurrence

## Backup/Import Safety
- Pre-import backup on commit flows
- Replace flow typed confirmation `REPLACE`
- Dry-run before destructive import commit
- Calendar import commit gated behind dry-run

## Dashboard/List Parity
- Dashboard widgets and KPIs match filtered list dataset
- Tag filter, search, status filters propagate to dashboard

## Key Routing
- Help/search modal keys do not leak into list actions
- List nav keys do not leak into text input modes
- Details links focus remains isolated from list navigation

## Data Safety
- Data path resolution per OS
- Corrupt backup suffixing and recovery handling

## Notifications
- Overdue modal respects routing (`s`/`d`/`g`/`Esc`)
- Bell cooldown and banner suppression behavior
