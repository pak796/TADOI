# TADOI™ Release Checklist

Verified as of 2026-03-04 (v0.4.0).

This checklist is required before daily build smoke tests and any tagged release.

## 1) Dependencies
- [ ] `bun install`
- [ ] `bun --version` matches `package.json` requirement
- [ ] `bun run preflight:host:docs`
- [ ] `bun run preflight:host:release`

## 2) Quality Gates
- [ ] `bun run test`
- [ ] `bun run typecheck`
- [ ] `bun run brand:check`
- [ ] `bun run contract:dtf:check`
- [ ] `bun run keybind:canonical:check`

## 3) Packaging Validation
- [ ] `bun run pack:dry`
- [ ] `bun run pack:inspect`
- [ ] `bun run pack:smoke`

## 4) Binary + Installer Build
- [ ] `bun scripts/build-binary.ts --target <host> --format raw --mode build`
- [ ] `bun scripts/build-binary.ts --target <host> --format installer --mode build`

## 5) Daily Build Output
- [ ] `bun run build:daily`
- [ ] Verify `dist/artifacts/YYYY-MM-DD/BUILD_REPORT.md` exists
- [ ] Verify artifacts exist for host platform

## 6) Smoke Validation
- [ ] Run `docs/QA/SMOKE_TEST_CHECKLIST.md` on each platform
- [ ] Run TITS command-layer smoke cases (`QA-065`, `QA-066`, `QA-068`, `QA-071`)
- [ ] No P0/P1 defects

## 7) Release Notes
- [ ] Update `CHANGELOG.md` (root) or the release notes document
- [ ] Record any behavior changes to mode boundaries or recurrence

## 8) Notion Sync Staging (Local-Only)
- [x] `bun run notion:sync:validate`
- [x] `docs/notion/NOTION_SYNC_PAYLOAD.json` reflects current `source_file` markdown
- [x] Staged for deferred apply on `2026-03-04` (no remote Notion write in this pass)

## 9) Final Review
- [ ] Ensure docs and QA guides match current behavior
- [ ] Confirm no unrelated feature work is bundled
