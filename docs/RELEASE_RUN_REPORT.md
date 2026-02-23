# TADOI™ Release Run Report

Date: 2026-02-21
Version: 0.3.7

## Requested Sweep Status
- `docs audit + docs drift + keybind audit + notion payload validate`: PASS

## Docs Drift Gate
- `bun run contract:dtf:check`: PASS
  - Output: `OK: 7 DTF IDs from DASHBOARD_SPEC_MVP.md, TADOI_SPEC_v0.3.7.md are covered by named test cases in 86 test files.`

## Keybind Gate
- `bun run keybind:audit`: PASS
  - Output: `canonical=60 missing_in_docs=0 missing_in_code=0`

## Notion Payload Gate
- `bun run notion:sync:validate`: PASS
  - Output: `[sync] validation OK: items=14`

## CLI Contract Spot-Checks
- `bun run start -- --help`: PASS
- `bun run start -- export --help`: PASS
- `bun run start -- import --help`: PASS
- `bun run start -- calendar:export --help`: PASS
- `bun run start -- calendar:import --help`: PASS

## Scope Guard
- `safe-scope-enforcer (docs-only)`: PASS

## Notes
- This report captures documentation/runbook staging verification only.
- No release build, installer generation, or Notion remote apply was executed in this pass.
