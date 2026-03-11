#!/usr/bin/env bash
set -euo pipefail

PKG_PATH=""
VERSION=""
OUT_DIR="dist/installers"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pkg)
      PKG_PATH="${2:-}"
      shift 2
      ;;
    --version)
      VERSION="${2:-}"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    *)
      echo "[build-dmg] unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PKG_PATH" || -z "$VERSION" ]]; then
  echo "[build-dmg] required args: --pkg <path> --version <version>" >&2
  exit 1
fi

if [[ ! -f "$PKG_PATH" ]]; then
  echo "[build-dmg] pkg not found: $PKG_PATH" >&2
  exit 1
fi

if ! command -v hdiutil >/dev/null 2>&1; then
  echo "[build-dmg] hdiutil is required on macOS" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

STAGE_DIR="$TMP_DIR/dmg-root"
mkdir -p "$STAGE_DIR"

PKG_NAME="TADOI-$VERSION.pkg"
cp "$PKG_PATH" "$STAGE_DIR/$PKG_NAME"

cat > "$STAGE_DIR/README.txt" <<README
TADOI $VERSION

Install:
1) Open $PKG_NAME
2) Complete installer prompts
3) Run: tadoi

Uninstall:
1) Run: tadoi uninstall
2) Follow the printed main-install removal step
3) Manual fallback for PKG installs:
   sudo rm -f /usr/local/bin/tadoi

Note: The CLI cleanup keeps user data/config. The remaining main-install removal step depends on how TADOI was installed.
README

DMG_PATH="$OUT_DIR/TADOI-macOS-$VERSION.dmg"
rm -f "$DMG_PATH"
TMP_DMG_PATH="$TMP_DIR/TADOI-macOS-$VERSION.dmg"
rm -f "$TMP_DMG_PATH"

hdiutil create \
  -volname "TADOI $VERSION" \
  -srcfolder "$STAGE_DIR" \
  -ov \
  -format UDZO \
  "$TMP_DMG_PATH" >/dev/null

mv "$TMP_DMG_PATH" "$DMG_PATH"

echo "[build-dmg] wrote: $DMG_PATH"
