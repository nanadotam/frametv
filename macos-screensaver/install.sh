#!/bin/bash
set -u

abort() {
  printf "%s\n" "$@"
  exit 1
}

if [[ "$(uname)" != "Darwin" ]]; then
  abort "FrameTVScreenSaver is only supported on macOS."
fi

if ! command -v xcodebuild >/dev/null; then
  abort "Install process requires Xcode."
fi

cd "$(dirname "$0")/FrameTVScreenSaver" || exit 1

BUILD_DIR="build"
rm -rf "$BUILD_DIR"
mkdir "$BUILD_DIR"

printf 'Building FrameTVScreenSaver...'
xcodebuild -project FrameTVScreenSaver.xcodeproj \
  -scheme FrameTVScreenSaver \
  -configuration Release clean archive \
  -archivePath "$BUILD_DIR/build.xcarchive" \
  CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=YES > "$BUILD_DIR/build.log" 2>&1
if [ $? -ne 0 ]; then
  printf ' Failed. See %s/build.log\n' "$BUILD_DIR"
  exit 1
fi
printf ' Done\n'

printf 'Installing to ~/Library/Screen Savers...'
mkdir -p "${HOME}/Library/Screen Savers"
rm -rf "${HOME}/Library/Screen Savers/FrameTVScreenSaver.saver"
cp -pr "$(find "$BUILD_DIR" -iname "*.saver")" "${HOME}/Library/Screen Savers"
xattr -d com.apple.quarantine "${HOME}/Library/Screen Savers/FrameTVScreenSaver.saver" 2>/dev/null
printf ' Done\n'

printf 'Cleaning up...'
rm -rf "$BUILD_DIR"
printf ' Done\n'

echo ""
echo "Open System Settings > Screen Saver > FrameTVScreenSaver > Options"
echo "and add your /s/<token> share link with duration -1."
