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
      echo "[build-deb] unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$BINARY_PATH" || -z "$VERSION" ]]; then
  echo "[build-deb] required args: --binary <path> --version <version>" >&2
  exit 1
fi

if [[ ! -f "$BINARY_PATH" ]]; then
  echo "[build-deb] binary not found: $BINARY_PATH" >&2
  exit 1
fi

if ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "[build-deb] dpkg-deb not found." >&2
  echo "[build-deb] install hint: Debian/Ubuntu -> sudo apt-get install -y dpkg-dev" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG_DIR="$TMP_DIR/tadoi_${VERSION}_amd64"
mkdir -p "$PKG_DIR/DEBIAN" "$PKG_DIR/usr/bin"

install -m 755 "$BINARY_PATH" "$PKG_DIR/usr/bin/tadoi"
bun "$REPO_ROOT/scripts/install-completions.ts" \
  --layout linux-system \
  --dest-root "$PKG_DIR" \
  --strict

cat > "$PKG_DIR/DEBIAN/control" <<CONTROL
Package: tadoi
Version: $VERSION
Section: utils
Priority: optional
Architecture: amd64
Maintainer: TADOI Team <support@example.com>
Description: TADOI terminal task manager
 A keyboard-first TUI todo application built with Bun and OpenTUI.
CONTROL

OUT_PATH="$OUT_DIR/tadoi_${VERSION}_amd64.deb"
dpkg-deb --build "$PKG_DIR" "$OUT_PATH" >/dev/null

echo "[build-deb] wrote: $OUT_PATH"
