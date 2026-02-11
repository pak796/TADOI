# TADOI™ Recurring Tasks Implementation Plan (Implemented)

## Summary
Recurring tasks are implemented with RRULE-style series metadata and sparse materialization.
The app keeps one series task in storage, renders virtual occurrences for list/dashboard/query windows, and materializes occurrence rows only when an occurrence needs independent state.
This implementation is part of the `v0.3.0` runtime baseline.

## Locked Decisions
- Internal recurrence format: `dtstart + rrule + exdates + series_id`.
- Sparse materialization: virtual rows by default, materialized rows for complete/skip/snooze/edit-occurrence.
- Local floating ISO timestamps are used for recurrence `dtstart` and `exdates`.
- `due=any`: one actionable occurrence per series (latest overdue else next upcoming).
- `due=overdue`: one latest overdue occurrence per series.
- Monthly day-31 behavior: months without that day are skipped.
- Snooze default: `+1 day` preserving local wall-clock time.
- `e` edits occurrence row context; `E` edits whole series.

## File Map
- Domain
  - `src/domain/models.ts`: recurrence and instance types on `Task`, recurrence fields on `EditorDraft`.
  - `src/domain/recurrence/rruleAdapter.ts`: RRULE parse/format/build adapter.
  - `src/domain/recurrence/engine.ts`: occurrence expansion and overdue/next occurrence helpers.
  - `src/domain/recurrence/draft.ts`: recurrence draft-to-payload builder, preview, summary text.
  - `src/domain/taskRows.ts`: recurrence-aware visible row selector and row metadata.
- App/UI
  - `src/app/App.tsx`: selector integration, recurrence actions, occurrence/series edit flows.
  - `src/app/keyRouter.ts`: recurrence key actions (`x`, `z`, `E`).
  - `src/components/TaskList.tsx`: recurring row indicator.
  - `src/components/DetailsPane.tsx`: recurrence summary + occurrence context/hints.
  - `src/components/EditorPane.tsx`: repeat controls + next-3 preview.
  - `src/ui/modeFocus.ts`, `src/app/uiState.ts`: recurrence focus targets and tab order.
- Persistence/compat
  - `src/state/persistence.ts`: schema version `4`.
  - `src/state/migrations.ts`: `v3 -> v4` recurrence normalization/backfill.
  - `src/state/validation.ts`: strict recurrence/instance validation rules.
  - `src/state/portability.ts`: recurrence-aware task equivalence in merge logic.

## Behavior Semantics
- Complete recurring occurrence:
  - Exclude occurrence via `exdates` on series.
  - Create/update materialized done instance row for history.
- Skip recurring occurrence:
  - Exclude occurrence via `exdates`.
  - Remove matching materialized instance row if one exists.
- Snooze recurring occurrence:
  - Exclude original occurrence via `exdates`.
  - Create/update open materialized instance due `+1 day`.
- Edit occurrence:
  - Edits materialized instance row (create on save if missing).
  - Original occurrence remains excluded via `exdates`.
- Edit series:
  - Updates series task fields and recurrence rule.
  - Existing materialized instances remain intact.

## Test Coverage
- Recurrence engine tests: weekly BYDAY, monthly day-31, EXDATE, DST, next-occurrence continuity.
- Selector tests: due-window policies and materialized suppression behavior.
- Key routing tests: recurrence action keys.
- Persistence tests: migration, validation, portability with recurrence fields.

## Notes
- Persistence format remains JSON; schema evolves from v3 to v4.
- Non-recurring task flows remain unchanged and are covered by full test suite regression.
