# TADOI Notion Deploy Package (2026-02-27)

Prepared for deferred Notion apply (no remote write executed in this pass).

## Baseline
- Runtime: `v0.3.8`
- Package: `0.3.8`
- Persistence schema: `7`
- Audit token: `[AUDIT 2026-02-27] Full docs sweep + Notion payload refresh staged for deferred apply`

## Package Artifacts
- `docs/notion/NOTION_SYNC_PAYLOAD.json`
- `docs/notion/NOTION_SYNC_VERIFY_2026-02-27.json`
- `docs/NOTION_SYNC.md`
- `docs/notion/NOTION_SYNC_RUNBOOK.md`
- `docs/notion/NOTION_SYNC_INSTRUCTIONS.md`
- `docs/ops/notion_v0.3.8_sync_pack.md`

## Validation Snapshot
- `bun run docs:lint` -> PASS
- `bun run contract:dtf:check` -> PASS (`OK: 9 DTF IDs ... in 107 test files.`)
- `bun run notion:sync:validate` -> PASS (`items=14`)
- `bun run keybind:canonical:check` -> BLOCKED in this host (`python3` unavailable until `xcodebuild -license` acceptance)

## Apply Steps (when Notion auth is provided)
1. Export auth token environment variable from `docs/notion/NOTION_SYNC_CONFIG.template.json` (`NOTION_TOKEN` by default).
2. Run `bun run notion:sync:validate`.
3. Optional dry run with token present: `bun run notion:sync:full:dry`.
4. Apply: `bun run notion:sync:full`.
5. Record run evidence in a new `docs/notion/NOTION_SYNC_VERIFY_<date>.json`.
