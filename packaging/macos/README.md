# TADOI™ macOS Packaging

Scripts in this directory build installable macOS artifacts for the TADOI CLI.

## Scripts
- `build-pkg.sh`: creates `TADOI-<version>.pkg` that installs `/usr/local/bin/tadoi`
- `sign-notarize.sh`: optional signing/notarization (skips when env vars are absent)
- `build-dmg.sh`: creates `TADOI-macOS-<version>.dmg` containing the PKG + README

PKG payload now includes shell completion files via `scripts/install-completions.ts`:
- Bash: `/usr/local/share/bash-completion/completions/tadoi`
- Zsh: `/usr/local/share/zsh/site-functions/_tadoi`
- Fish: `/usr/local/share/fish/vendor_completions.d/tadoi.fish`

Expected install flow:
1. Open `TADOI-macOS-<version>.dmg`.
2. Run `TADOI-<version>.pkg`.
3. Open a new terminal and run `tadoi --version`.

## Required tools
- `pkgbuild`
- `productbuild`
- `hdiutil`

## Optional signing env vars
- `TADOI_MAC_SIGN_IDENTITY_INSTALLER`
- `TADOI_MAC_NOTARY_PROFILE`

## Quick build command
- `bun run build:installer:mac:all`
