#!/usr/bin/env bash
# Regenerates every FrameTV brand asset from the sources in this folder.
#
#   mark.svg        full app icon (≥48px uses)
#   mark-small.svg  simplified mark for favicons / browser tabs
#   og.html         1200×630 social card
#
# Needs: rsvg-convert + magick (brew install librsvg imagemagick) and
# Google Chrome (for og.html — it loads Syne/DM Sans from Google Fonts).
#
# Usage: brand/generate.sh   (from anywhere)
set -euo pipefail

BRAND="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$BRAND")"
APP="$ROOT/src/app"
PUB="$ROOT/public"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

png() { rsvg-convert -w "$2" -h "$2" "$1" -o "$3"; }

# Full-bleed square variant (no rounded tile) — iOS and Android apply their
# own mask, so transparent rounded corners would show as black/white fringes.
python3 - "$BRAND/mark.svg" "$TMP/mark-bleed.svg" "$TMP/mark-maskable.svg" <<'PY'
import sys, re
src = open(sys.argv[1]).read()
tile = re.search(r'<rect width="512" height="512" rx="116" fill="url\(#tile\)"/>', src).group(0)
bleed = src.replace(tile, '<rect width="512" height="512" fill="url(#tile)"/>')
open(sys.argv[2], 'w').write(bleed)
# Maskable: artwork scaled into the 80% safe zone on a full-bleed tile
head, body = bleed.split('<rect width="512" height="512" fill="url(#tile)"/>')
body = body.replace('</svg>', '')
maskable = (head + '<rect width="512" height="512" fill="url(#tile)"/>'
            + '<g transform="translate(51.2 51.2) scale(0.8)">' + body + '</g></svg>')
open(sys.argv[3], 'w').write(maskable)
PY

# Favicon (.ico, 16/32/48) from the simplified mark
for s in 16 32 48; do png "$BRAND/mark-small.svg" $s "$TMP/fav-$s.png"; done
magick "$TMP/fav-16.png" "$TMP/fav-32.png" "$TMP/fav-48.png" "$APP/favicon.ico"

# SVG icon for modern browsers' tabs
cp "$BRAND/mark-small.svg" "$APP/icon.svg"

# Apple touch icon (180, full-bleed)
png "$TMP/mark-bleed.svg" 180 "$APP/apple-icon.png"

# PWA / manifest icons
png "$BRAND/mark.svg" 192 "$PUB/icon-192.png"
png "$BRAND/mark.svg" 512 "$PUB/icon-512.png"
png "$TMP/mark-maskable.svg" 512 "$PUB/icon-maskable-512.png"

# Mark for in-app UI (headers, loading screens)
mkdir -p "$PUB/brand"
cp "$BRAND/mark.svg" "$PUB/brand/mark.svg"

# Social card (Open Graph + Twitter share the same image)
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --virtual-time-budget=8000 \
  --screenshot="$TMP/og.png" "file://$BRAND/og.html" >/dev/null 2>&1
# JPEG: the grain texture makes PNG ~1 MB; this is ~100 KB and indistinguishable
magick "$TMP/og.png" -strip -sampling-factor 4:4:4 -quality 88 "$APP/opengraph-image.jpg"
cp "$APP/opengraph-image.jpg" "$APP/twitter-image.jpg"

echo "Brand assets written to src/app and public/"
