# TADOI Notion Deploy Package (2026-03-03)

Prepared for deferred Notion apply (no remote write executed in this pass).

## Baseline
- Runtime: `v0.3.9`
- Package: `0.3.9`
- Persistence schema: `8`
- Audit token: `[AUDIT 2026-03-03] Full docs pass + implementation/spec drift reconciliation staged for deferred apply`

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
- `bun run notion:sync:full:dry` -> BLOCKED (`Missing Notion token. Set NOTION_TOKEN and retry.`)
- `python3 /Users/patrickkazar/.codex/skills/spec-task-drift-guard/scripts/doc_drift_scan.py ... --code-glob 'packaging/**/*' --code-glob 'docs/**/*' ...` -> PASS (`Total=1738, Missing evidence=43`; remaining high/medium misses are historical audit references only)

## Apply Steps (when Notion auth is provided)
1. Export auth token environment variable from `docs/notion/NOTION_SYNC_CONFIG.template.json` (`NOTION_TOKEN` by default).
2. Run `bun run notion:sync:validate`.
3. Optional dry run with token present: `bun run notion:sync:full:dry`.
4. Apply: `bun run notion:sync:full`.
5. Record run evidence in a new `docs/notion/NOTION_SYNC_VERIFY_<date>.json`.
