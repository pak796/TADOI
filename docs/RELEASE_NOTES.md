# TADOI™ Release Notes

Current release baseline: `v0.4.0-beta.2` (`package.json`: `0.4.0-beta.2`).

Primary changelog lives at `CHANGELOG.md` in the repo root.

## Latest Notes (v0.4.0-beta.2)
- Version: `v0.4.0-beta.2`
- Date: `2026-03-11`
- Release scope:
  - Light beta-2 repack for the new CLI uninstall flow.
  - Runtime/package surfaces now align to `v0.4.0-beta.2` / `0.4.0-beta.2`.
  - Existing active document filenames remain on the `v0.4.0` file set for this pass.
  - Fresh tarball and macOS installer artifacts were regenerated for the beta-2 release label.
- Beta validation focus:
  - CLI uninstall runtime/help/completion cleanup path.
  - Package/tarball integrity for `0.4.0-beta.2`.
  - macOS binary, PKG, DMG, and installer manifest generation.
- Validation snapshot:
  - `bun run preflight:host:release`: PASS
  - `bun run test`: PASS
  - `bun run docs:lint`: PASS
  - `bun run typecheck`: PASS
  - `bun run brand:check`: PASS
  - `bun run contract:dtf:check`: PASS
  - `bun run keybind:canonical:check`: PASS
  - `bun run pack:dry`: PASS
  - `bun run pack:inspect`: PASS
  - `bun run pack:smoke`: PASS
  - `bun run build:installer:mac:all`: PASS
  - `bun run installer:gate -- --target macos`: PASS
  - `bun run installer:smoke -- --target macos --scope all`: PASS
  - `bun run build:daily`: PASS
- Known issues:
  - Installer signing/notarization was skipped because `TADOI_MAC_SIGN_IDENTITY_INSTALLER` and `TADOI_MAC_NOTARY_PROFILE` are not set in this local pass.
  - Windows/Linux native installers were not produced on the macOS host; `build:daily` emitted plan artifacts for those targets only.
