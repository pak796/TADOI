# TADOI™ Release Run Report

Date: 2026-02-13
Version: 0.3.6

## Requested Sweep Status
- `build:daily + docs drift + keybind audit`: PASS

## Daily Build Gate
- `bun run build:daily`: PASS
  - Output: report written at `dist/artifacts/2026-02-13/BUILD_REPORT.md`
  - Host artifacts: macOS raw binary + PKG + DMG
  - Non-host artifacts: Windows/Linux plan files emitted (cross-build not executed on macOS host)

## Docs Drift Gate
- `bun run contract:dtf:check`: PASS
  - Output: `OK: 7 DTF IDs ... are covered by named test cases`

## Keybind Gate
- `bun run keybind:audit`: PASS
  - Output: `canonical=58 missing_in_docs=0 missing_in_code=0`

## Blocked Scope (if requiring native 3-platform binaries in one run)
- BLOCKED on host constraints:
  - Windows and Linux binary/installer outputs are scaffold plans on macOS host.
  - Required for full-native 3-platform binary readiness: run the same command on Windows and Linux CI runners.

## Notes
- Signing/notarization skipped (env vars not set), expected for baseline daily smoke builds.
