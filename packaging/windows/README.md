# Windows Packaging

Scripts in this directory build installable Windows artifacts for the TADOI CLI.

## Files
- `TADOI.iss`: Inno Setup definition (`Program Files\\TADOI`, adds user PATH)
- `build-installer.ps1`: compiles setup EXE with `iscc`
- `sign.ps1`: optional Authenticode signing (skips when env vars are absent)

## Required tools
- Inno Setup compiler (`iscc`)

## Optional signing env vars
- `TADOI_WIN_SIGN_CERT_PATH`
- `TADOI_WIN_SIGN_CERT_PASSWORD`
