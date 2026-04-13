# App Flow Module Map

## Purpose

This document maps `src/app/App.tsx` flow handlers to their module owners after the refactor and records rollback-safe commit boundaries.

## Rollback Boundaries

1. `cd8b1fc` - `refactor(app): extract editor flow module`
2. `9823ade` - `refactor(app): extract modal orchestration`
3. `12ab5f8` - `refactor(app): extract calendar flow orchestration`
4. `ae32898` - `refactor(app): cleanup flow wiring and add handoff map`

## Ownership Map

| Previous `App.tsx` flow area                                                                                                                                                                                     | Module owner                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Task editor switch + row click (`requestEditTargetSwitch`, `handleModalSaveAndSwitchEditTarget`, `handleModalDiscardAndSwitchEditTarget`, `handleModalDiscardAndCloseEditor`, `handleTaskRowClick`)              | `src/app/editorFlow.ts`                  |
| Editor lifecycle (`openAdd`, `startEditSession`, `buildEditDraftForRow`, `openEditForRow`, `openEditForRowId`, `openEditSeries`, `openEdit`, `openDuplicate`, `cancelEditor`, `updateEditorDraft`, `saveEditor`) | `src/app/editorFlow.ts`                  |
| Esc unwind + modal orchestration (`applyEscUnwind`, unsaved modal flow, backup final-checkpoint flow, recurring-delete-future checkpoint flow)                                                                   | `src/app/modalOrchestration.ts`          |
| Modal action wrappers (`confirmDeleteSelectedFromModal`, `confirmDeleteSelectedAndFutureFromModal`, `cancelDeleteSelectedFromModal`, empty NUX handlers, overdue modal handlers)                                 | `src/app/modalOrchestration.ts`          |
| Calendar export/import runners (`runCalendarExportFromBackupCenter`, `runCalendarImportDryRunFromBackupCenter`, `runCalendarImportCommitFromBackupCenter`)                                                       | `src/app/calendarFlow.ts`                |
| Calendar menu/digit/primary routing (`handleCalendarMenuSelect`, calendar branches of backup digit + primary actions)                                                                                            | `src/app/calendarFlow.ts`                |
| Calendar timezone hint refresh (`refreshCalendarTimeZoneHint` + local helper)                                                                                                                                    | `src/app/calendarFlow.ts`                |
| Backup replace-impact confirmation helper (`shouldRequireBackupReplaceConfirmation`)                                                                                                                             | `src/app/backupCalendarOrchestration.ts` |
| Help panel/ticker/render helpers (`fitLineToWidth`, `truncateToWidth`, ticker segment builders)                                                                                                                  | `src/app/renderingComposition.ts`        |
| Left-rail continuation labeling (`describeTaskEditorContinuation`, `resolveTaskEditorContinuationForLeftRail`)                                                                                                   | `src/app/routingContinuations.ts`        |
| Notification runtime toggles/cooldown helpers (`isInAppOverdueEnabled`, `isTerminalBellOverdueEnabled`, `getTerminalBellCooldownMs`)                                                                             | `src/app/notificationRuntime.ts`         |
| Notes runtime state, note service lifecycle, note CRUD/follow/save/root handlers                                                                                                                                | `src/app/notesRuntime.ts`                |
| Help/settings runtime state, theme-editor drafts, help nav stack, settings input handlers                                                                                                                       | `src/app/helpSettingsRuntime.ts`         |
| Reminder/notification runtime state, modal queue promotion, helper polling, overdue evaluation                                                                                                                  | `src/app/reminderNotificationRuntime.ts` |
| Pure layout/selectors for notes/detail panes and viewport math                                                                                                                                                  | `src/app/appSelectors.ts`                |
| Action router switch location (`runRoutedAction`)                                                                                                                                                                | Stays in `src/app/App.tsx`               |

## App Wiring Anchors

- `editorFlow` wiring: `src/app/App.tsx` (`useEditorFlow(...)`)
- `modalFlow` wiring: `src/app/App.tsx` (`useModalOrchestration(...)`)
- `calendarFlow` wiring: `src/app/App.tsx` (`useCalendarFlow(...)`)
- `backupCalendarOrchestration` wiring: `src/app/App.tsx` (`shouldRequireBackupReplaceConfirmation(...)`)
- `renderingComposition` wiring: `src/app/App.tsx` (help/ticker rendering helpers)
- `routingContinuations` wiring: `src/app/App.tsx` (left-rail continuation copy)
- `notificationRuntime` wiring: `src/app/App.tsx` (notification enabled/cooldown policy reads)
- `notesRuntime` wiring: `src/app/App.tsx` (`useNotesRuntime(...)`)
- `helpSettingsRuntime` wiring: `src/app/App.tsx` (`useHelpSettingsRuntime(...)`)
- `reminderNotificationRuntime` wiring: `src/app/App.tsx` (`useReminderNotificationRuntime(...)`)
- `appSelectors` wiring: `src/app/App.tsx` (pure derived selector/layout reads)

## Reviewer Notes

- Refactor goal was behavior parity only; no UX or routing contract changes.
- `App.tsx` remains the composition root, but notes/help/reminder runtime state now lives behind dedicated hook controllers.
- Large state modules now keep stable top-level import paths while delegating internally:
  `src/state/backupCenterFlow.ts`, `src/state/calendarImportService.ts`, `src/notes/commands.ts`, `src/settings/settings.ts`, and `src/state/persistence.ts` are facades.
- Calendar flow extraction intentionally leaves key-router contracts and top-level routed action dispatch in `App.tsx`.
- `runRoutedAction` remains in `App.tsx` and delegates to module-owned handlers.
