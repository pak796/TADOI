# macOS Packaging (Planned)

This folder documents the future macOS installer track for TADOI.

## Scope in current phase
- Scaffold only.
- No `.dmg` artifact is produced yet.

## Planned outputs
- Raw binary under `dist/bin/macos/`
- Signed and notarized DMG under `dist/installers/`

## Future prerequisites
- Apple Developer certificate for signing.
- Notarization credentials and CI secret management.
- A deterministic build script that emits universal or per-arch binaries.

## Notes
Use `bun run build:bin:mac` during scaffold phase to generate planning artifacts only.
