# Changelog

All notable changes to the FrameTV web app are documented here. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions
follow [Semantic Versioning](https://semver.org/) (`vMAJOR.MINOR.PATCH` git
tags at the repo root — separate from the screensaver's own
`screensaver-vX.Y.Z` tags/changelog under `macos-screensaver/`).

See `VERSIONING.md` for how versions get bumped and tagged.

## [Unreleased]

### Added
- Brand identity: new FrameTV mark (a cream gallery frame with a power LED
  showing a dusk landscape) with a simplified small-size variant, and
  editable sources + `brand/generate.sh` to regenerate every asset.
- Favicon (.ico 16/32/48 + SVG), Apple touch icon, PWA icons including a
  maskable icon, and a 1200×630 Open Graph / Twitter card.
- SEO metadata: title template, description, keywords, Open Graph and
  Twitter tags, theme colour, `robots.txt` and `sitemap.xml`; the display
  page is `noindex`.
- Video mode: silent, looping clips from your albums with the usual
  overlays. Plays an album back to back or loops one clip, with optional
  shuffle, "time on each video" hold, and fill/fit framing.
- Video albums: "New video album" on the Albums page and "Add video" on an
  album. Videos are compressed in the browser (≤1080p H.264, no audio,
  fast start) and uploaded straight to Supabase Storage — a 122 MB 4K clip
  becomes ~6 MB.
- Video templates, rendered on the GPU (WebGL) with CSS fallbacks:
  - **Old TV** — curved tube, scanlines, aperture grille, colour bleed,
    rolling band and a VCR "PLAY ▶" / date-stamp on-screen display.
  - **Fisheye** — round wide-angle lens with barrel distortion, fringing and
    a dark rim.
  - **Film** — 2.39:1 scope bars, 24 fps grain, faded warm stock, gate
    weave, exposure flicker, scratches and dust.
  - **Grid** — 3–6 clips playing at once in the photo grid's mosaic
    layouts; repeats of the same clip start staggered.
- Multimodal Pinterest and Grid: a "Multimodal" switch mixes the active
  albums' videos in among the stills. Video tiles show their poster, fade
  the clip in once playing, and only download/play while on screen.

### Fixed
- The browser tab showed the default Vercel triangle favicon.
- Uploaded-photo thumbnails redirected to a bare storage path instead of a
  public URL.

### Changed
- Photo modes now load images only (`/api/photos` filters by `media_type`).
- Requires migration `017_video_mode.sql` (adds `photos.media_type`,
  `photos.duration_ms`, the `photos` storage bucket and the `video` mode).

## [0.1.0] - 2026-07-29

Baseline tag — first version-tracked point in the project's history.
Everything before this is untracked; changes from here on get an entry
above under `[Unreleased]` and move into a dated release section on tag.

[Unreleased]: https://github.com/nanadotam/frametv/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nanadotam/frametv/releases/tag/v0.1.0
