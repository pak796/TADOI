# TADOI Notion Deploy Package (2026-03-04)

Prepared for deferred Notion apply (no remote write executed in this pass).

## Baseline
- Runtime: `v0.4.0`
- Package: `0.4.0`
- Persistence schema: `8`
- Audit token: `[AUDIT 2026-03-04] v0.4.0 beta docs/version roll-forward staged (local-only)`

## Package Artifacts
- `docs/notion/NOTION_SYNC_PAYLOAD.json`
- `docs/notion/NOTION_SYNC_VERIFY_2026-03-04.json`
- `docs/NOTION_SYNC.md`
- `docs/notion/NOTION_SYNC_RUNBOOK.md`
- `docs/notion/NOTION_SYNC_INSTRUCTIONS.md`
- `docs/ops/notion_v0.4.0_sync_pack.md`

## Validation Snapshot
- `python3 /Users/patrickkazar/.codex/skills/safe-scope-enforcer/scripts/scope_enforcer.py --repo-root . --scope-profile custom --allow-glob 'docs/**' --allow-glob 'src/**' --allow-glob 'scripts/**' --allow-glob 'README.md' --allow-glob 'CHANGELOG.md' --allow-glob 'package.json' --allow-glob 'TADOI_SPEC_v0.4.0.md' --allow-glob 'TADOI_TASKS_v0.4.0.md' --allow-glob 'stats_log.md'` -> PASS (`Scope check passed for 39 changed file(s).`)
- `bun run docs:lint` -> PASS (`[SUMMARY] profile=docs PASS=6 FAIL=0 BLOCKED=0 overall=PASS`; `[docs-lint] PASS`)
- `bun run notion:sync:validate` -> PASS (`[sync] validation OK: items=14`)
- `bun test scripts/check-dtf-contract-drift.test.ts` -> PASS (`8 pass / 0 fail`)
- `bun test scripts/keybind-sync-audit.test.ts` -> PASS (`5 pass / 0 fail`)
- `bun test /Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI/src/app/keybindingContract.test.ts` -> PASS (`5 pass / 0 fail`)
- `bun test src/backup/githubCli.test.ts` -> PASS (`12 pass / 0 fail`)
- `bun run typecheck` -> PASS (`tsc --noEmit -p tsconfig.typecheck.json`)

## Apply Steps (Deferred)
1. Run `bun run notion:sync:validate`.
2. Ensure MCP auth is active: `bun run notion:mcp:login`.
3. Apply per-page MCP updates from payload (`replace_content` + property updates).
4. Record run evidence in `docs/notion/NOTION_SYNC_VERIFY_<date>.json`.
