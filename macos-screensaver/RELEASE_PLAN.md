# Goal: a real, downloadable macOS release

Right now, using the FrameTV screensaver means cloning this repo and running
`./install.sh` (which shells out to `xcodebuild`) — that requires Xcode
installed and is not something a non-technical person, or even a technical
person on a new machine, wants to do just to try it out.

**Target end state:** someone lands on this repo, goes to Releases, downloads
the latest `.dmg`/`.pkg`/`.zip`, opens it, and within a couple of clicks has
the screensaver installed and pointed at their FrameTV instance — no Xcode,
no `xcodebuild`, no manually editing `ScreenSaverDefaults`.

This file is the plan for getting there. **Status: not started — planning
only.** Nothing below has been built yet.

---

## What already exists (the building blocks)

- `FrameTVScreenSaver/` — the Xcode project, two targets:
  - `FrameTVScreenSaver` scheme → builds `FrameTVScreenSaver.saver`
  - `FrameTVScreenSaverRig` scheme → builds the companion app ("FrameTV
    Screensaver Settings.app") that registers `frametvscreensaver://` and
    writes into the real screensaver's `ScreenSaverDefaults`
- `install.sh` — builds both from source locally and installs the `.saver`
  (does **not** currently install the companion app)
- `/screensaver/authorize` (in the main Next.js app) — the browser-side half
  of the one-click connect flow, already deployed
- Both targets build clean and ad-hoc sign today (`CODE_SIGN_IDENTITY="-"`)

## What's missing for a real release

### 1. CI build + release pipeline
A GitHub Actions workflow, triggered on a version tag (e.g. `screensaver-v1.0.0`):
- Runs on `macos-latest`
- `xcodebuild archive` for both `FrameTVScreenSaver` and `FrameTVScreenSaverRig`
  schemes (same commands `install.sh` already uses)
- Packages the two build products together (see packaging format below)
- Uses `gh release create` (or the `softprops/action-gh-release` action) to
  attach the packaged artifact to a GitHub Release, with release notes

This is the highest-leverage piece — everything else is refinement on top of
having *a* downloadable artifact at all.

### 2. Packaging format — needs a decision
Three realistic options, roughly in order of end-user friendliness vs. how
much work they are to build:

- **Plain `.zip`** containing `FrameTVScreenSaver.saver` +
  `FrameTV Screensaver Settings.app`, with a short `INSTALL.txt`/README
  telling the user to double-click the `.saver` (which auto-installs to
  `~/Library/Screen Savers` — this is standard macOS behavior for `.saver`
  files) and drag the `.app` to `/Applications`.
  *Cheapest to build, still two manual steps, still hits Gatekeeper prompts.*
- **`.dmg`** with both items and a symlink to `/Applications`, styled like a
  normal macOS app installer (drag-to-Applications window). More polished,
  moderate effort (`create-dmg` or `hdiutil` in the CI script).
- **`.pkg` installer** that installs both to their correct final locations
  (`~/Library/Screen Savers`, `/Applications`) and can optionally pre-seed
  `ScreenSaverDefaults` from a value baked in at build time or entered during
  install. Most "just works," most effort — `.pkg` build/signing has its own
  learning curve (`pkgbuild`/`productbuild`).

**Recommendation for v1: `.dmg`.** Good friendliness-to-effort ratio, and it
keeps the "open app once to register the URL scheme, then use the browser
connect flow" UX we already built rather than trying to pre-seed config at
install time (which only makes sense for a single-tenant deploy, not a
general release anyone can point at their own FrameTV instance).

### 3. Signing & Gatekeeper
Ad-hoc signing (what we have now) means every fresh download triggers macOS's
"Apple could not verify this app is free of malware" prompt, requiring the
`Privacy & Security → Open Anyway` dance documented in the current README.
That's an acceptable speed bump for a README-driven manual build, but it's a
real drop-off risk for a "download and just use" release aimed at less
technical users.

To remove that prompt entirely: enroll in the **Apple Developer Program**
($99/yr), get a Developer ID Application certificate, and **notarize** both
the `.saver` and the `.app` as part of the CI release step (`xcrun notarytool
submit` + `xcrun stapler staple`). This is a cost/effort decision for you to
make, not something to default into — ad-hoc + clear instructions is a
perfectly fine v1.

### 4. Versioning
Decide a tagging scheme independent of the main app's deploys, since the
screensaver ships on its own cadence — e.g. `screensaver-v1.0.0` tags,
`CFBundleShortVersionString`/`CFBundleVersion` bumped in both Info.plists to
match at release time (currently hardcoded to `2.4` in both, inherited
unchanged from the upstream fork).

### 5. README rewrite
Once a release pipeline exists, `macos-screensaver/README.md`'s "Build and
install" section should lead with "Download the latest release" as the
primary path, demoting the from-source `install.sh` path to a "build it
yourself" section for contributors.

---

## Suggested order of work (next session)

1. Write the GitHub Actions workflow (`.github/workflows/screensaver-release.yml`)
   producing a `.zip` first — simplest possible end-to-end pipeline, proves
   the release mechanics work.
2. Tag a `v0.1.0` test release, download it on a clean-ish account, verify
   the Gatekeeper flow and instructions actually work for a first-time user.
3. Upgrade packaging to `.dmg` once the basic pipeline is proven.
4. Rewrite the README's install section to lead with the release download.
5. Revisit notarization as a later polish pass, once/if it's worth the
   Apple Developer Program cost.
