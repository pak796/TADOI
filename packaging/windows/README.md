# Windows Packaging (Planned)

This folder documents the future Windows installer track for TADOI.

## Scope in current phase
- Scaffold only.
- No `.exe` or `.msi` artifact is produced yet.

## Planned outputs
- Raw binary under `dist/bin/windows/`
- Signed installer under `dist/installers/`

## Future prerequisites
- Code-signing certificate for Windows executables.
- Installer toolchain decision (`.exe` or `.msi`).
- CI secret management for signing credentials.

## Notes
Use `bun run build:bin:win` during scaffold phase to generate planning artifacts only.
