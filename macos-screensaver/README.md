# FrameTV Screensaver (macOS)

Turns your Mac's screensaver into your FrameTV display — the same full-screen
`/display` view used on paired TVs, running inside a native `WKWebView`.

This is a rebrand of [liquidx/webviewscreensaver](https://github.com/liquidx/webviewscreensaver)
(Apache 2.0) — see `NOTICE.md` for what changed. All the actual screensaver
engine (URL cycling, config UI, lifecycle handling) is unmodified upstream code.

## 1. Get your share link

1. Deploy/run FrameTV and sign in as an admin.
2. Go to the admin dashboard → **Share Live Link** and generate a link. It
   looks like `https://your-domain.com/s/AbCd1234`.
3. That link mints a 90-day session cookie and redirects to `/display` — it's
   the same mechanism used for TV pairing, so no extra backend work is needed
   for the screensaver to authenticate.

## 2. Build and install

```bash
./install.sh
```

This builds `FrameTVScreenSaver.saver` (ad-hoc signed, universal arm64/x86_64)
and copies it into `~/Library/Screen Savers`.

Or build manually in Xcode: open `FrameTVScreenSaver/FrameTVScreenSaver.xcodeproj`,
select the `FrameTVScreenSaver` scheme, Product → Archive, then copy the
resulting `.saver` bundle from the archive into `~/Library/Screen Savers`.

### Gatekeeper

Since the bundle is ad-hoc signed (not notarized), macOS will block it the
first time. After installing, if System Settings → Screen Saver doesn't show
"FrameTVScreenSaver":

```bash
xattr -d com.apple.quarantine ~/Library/Screen\ Savers/FrameTVScreenSaver.saver
```

Or approve it via **System Settings → Privacy & Security → Open Anyway**.

## 3. Configure

Open **System Settings → Screen Saver**, select **FrameTVScreenSaver**, click
**Options**, and add one address:

- **URL**: your `/s/<token>` share link from step 1
- **Duration**: `-1` (stay on it indefinitely — this is a live single-page
  display, not a slideshow to cycle away from)

## Notes

- The share token is a live session credential. Treat the `.saver` bundle's
  configured URL like a password — anyone with your Mac's screensaver prefs
  (or the plist under `~/Library/Containers/...`) can see it. Revoke and
  regenerate it from the admin dashboard if needed.
- If you rebuild the FrameTV web app itself, no screensaver changes are
  needed — it's just loading a URL in a web view.
