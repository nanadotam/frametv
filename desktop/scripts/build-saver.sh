#!/usr/bin/env bash
# Builds Mantel.saver (universal, ad-hoc signed) into desktop/saver/ so
# electron-builder can bundle it into the app, plus the app icon + DMG art.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(dirname "$HERE")"
PROJ="$ROOT/macos-screensaver/FrameTVScreenSaver"
OUT="$HERE/saver"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Building Mantel.saver"
xcodebuild -project "$PROJ/FrameTVScreenSaver.xcodeproj" -scheme FrameTVScreenSaver -configuration Release \
  archive -archivePath "$TMP/saver.xcarchive" \
  CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=YES ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO > "$TMP/build.log" 2>&1 \
  || { tail -40 "$TMP/build.log"; exit 1; }
rm -rf "$OUT" && mkdir -p "$OUT"
cp -R "$(find "$TMP/saver.xcarchive" -name 'Mantel.saver' -type d | head -1)" "$OUT/"
echo "  $(du -sh "$OUT/Mantel.saver" | cut -f1) Mantel.saver"

echo "→ App icon"
ICONSET="$TMP/icon.iconset"; mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  rsvg-convert -w $s -h $s "$ROOT/brand/mark.svg" -o "$ICONSET/icon_${s}x${s}.png"
  rsvg-convert -w $((s*2)) -h $((s*2)) "$ROOT/brand/mark.svg" -o "$ICONSET/icon_${s}x${s}@2x.png"
done
iconutil -c icns "$ICONSET" -o "$HERE/build/icon.icns"

echo "→ DMG background"
rsvg-convert -w 1200 -h 800 "$HERE/build/dmg-background.svg" -o "$HERE/build/dmg-background@2x.png"
rsvg-convert -w 600 -h 400 "$HERE/build/dmg-background.svg" -o "$HERE/build/dmg-background.png"
echo "Done."
