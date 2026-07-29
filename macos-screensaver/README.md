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
3. That link mints a 90-day session cookie and redirects to `/display?kiosk=1`
   — the same mechanism used for TV pairing, so no extra backend work is
   needed for the screensaver to authenticate, and `kiosk=1` hides all the
   admin/display controls (fullscreen button, clock/music toggles, search,
   log out) so it renders as a clean, chrome-free view.

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

Open **System Settings → Screen Saver**, select **FrameTVScreenSaver**, and
click **Options**. Unlike the upstream project this is forked from, that
panel is not a generic "Fetch URLs Remotely / Addresses table" UI — it's a
custom, branded FrameTV panel:

1. **Not connected yet:** you'll see a "Welcome to FrameTV" screen with a
   **Sign In** button. Click it — a sign-in view opens right there in the
   panel (an embedded web view pointed at FrameTV's `/screensaver/authorize`
   page), no separate browser window needed.
2. Sign in (or create an account). Once you land back on the "Open in
   FrameTVScreenSaver" step, the panel catches that automatically and
   configures itself — duration `-1`, no manual URL pasting, no visiting
   System Settings' finicky address table at all.
3. **Already connected:** the panel shows your connected display URL, plus
   **Sign In as a Different Account** and **Disconnect** buttons.

The same panel is what pops up if you build/run the `FrameTVScreenSaverRig`
target directly — it's a live preview host for the same
`FrameTVConfigController`, useful for iterating on the panel itself without
reinstalling the `.saver` each time.

**If you're changing this panel's code:** it reads/writes the *installed*
screensaver's real `ScreenSaverDefaults` domain, not a private sandbox — so
testing directly against your own already-configured screensaver will
overwrite your real settings if you click Disconnect. Back up
`~/Library/Preferences/ByHost/FrameTVScreenSaver.*.plist` before poking at
a running instance.

## 4. Uninstall

Open **FrameTV Screensaver Settings** from Applications and click
**Uninstall Everything…** in the panel. It removes the installed `.saver`
bundle, clears the `ScreenSaverDefaults` preference domain (address/duration),
and clears the companion app's caches, cookies, and WebKit storage — a real
uninstall, not just deleting the app icon. (Note: **re-dragging the `.saver`
into Screen Savers is not the same as uninstalling it** — macOS replaces the
bundle files but never touches saved preferences, so an old connected link
will keep showing up after a "fresh" reinstall until you actually uninstall
first.)

This button is only shown when running as the standalone companion app —
never inside the `.saver`'s own Options panel, since that would mean the
running bundle deleting itself out from under its own host process.

## Notes

- The share token is a live session credential. Treat the `.saver` bundle's
  configured URL like a password — anyone with your Mac's screensaver prefs
  (or the plist under `~/Library/Containers/...`) can see it. Revoke and
  regenerate it from the admin dashboard if needed.
- If you rebuild the FrameTV web app itself, no screensaver changes are
  needed — it's just loading a URL in a web view.
