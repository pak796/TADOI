# TADOI™ macOS Packaging

Scripts in this directory build installable macOS artifacts for the TADOI CLI.

## Scripts
- `build-pkg.sh`: creates `TADOI-<version>.pkg` that installs `/usr/local/bin/tadoi`
- `sign-notarize.sh`: optional signing/notarization (skips when env vars are absent)
- `build-dmg.sh`: creates `TADOI-macOS-<version>.dmg` containing the PKG + README

## Required tools
- `pkgbuild`
- `productbuild`
- `hdiutil`

## Optional signing env vars
- `TADOI_MAC_SIGN_IDENTITY_INSTALLER`
- `TADOI_MAC_NOTARY_PROFILE`
