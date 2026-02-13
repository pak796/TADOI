# TADOI™ Linux Packaging

Scripts in this directory build Linux installer artifacts for the TADOI CLI.

## Scripts
- `build-deb.sh`: builds `tadoi_<version>_amd64.deb` (requires `dpkg-deb`)
- `build-appimage.sh`: builds `tadoi-<version>-x86_64.AppImage` (requires `appimagetool`)

Both scripts are strict and fail fast when required tooling is missing.

## Required tools
- `dpkg-deb` (`dpkg-dev` on Debian/Ubuntu)
- `appimagetool` (AppImageKit)

CI note: AppImage runs through a wrapper that sets `APPIMAGE_EXTRACT_AND_RUN=1`.
