# TADOI™ Architecture Overview

Verified as of 2026-02-27 (v0.4.0).

This is a high-level map for orientation. Source code is the authority.

## Core App
- UI entry: `src/app/App.tsx`
- Key routing: `src/app/keyRouter.ts`
- UI state + mode boundaries: `src/app/uiState.ts`, `src/ui/state.ts`, `src/ui/modeFocus.ts`
- App flow modules:
  - `src/app/editorFlow.ts`
  - `src/app/modalOrchestration.ts`
  - `src/app/calendarFlow.ts`
  - `src/app/backupCalendarOrchestration.ts`
  - `src/app/renderingComposition.ts`
  - `src/app/routingContinuations.ts`
  - `src/app/notificationRuntime.ts`

## Theme + Settings Runtime
- Theme registry + rotation: `src/theme/themes.ts`
- Runtime token resolution: `src/app/theme.ts`
- CRT FX tint/flicker resolver: `src/components/CrtFxLite.tsx`
- Settings model/load/save normalization: `src/settings/settings.ts`
- Settings reducer runtime state: `src/state/settingsStore.ts`

## TITS Command Layer (M1-M3)
- In-app TITS overlay and execution bridge: `src/app/App.tsx`
- Shared parser/executor/help: `src/commands/parse.ts`, `src/commands/execute.ts`, `src/commands/help.ts`
- CLI command runtime: `src/cli/main.ts`
- Recurrence completion helper used by TITS and non-TITS completion paths: `src/domain/recurrence.ts`

## Domain Logic
- Domain rules: `src/domain/*`
- Recurrence engine: `src/domain/recurrence/*`
- Tags and filters: `src/domain/tagFilter.ts`, `src/domain/tagStats.ts`

## State + Persistence
- Store: `src/state/store.ts`
- Persistence: `src/state/persistence.ts`
- Migrations: `src/state/migrations.ts`
- Backup Center flows: `src/state/backupCenterFlow.ts`, `src/state/backupService.ts`
- Locking (CLI/TUI coordination): `src/state/lockfile.ts`

## CLI + Portability
- CLI entry: `src/cli.ts`
- TITS CLI command path: `src/cli/main.ts`
- Calendar commands: `src/cli/calendarCommands.ts`
- Import/export: `src/commands/import.ts`, `src/commands/export.ts`

## Packaging + Build
- Binary build: `scripts/build-binary.ts`
- Packaging scripts: `packaging/*`
- Daily build orchestrator: `scripts/build-daily.ts`

## Tests
- Key routing and invariants: `src/app/keyRouter.test.ts`, `src/app/keybindingContract.test.ts`
- TITS command layer: `src/commands/parse.test.ts`, `src/commands/execute.test.ts`, `src/commands/calendarImport.test.ts`, `src/commands/calendarExport.test.ts`, `src/cli/main.test.ts`
- Theme/settings + CRT FX: `src/theme/themes.test.ts`, `src/settings/settings.test.ts`, `src/components/CrtFxLite.test.ts`
- Domain and state tests: `src/domain/*.test.ts`, `src/state/*.test.ts`

## Documentation
- Product spec: `TADOI_SPEC_v0.4.0.md`
- Task list: `TADOI_TASKS_v0.4.0.md`
- QA guide: `docs/TADOI_QA_Guide_v0.4.0.md`
- Usage + install: `docs/USAGE.md`, concise install guide
- TITS specs: `docs/specs/tits-m1-commandbar.md`, `docs/specs/tits-m2-cli.md`, `docs/specs/tits-m3-recurrence.md`
- App refactor map: `docs/app-flow-module-map.md`
