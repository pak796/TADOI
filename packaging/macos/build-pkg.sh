#!/usr/bin/env bash
set -euo pipefail

BINARY_PATH=""
VERSION=""
IDENTIFIER="com.tadoi.cli"
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
    --identifier)
      IDENTIFIER="${2:-}"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    *)
      echo "[build-pkg] unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$BINARY_PATH" || -z "$VERSION" ]]; then
  echo "[build-pkg] required args: --binary <path> --version <version>" >&2
  exit 1
fi

if [[ ! -f "$BINARY_PATH" ]]; then
  echo "[build-pkg] binary not found: $BINARY_PATH" >&2
  exit 1
fi

if ! command -v pkgbuild >/dev/null 2>&1 || ! command -v productbuild >/dev/null 2>&1; then
  echo "[build-pkg] pkgbuild/productbuild are required (install Xcode command line tools)" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PAYLOAD_ROOT="$TMP_DIR/payload"
mkdir -p "$PAYLOAD_ROOT/usr/local/bin"
install -m 755 "$BINARY_PATH" "$PAYLOAD_ROOT/usr/local/bin/tadoi"
bun "$REPO_ROOT/scripts/install-completions.ts" \
  --layout macos-system \
  --dest-root "$PAYLOAD_ROOT" \
  --strict

COMPONENT_PKG="$TMP_DIR/TADOI-component.pkg"
FINAL_PKG="$OUT_DIR/TADOI-$VERSION.pkg"

pkgbuild \
  --root "$PAYLOAD_ROOT" \
  --identifier "$IDENTIFIER" \
  --version "$VERSION" \
  --install-location "/" \
  "$COMPONENT_PKG"

productbuild \
  --package "$COMPONENT_PKG" \
  "$FINAL_PKG"

echo "[build-pkg] wrote: $FINAL_PKG"
