# TADOI™ Documentation Audit Report

Date: 2026-02-25
Scope: full docs consistency sweep for latest refactors + theme/settings changes
Baseline: runtime `v0.3.7`, package `0.3.7`, persistence schema 6

## 1) Summary

This pass reconciled active documentation with current implementation after latest app-flow refactors and theme/settings updates.

Primary outcomes:
- Updated theme/settings docs for new theme IDs (`crtGreen`, `crtAmber`) and CRT FX controls (`CRT FX Lite`, `CRT FX Profile`).
- Corrected Help-mode settings behavior docs: settings changes now documented through Help settings pages (not direct single-key toggles in Help root).
- Updated QA coverage for CRT FX persistence/normalization and theme rotation expectations.
- Updated architecture/refactor docs to reflect extracted flow/helper modules (`editorFlow`, `modalOrchestration`, `calendarFlow`, `backupCalendarOrchestration`, `renderingComposition`, `routingContinuations`, `notificationRuntime`).

## 2) Canonical TITS Source Set (filename rule `*TITS*.md`)

Detected and reconciled sources:
- `docs/specs/tits-m1-commandbar.md`
- `docs/specs/tits-m2-cli.md`
- `docs/specs/tits-m3-recurrence.md`
- `tadoi_TITS_milestone1_spec.md`
- `tits-m2-cli-revised.md`
- `tits-m3-recurrence.md`

Code evidence used for reconciliation:
- `src/app/App.tsx` (TITS open/close/execute/history routing)
- `src/commands/parse.ts`
- `src/commands/execute.ts`
- `src/commands/help.ts`
- `src/cli/main.ts`
- `src/domain/recurrence.ts`
- `src/commands/parse.test.ts`
- `src/commands/execute.test.ts`
- `src/cli/main.test.ts`

## 3) High-Value Drift Fixed

- Theme/settings contract drift:
  - `README.md`, `docs/USAGE.md`, and the platform installation guide now match Help settings navigation and CRT FX behavior.
- Feature/spec/task drift:
  - `docs/TADOI_Feature_List_v0.3.7.md`, `TADOI_SPEC_v0.3.7.md`, and `TADOI_TASKS_v0.3.7.md` now reflect CRT themes, CRT FX settings, and current settings persistence semantics.
- QA drift:
  - `docs/TADOI_QA_Guide_v0.3.7.md` now validates CRT FX persistence/normalization and updated theme rotation expectations.
- Refactor documentation drift:
  - `docs/ARCHITECTURE_OVERVIEW.md` and `docs/app-flow-module-map.md` now match current module ownership and latest refactor commit boundaries.

## 4) Notion Sync Scope and Outputs

No Notion write/apply was executed in this pass.

## 5) Validation Commands for this Pass

- `bun run contract:dtf:check`
- `bun run keybind:audit`
- `bun test src/theme/readmeThemeIdsContract.test.ts src/settings/settings.test.ts src/components/CrtFxLite.test.ts src/theme/themes.test.ts`
- `python3 /Users/patrickkazar/.codex/skills/spec-task-drift-guard/scripts/doc_drift_scan.py ...`
- `python3 /Users/patrickkazar/.codex/skills/safe-scope-enforcer/scripts/scope_enforcer.py ...`

## 6) Known Boundaries

- Historical versioned docs remain intentionally retained for traceability and may describe prior baselines.
- This pass is documentation-only; no runtime/source behavior was changed.

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
