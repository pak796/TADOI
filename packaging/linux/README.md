# Linux Packaging

Scripts in this directory build Linux installer artifacts for the TADOI CLI.

## Scripts
- `build-deb.sh`: builds `tadoi_<version>_amd64.deb` (requires `dpkg-deb`)
- `build-appimage.sh`: builds `tadoi-<version>-x86_64.AppImage` when `appimagetool` exists

If AppImage tooling is not installed, `build-appimage.sh` logs a planned/skip message and exits successfully.
