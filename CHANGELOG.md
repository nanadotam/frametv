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
- Duplicate video detection: uploading a clip that's already in the album
  offers Replace / Skip / Cancel; one that's in another album offers Copy
  from that album (no re-encode) / Upload anyway / Skip / Cancel, with
  "do this for every remaining" for big batches.
- Google-Drive-style upload tray (bottom right): an overall progress bar
  plus a row per file showing waiting / converting / compressing /
  uploading / done / skipped / copied / failed. Failed rows show the
  reason, the time it failed and how long it ran, with per-file and
  "Retry failed" buttons. More videos can be added while a batch runs.
- DSLR / cinema-camera footage the browser can't decode (e.g. Canon
  10-bit 4:2:2 H.264) is converted in the browser with ffmpeg.wasm (loaded
  only when needed) and then uploaded as normal — no manual export step.
- Pinterest: "Change photos every" setting (30 s – 10 min). A page stays up
  for that long — or for its longest video, whichever is longer — while
  videos keep looping, then rolls over slot by slot.
- Grid: picks the template and which photo goes in which cell together,
  from the shapes of the upcoming photos, so a run of portraits gets a
  portrait layout instead of being cropped into landscape cells. Adds
  mixed portrait/landscape templates and uses the real screen shape.
- `pnpm fix-orientation` (macOS): finds photos stored sideways or upside
  down — phones sometimes record the wrong orientation — by reading face
  roll angles with Apple Vision, and sets their rotation. Re-runs only check
  new photos; hand-set rotations are respected (`--dry-run`, `--recheck`,
  `--user=<id>`).

### Fixed
- The browser tab showed the default Vercel triangle favicon.
- Uploaded-photo thumbnails redirected to a bare storage path instead of a
  public URL.
- A batch video upload stopped at the first bad file with WebCodecs'
  raw "Unsupported configuration" error. Files are now checked before
  decoding, and one failure no longer stops the rest of the batch.
- Pinterest swapped the whole wall within seconds whenever the photo list
  refreshed (every minute, or whenever any photo changed) and ignored its
  interval setting. Refreshes now keep the running order in every mode.
- Grid and Scrapbook: photos rotated 90°/270° were turned in place and left
  empty corners; they now fill their cell. Pinterest's loading placeholder
  is rotated too.

### Changed
- Video uploads cap the output at 30 fps — smaller files, no visible
  difference on a wall TV.
- Photo modes now load images only (`/api/photos` filters by `media_type`).
- Requires migration `017_video_mode.sql` (adds `photos.media_type`,
  `photos.duration_ms`, the `photos` storage bucket and the `video` mode).

## [0.1.0] - 2026-07-29

Baseline tag — first version-tracked point in the project's history.
Everything before this is untracked; changes from here on get an entry
above under `[Unreleased]` and move into a dated release section on tag.

[Unreleased]: https://github.com/nanadotam/frametv/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nanadotam/frametv/releases/tag/v0.1.0
