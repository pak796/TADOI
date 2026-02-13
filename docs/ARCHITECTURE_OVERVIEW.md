# TADOI™ Architecture Overview

Verified as of 2026-02-13 (v0.3.6).

This is a high-level map for orientation. Source code is the authority.

## Core App
- UI entry: `src/app/App.tsx`
- Key routing: `src/app/keyRouter.ts`
- UI state + mode boundaries: `src/app/uiState.ts`, `src/ui/state.ts`, `src/ui/modeFocus.ts`

## Domain Logic
- Domain rules: `src/domain/*`
- Recurrence engine: `src/domain/recurrence/*`
- Tags and filters: `src/domain/tagFilter.ts`, `src/domain/tagStats.ts`

## State + Persistence
- Store: `src/state/store.ts`
- Persistence: `src/state/persistence.ts`
- Migrations: `src/state/migrations.ts`
- Backup Center flows: `src/state/backupCenterFlow.ts`, `src/state/backupService.ts`

## CLI + Portability
- CLI entry: `src/cli.ts`
- Calendar commands: `src/cli/calendarCommands.ts`
- Import/export: `src/commands/import.ts`, `src/commands/export.ts`

## Packaging + Build
- Binary build: `scripts/build-binary.ts`
- Packaging scripts: `packaging/*`
- Daily build orchestrator: `scripts/build-daily.ts`

## Tests
- Key routing and invariants: `src/app/keyRouter.test.ts`, `src/app/keybindingContract.test.ts`
- Domain and state tests: `src/domain/*.test.ts`, `src/state/*.test.ts`

## Documentation
- Product spec: `TADOI_SPEC_v0.3.6.md`
- Task list: `TADOI_TASKS_v0.3.6.md`
- QA guide: `docs/TADOI_QA_Guide_v0.3.6.md`
- Usage + install: `docs/USAGE.md`, `docs/INSTALL.md`
