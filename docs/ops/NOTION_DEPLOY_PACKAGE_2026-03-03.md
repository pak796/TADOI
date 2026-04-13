# TADOI Notion Deploy Package (2026-03-03)

Prepared after Notion MCP apply (remote write executed in this pass).

## Baseline

- Runtime: `v0.3.9`
- Package: `0.3.9`
- Persistence schema: `8`
- Audit token: `[AUDIT 2026-03-03] Full docs pass + implementation/spec drift reconciliation applied via MCP`

## Package Artifacts

- `docs/notion/NOTION_SYNC_PAYLOAD.json`
- `docs/notion/NOTION_SYNC_VERIFY_2026-03-03.json`
- `docs/NOTION_SYNC.md`
- `docs/notion/NOTION_SYNC_RUNBOOK.md`
- `docs/notion/NOTION_SYNC_INSTRUCTIONS.md`
- `docs/ops/notion_v0.3.9_sync_pack.md`

## Validation Snapshot

- `python3 /Users/patrickkazar/.codex/skills/safe-scope-enforcer/scripts/scope_enforcer.py --repo-root . --scope-profile custom --allow-glob 'docs/**' --allow-glob 'README.md' --allow-glob 'TADOI_*.md' --allow-glob 'tadoi_*.md' --allow-glob 'tits-*.md' --allow-glob 'DASHBOARD_SPEC_MVP.md'` -> PASS (`Scope check passed for 20 changed file(s).`)
- `bun run docs:lint` -> PASS (`[SUMMARY] profile=docs PASS=6 FAIL=0 BLOCKED=0 overall=PASS`; `[docs-lint] PASS`)
- `bun run notion:sync:validate` -> PASS (`[sync] validation OK: items=14`)
- Notion MCP apply -> PASS (`14/14 mapped pages updated and read back`)
- `python3 /Users/patrickkazar/.codex/skills/spec-task-drift-guard/scripts/doc_drift_scan.py ... --code-glob 'packaging/**/*' --code-glob 'docs/**/*' ...` -> PASS (`Total=1738, Missing evidence=43`; remaining high/medium misses are historical audit references only)

## Apply Steps (repeat run)

1. Run `bun run notion:sync:validate`.
2. Ensure MCP auth is active: `bun run notion:mcp:login`.
3. Apply per-page MCP updates from payload (`replace_content` + property updates).
4. Record run evidence in `docs/notion/NOTION_SYNC_VERIFY_<date>.json`.
