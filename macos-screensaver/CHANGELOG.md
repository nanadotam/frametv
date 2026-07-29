# Changelog — FrameTV Screensaver (macOS)

All notable changes to the macOS screensaver are documented here. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions
follow [Semantic Versioning](https://semver.org/) (`screensaver-vX.Y.Z` git
tags — separate from the web app's own `vX.Y.Z` tags/changelog at the repo
root). Tagging `screensaver-vX.Y.Z` triggers `.github/workflows/screensaver-release.yml`,
which builds and publishes the `.dmg`.

See `../VERSIONING.md` for how versions get bumped and tagged.

## [Unreleased]

## [1.0.0] - 2026-07-29

Baseline tag. Screensaver shows the connected FrameTV account's active
mode/album — sourced from Google Drive, Google Photos Picker, or direct
upload (managed from the web admin dashboard). Native branded Options
panel (sign-in, mode picker, disconnect, uninstall). Resets the version
number inherited from the liquidx/webviewscreensaver fork this was
rebranded from (see `NOTICE.md`) — this is FrameTV's own version 1, not a
continuation of upstream's numbering.

[Unreleased]: https://github.com/nanadotam/frametv/compare/screensaver-v1.0.0...HEAD
[1.0.0]: https://github.com/nanadotam/frametv/releases/tag/screensaver-v1.0.0
