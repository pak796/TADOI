# TADOI™ Release Run Report

Date: 2026-02-27
Version: 0.3.8

## Requested Sweep Status
- `DTF-008/DTF-009 test-name remediation + release-doc evidence refresh + focused drift rescan`: PASS

## Docs Contract Gate
- `bun run contract:dtf:check`: PASS
  - Output: `OK: 9 DTF IDs from DASHBOARD_SPEC_MVP.md, TADOI_SPEC_v0.3.8.md are covered by named test cases in 100 test files.`

## Docs Lint Gate
- `bun run docs:lint`: PASS
  - Output: `[docs-lint] PASS: local markdown links and anchors resolved.`

## Keybind Gate
- `bun run keybind:canonical:check`: PASS
  - Output: `canonical=64 missing_in_docs=0 missing_in_code=0`
  - Output: `[keybind-doc] PASS: docs/KEYBINDS_CANONICAL.md is up to date.`

## Notion Payload Gate
- `bun run notion:sync:validate`: PASS
  - Output: `[sync] validation OK: items=14`

## Focused Drift Scan
- Command:
  - `python3 /Users/patrickkazar/.codex/skills/spec-task-drift-guard/scripts/doc_drift_scan.py --repo-root . --doc-glob CHANGELOG.md --doc-glob README.md --doc-glob TADOI_SPEC_v0.3.8.md --doc-glob TADOI_TASKS_v0.3.8.md --doc-glob docs/README.md --doc-glob docs/RELEASE_CHECKLIST.md --doc-glob docs/RELEASE_NOTES.md --doc-glob docs/RELEASE_RUN_REPORT.md --doc-glob docs/TADOI_Feature_List_v0.3.8.md --doc-glob docs/TADOI_QA_Guide_v0.3.8.md --doc-glob docs/ops/notion_v0.3.8_sync_pack.md --code-glob src/**/* --code-glob scripts/**/* --code-glob package.json --code-glob tsconfig*.json --code-glob bin/**/* --code-glob docs/**/*.md --code-glob CHANGELOG.md --code-glob README.md --code-glob TADOI_*.md --code-glob .github/**/* --code-glob packaging/**/* --out-json /tmp/doc_drift_active_2026-02-27_post.json --out-md /tmp/doc_drift_active_2026-02-27_post.md`
- Result: PASS (`total=341`, `verified=341`, `missing_evidence=0`, `unverified=0`)

## Scope Guard
- `safe-scope-enforcer (custom test+docs allowlist)`: PASS

## Notes
- This report captures documentation + contract-alignment verification only.
- No release build, installer generation, or Notion remote apply was executed in this pass.
