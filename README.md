# Mantel

**Your memories, on display.** Mantel turns a Mac screensaver, a smart TV, an
iPad or any browser into a living picture frame of your photos and videos.

- **Web app** (`src/`): Next.js 16 + Supabase. Account, Library (Google Drive
  photo albums, uploaded video albums), Looks (slideshow, gallery wall,
  pinboard, scrapbook, clock, verse, vinyl…), Devices, Settings. Deployed on
  Vercel at https://mantelapp.vercel.app.
- **Display** (`/display`, `/tv`): the full-screen picture frame. `/tv` is a
  no-framework fallback for older smart-TV browsers.
- **Mac screensaver** (`macos-screensaver/`): `Mantel.saver`, a WKWebView
  screensaver (fork of webviewscreensaver) that shows your display.
- **Mantel for Mac** (`desktop/`): Electron companion app. Onboarding, the
  website, and a guided setup that installs and connects the screensaver.
  Released as `Mantel.dmg` on GitHub Releases.

## Develop

```bash
pnpm install
pnpm dev                     # web app on :3000
cd desktop && npm install && MANTEL_URL=http://localhost:3000 npm start
```

Env vars: see `.env.local.example`. The server talks to Supabase only with
`SUPABASE_SERVICE_ROLE_KEY`; every table has RLS on with no public policies.

## Release the Mac app

```bash
git tag mantel-v1.0.0 && git push origin mantel-v1.0.0
```

`.github/workflows/mantel-release.yml` builds `Mantel.dmg` (screensaver
bundled inside) and publishes it as the latest release, which the site's
Download button links to directly. Locally: `cd desktop && npm run dist`.

The app is ad-hoc signed, not notarized, so first launch needs
System Settings → Privacy & Security → Open Anyway. `/help#mac` walks people
through it.

See `SCHEMA.md` for the data model and `VERSIONING.md` for versioning.
