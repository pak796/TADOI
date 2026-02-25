# App Flow Module Map

## Purpose
This document maps `src/app/App.tsx` flow handlers to their module owners after the refactor and records rollback-safe commit boundaries.

## Rollback Boundaries

1. `cd8b1fc` - `refactor(app): extract editor flow module`
2. `9823ade` - `refactor(app): extract modal orchestration`
3. `12ab5f8` - `refactor(app): extract calendar flow orchestration`
4. `718907b` - `refactor(app): cleanup flow wiring and remove dead helpers`

## Ownership Map

| Previous `App.tsx` flow area | Module owner |
|---|---|
| Task editor switch + row click (`requestEditTargetSwitch`, `handleModalSaveAndSwitchEditTarget`, `handleModalDiscardAndSwitchEditTarget`, `handleModalDiscardAndCloseEditor`, `handleTaskRowClick`) | `src/app/editorFlow.ts` |
| Editor lifecycle (`openAdd`, `startEditSession`, `buildEditDraftForRow`, `openEditForRow`, `openEditForRowId`, `openEditSeries`, `openEdit`, `openDuplicate`, `cancelEditor`, `updateEditorDraft`, `saveEditor`) | `src/app/editorFlow.ts` |
| Esc unwind + modal orchestration (`applyEscUnwind`, unsaved modal flow, backup final-checkpoint flow, recurring-delete-future checkpoint flow) | `src/app/modalOrchestration.ts` |
| Modal action wrappers (`confirmDeleteSelectedFromModal`, `confirmDeleteSelectedAndFutureFromModal`, `cancelDeleteSelectedFromModal`, empty NUX handlers, overdue modal handlers) | `src/app/modalOrchestration.ts` |
| Calendar export/import runners (`runCalendarExportFromBackupCenter`, `runCalendarImportDryRunFromBackupCenter`, `runCalendarImportCommitFromBackupCenter`) | `src/app/calendarFlow.ts` |
| Calendar menu/digit/primary routing (`handleCalendarMenuSelect`, calendar branches of backup digit + primary actions) | `src/app/calendarFlow.ts` |
| Calendar timezone hint refresh (`refreshCalendarTimeZoneHint` + local helper) | `src/app/calendarFlow.ts` |
| Action router switch location (`runRoutedAction`) | Stays in `src/app/App.tsx` |

## App Wiring Anchors

- `editorFlow` wiring: `src/app/App.tsx` (`useEditorFlow(...)`)
- `modalFlow` wiring: `src/app/App.tsx` (`useModalOrchestration(...)`)
- `calendarFlow` wiring: `src/app/App.tsx` (`useCalendarFlow(...)`)

## Reviewer Notes

- Refactor goal was behavior parity only; no UX or routing contract changes.
- Calendar flow extraction intentionally leaves non-calendar backup flow in `App.tsx`.
- `runRoutedAction` remains in `App.tsx` and delegates to module-owned handlers.
