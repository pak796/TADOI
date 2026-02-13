# TADOI™ Black Box Test Matrix

Verified as of 2026-02-13 (v0.3.6).

Focus: user-visible behavior with no code inspection.

| Area | Scenario | Expected Result |
|---|---|---|
| Launch | Start at `>=104x24` | App renders list mode without guard |
| Layout guard | Resize below minimum | Guard appears and blocks interaction |
| Add/Edit | Add task and edit fields | Data persists after save |
| Search | `/` then search | Filtered list; exit via `Enter`/`Esc` |
| Filters | Cycle status/due/tag filters | List updates; dashboard parity preserved |
| Dashboard | Toggle dashboard and apply top tag | Tag filter updated; list matches dashboard |
| Recurrence | Create recurring task, complete/skip/snooze | Occurrence rules applied correctly |
| Delete modal | Delete occurrence | `y` this, `f` this+future, `n`/`Esc` cancel |
| Backup Center | Export backup | File created in expected location |
| Import | Import with dry-run | Dry-run runs first; commit gated |
| Calendar | Export/Import ICS | Files created; import summary shown |
| Settings | Toggle theme/flash/notifications | Settings persist across restart |
| Links | Add link, open, copy, delete | Actions route to correct target |
| Exit | `q` in LIST | Clean shutdown |
