#!/usr/bin/env bash
set -euo pipefail

BINARY_PATH=""
VERSION=""
OUT_DIR="dist/installers"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --binary)
      BINARY_PATH="${2:-}"
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
      echo "[build-appimage] unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$BINARY_PATH" || -z "$VERSION" ]]; then
  echo "[build-appimage] required args: --binary <path> --version <version>" >&2
  exit 1
fi

if [[ ! -f "$BINARY_PATH" ]]; then
  echo "[build-appimage] binary not found: $BINARY_PATH" >&2
  exit 1
fi

if ! command -v appimagetool >/dev/null 2>&1; then
  echo "[build-appimage] appimagetool not found." >&2
  echo "[build-appimage] install hint: download AppImageKit appimagetool and put it on PATH." >&2
  echo "[build-appimage] CI hint: wrap the AppImage binary with APPIMAGE_EXTRACT_AND_RUN=1." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="$TMP_DIR/TADOI.AppDir"
mkdir -p "$APP_DIR/usr/bin"

install -m 755 "$BINARY_PATH" "$APP_DIR/usr/bin/tadoi"
bun "$REPO_ROOT/scripts/install-completions.ts" \
  --layout linux-system \
  --dest-root "$APP_DIR" \
  --strict

cat > "$APP_DIR/tadoi.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=TADOI
Exec=tadoi
Icon=tadoi
Categories=Utility;
Terminal=true
DESKTOP

cat > "$APP_DIR/AppRun" <<'APPRUN'
#!/usr/bin/env bash
exec "$(dirname "$0")/usr/bin/tadoi" "$@"
APPRUN
chmod +x "$APP_DIR/AppRun"

printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Zq2kAAAAASUVORK5CYII=' | base64 --decode > "$APP_DIR/tadoi.png"

OUT_PATH="$OUT_DIR/tadoi-$VERSION-x86_64.AppImage"
appimagetool "$APP_DIR" "$OUT_PATH" >/dev/null

echo "[build-appimage] wrote: $OUT_PATH"
