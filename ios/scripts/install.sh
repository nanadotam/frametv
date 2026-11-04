#!/usr/bin/env bash
# Build Mantel and install it on a connected iPhone/iPad.
#   ios/scripts/install.sh            → first paired device that's available
#   ios/scripts/install.sh <udid>     → a specific one (xcrun devicectl list devices)
# Needs: Xcode signed in to your Apple ID (Xcode → Settings → Accounts) and `brew install xcodegen`.
# Free Apple ID: the install works for 7 days, then run this again.
# The phone needs Developer Mode on (Settings → Privacy & Security → Developer Mode).
set -euo pipefail
cd "$(dirname "$0")/.."
xcodegen generate --quiet
DEVICE="${1:-$(xcrun devicectl list devices 2>/dev/null | awk '/available \(paired\)/ && /physical/ {for(i=1;i<=NF;i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) {print $i; exit}}')}"
[ -n "$DEVICE" ] || { echo "No iPhone/iPad found. Plug it in, unlock it, and trust this Mac."; exit 1; }
echo "→ Building for $DEVICE"
# Build for this exact device so Xcode adds it to the signing profile (a generic build won't install on a new phone).
xcodebuild -project Mantel.xcodeproj -scheme Mantel -configuration Release -destination "id=$DEVICE" \
  -derivedDataPath build/dd -allowProvisioningUpdates -allowProvisioningDeviceRegistration -quiet build
APP=build/dd/Build/Products/Release-iphoneos/Mantel.app
echo "→ Installing"
xcrun devicectl device install app --device "$DEVICE" "$APP"
xcrun devicectl device process launch --device "$DEVICE" com.nanaamoako.mantel || \
  echo "Installed. If it won't open: Settings → General → VPN & Device Management → trust your Apple ID."
