# TADOI Documentation Audit Report

Date: 2026-02-27
Scope: full documentation alignment sweep (repo docs + spec sheets + Notion staging package)
Baseline: runtime `v0.3.8`, package `0.3.8`, persistence schema `7`

## 1) Summary

This pass reconciled active documentation with current implementation and staged a fresh Notion deployment package (local payload only, no remote apply).

Primary outcomes:
- Updated active docs to current schema baseline (`7`) and current contract evidence.
- Normalized spec/task drift by adding `DTF-008` and `DTF-009` to the active v0.3.8 spec contract table.
- Refreshed governance docs (`DOC_INDEX`, audit inventory/ownership maps, release run report, Notion sync checklists/runbooks).
- Regenerated `docs/notion/NOTION_SYNC_PAYLOAD.json` markdown from mapped source files and produced a new verification artifact (`docs/notion/NOTION_SYNC_VERIFY_2026-02-27.json`).

## 2) Canonical TITS Source Set (filename rule `*TITS*.md`)

Detected and reconciled sources:
- `docs/specs/tits-m1-commandbar.md`
- `docs/specs/tits-m2-cli.md`
- `docs/specs/tits-m3-recurrence.md`
- `tadoi_TITS_milestone1_spec.md`
- `tits-m2-cli-revised.md`
- `tits-m3-recurrence.md`

Code evidence references used in this sweep:
- `src/app/App.tsx`
- `src/app/keyRouter.ts`
- `src/commands/parse.ts`
- `src/commands/execute.ts`
- `src/commands/help.ts`
- `src/cli/main.ts`
- `src/domain/savedViews.ts`
- `src/domain/query.ts`
- `src/state/migrations.ts`

## 3) High-Value Drift Corrected

- Baseline/version drift:
  - `README.md`, `TADOI_SPEC_v0.3.8.md`, `TADOI_TASKS_v0.3.8.md`, and release governance docs now align to current v0.3.8 implementation state.
- Contract drift:
  - Active spec table now includes `DTF-008`/`DTF-009` and points to current named tests.
- Schema drift:
  - Active docs now reflect persistence schema `7` (including `6 -> 7` `workflowStage` backfill context).
- Notion staging drift:
  - Sync checklists/runbooks and sync-pack docs now point to current audit token/date and verification artifact.

## 4) Notion Sync Scope and Outputs

No Notion write/apply was executed in this pass.

Generated/staged artifacts:
- `docs/notion/NOTION_SYNC_PAYLOAD.json`
- `docs/notion/NOTION_SYNC_VERIFY_2026-02-27.json`
- `docs/ops/notion_v0.3.8_sync_pack.md`
- `docs/NOTION_SYNC.md`
- `docs/notion/NOTION_SYNC_RUNBOOK.md`
- `docs/notion/NOTION_SYNC_INSTRUCTIONS.md`

## 5) Validation Commands in This Pass

- `bun run docs:lint` -> PASS
- `bun run contract:dtf:check` -> PASS
- `bun run notion:sync:validate` -> PASS
- `bun run keybind:canonical:check` -> BLOCKED in this host environment (`python3` unavailable until Xcode license acceptance via `xcodebuild -license`)

## 6) Known Boundaries

- Historical versioned docs remain intentionally retained for traceability and may describe prior baselines.
- This pass is documentation-only; no runtime/source behavior was changed.
- Keybind audit regeneration is pending host prerequisite (Xcode license acceptance).

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
