# TADOI™ Release Run Report

Date: 2026-03-11
Version: 0.4.0-beta.2

## Requested Sweep Status
- `light repack + re-release with CLI uninstall as 0.4.0-beta.2`: PASS

## Host Preflight
- `bun run preflight:host:release`: PASS
  - Output: `[SUMMARY] profile=release PASS=9 FAIL=0 BLOCKED=0 overall=PASS`

## Quality Gates
- `bun run test`: PASS
  - Output: `test-sharded completed all 4 shards; rerun finished with exit 0 after an earlier transient Bun crash.`
- `bun run typecheck`: PASS
  - Output: `tsc --noEmit -p tsconfig.typecheck.json`
- `bun run brand:check`: PASS
  - Output: `Branding check passed.`
- `bun run contract:dtf:check`: PASS
  - Output: `OK: 9 DTF IDs from DASHBOARD_SPEC_MVP.md, TADOI_SPEC_v0.4.0.md are covered by named test cases in 140 test files.`
- `bun run docs:lint`: PASS
  - Output: `[docs-lint] PASS: local markdown links and anchors resolved.`
- `bun run keybind:canonical:check`: PASS
  - Output: `canonical=70 missing_in_docs=0 missing_in_code=0`

## Packaging Validation
- `bun run pack:dry`: PASS
  - Output: `dist/tarball/tadoi-0.4.0-beta.2.tgz`
- `bun run pack:inspect`: PASS
  - Output: `filename: tadoi-0.4.0-beta.2.tgz`
- `bun run pack:smoke`: PASS
  - Output: `tarball install and CLI help check passed`

## Binary + Installer Build
- `bun run build:installer:mac:all`: PASS
  - Output: `TADOI-0.4.0-beta.2.pkg`, `TADOI-macOS-0.4.0-beta.2.dmg`, `TADOI-macos-0.4.0-beta.2-manifest.json`
- `bun run installer:gate -- --target macos`: PASS
  - Output: `[installer:gate] OK (macos)`
- `bun run installer:smoke -- --target macos --scope all`: PASS
  - Output: `[installer:smoke] OK (macos): binary runtime and installer artifact checks passed.`

## Daily Build Output
- `bun run build:daily`: PASS
  - Output: `dist/artifacts/2026-03-11/BUILD_REPORT.md`
- macOS binary artifact:
  - `dist/artifacts/2026-03-11/macos/tadoi`
  - `sha256=d5e472f13a636f7d18a842bd31c32a022046ada2d213c15af519c0742d60fd95`
- macOS PKG artifact:
  - `dist/artifacts/2026-03-11/macos/TADOI-0.4.0-beta.2.pkg`
  - `sha256=451dad20ea945884de56c6a13994c66a80c0f876e0e91703cf472a6b7704b93a`
- macOS DMG artifact:
  - `dist/artifacts/2026-03-11/macos/TADOI-macOS-0.4.0-beta.2.dmg`
  - `sha256=e5adb7231d5f5ef17420e64d442712bbbe27aafe35e67409ef86bef8f6aa75f1`

## Scope Guard
- `safe-scope-enforcer (release docs/code allowlist)`: PASS

## Notes
- The first `bun run release:rc:check` attempt hit a transient Bun `v1.3.9` segmentation fault during the test phase. A direct rerun of `bun run test` completed successfully, and all required release gates passed when rerun individually.
- `installer:smoke` and `build:daily` required escalated execution because `hdiutil` DMG mount/create operations are blocked inside the default sandbox.
- macOS signing/notarization was skipped because `TADOI_MAC_SIGN_IDENTITY_INSTALLER` and `TADOI_MAC_NOTARY_PROFILE` are not set in this local environment.
- Windows/Linux native installers were not built from this macOS host; the daily build emitted plan files for those targets.
