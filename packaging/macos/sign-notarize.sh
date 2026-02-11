#!/usr/bin/env bash
set -euo pipefail

PKG_PATH=""
DMG_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pkg)
      PKG_PATH="${2:-}"
      shift 2
      ;;
    --dmg)
      DMG_PATH="${2:-}"
      shift 2
      ;;
    *)
      echo "[sign-notarize] unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PKG_PATH" ]]; then
  echo "[sign-notarize] required arg: --pkg <path>" >&2
  exit 1
fi

if [[ ! -f "$PKG_PATH" ]]; then
  echo "[sign-notarize] pkg not found: $PKG_PATH" >&2
  exit 1
fi

SIGN_IDENTITY="${TADOI_MAC_SIGN_IDENTITY_INSTALLER:-}"
NOTARY_PROFILE="${TADOI_MAC_NOTARY_PROFILE:-}"

if [[ -z "$SIGN_IDENTITY" || -z "$NOTARY_PROFILE" ]]; then
  echo "[sign-notarize] signing/notarization env vars not set; skipping"
  echo "[sign-notarize] expected: TADOI_MAC_SIGN_IDENTITY_INSTALLER, TADOI_MAC_NOTARY_PROFILE"
  exit 0
fi

if ! command -v productsign >/dev/null 2>&1 || ! command -v xcrun >/dev/null 2>&1; then
  echo "[sign-notarize] required tools missing (productsign/xcrun)" >&2
  exit 1
fi

SIGNED_PKG="${PKG_PATH%.pkg}-signed.pkg"

productsign --sign "$SIGN_IDENTITY" "$PKG_PATH" "$SIGNED_PKG"
mv "$SIGNED_PKG" "$PKG_PATH"

xcrun notarytool submit "$PKG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
xcrun stapler staple "$PKG_PATH"

echo "[sign-notarize] notarized pkg: $PKG_PATH"

if [[ -n "$DMG_PATH" && -f "$DMG_PATH" ]]; then
  xcrun notarytool submit "$DMG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$DMG_PATH"
  echo "[sign-notarize] notarized dmg: $DMG_PATH"
fi
