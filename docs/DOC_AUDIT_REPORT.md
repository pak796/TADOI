# TADOI™ Documentation Audit Report

Date: 2026-02-21
Scope: full docs consistency audit + offline Notion staging refresh
Baseline: runtime `v0.3.7`, package `0.3.7`, persistence schema 6

## 1) Summary

This pass reconciled active documentation with current implementation and refreshed local Notion staging artifacts (payload/runbook/instructions only).

Primary outcomes:
- Corrected stale schema references (5 -> 6) in active feature/spec docs.
- Corrected stale runtime path references (`src/domain/recurrence/index.ts` -> `src/domain/recurrence.ts`).
- Corrected calendar import CLI exit-code contract in QA documentation.
- Re-ran keybind audit and aligned docs wording to canonical runtime key tokens.
- Refreshed Notion sync docs/payload for staged apply (no remote Notion writes).

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

- Schema drift:
  - `docs/TADOI_Feature_List_v0.3.7.md` now references schema 6.
  - `TADOI_SPEC_v0.3.7.md` internal persistence section now references schema 6.
  - `TADOI_TASKS_v0.3.7.md` now records both schema migrations 4 -> 5 and 5 -> 6.
- Keybind wording drift:
  - `README.md` now documents save-conflict retry key as `r` (canonical runtime token).
- QA contract drift:
  - `docs/TADOI_QA_Guide_v0.3.7.md` `QA-062` now matches `0/2/3/4/5` CLI exit semantics.
- Architecture/test-path drift:
  - `docs/ARCHITECTURE_OVERVIEW.md` updated to current recurrence helper path and existing command-test files.

## 4) Notion Sync Scope and Outputs

Refreshed artifacts:
- `docs/NOTION_SYNC.md`
- `docs/notion/NOTION_SYNC_PAYLOAD.json`
- `docs/notion/NOTION_SYNC_RUNBOOK.md`
- `docs/notion/NOTION_SYNC_INSTRUCTIONS.md`
- `docs/ops/notion_v0.3.7_sync_pack.md`

Sync mode for this pass:
- Local staging only (offline payload/runbook/instruction refresh).
- No Notion API write/apply executed.

## 5) Validation Commands for this Pass

- `bun run contract:dtf:check`
- `bun run keybind:audit`
- `bun run notion:sync:validate`
- `bun run start -- --help`
- `bun run start -- export --help`
- `bun run start -- import --help`
- `bun run start -- calendar:export --help`
- `bun run start -- calendar:import --help`
- `python3 /Users/patrickkazar/.codex/skills/safe-scope-enforcer/scripts/scope_enforcer.py --repo-root . --scope-profile docs-only`

## 6) Known Boundaries

- Historical versioned docs remain intentionally retained for traceability and may describe prior baselines.
- This pass is documentation-only; no runtime/source behavior was changed.

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
