This directory is a modified fork of [liquidx/webviewscreensaver](https://github.com/liquidx/webviewscreensaver)
by Alastair Tse & Contributors, licensed under the Apache License, Version 2.0 (see `LICENSE`).

Changes made in this fork:
- Renamed the product/target/bundle identifier from `WebViewScreenSaver` (`net.liquidx.*`) to
  `FrameTVScreenSaver` (`com.frametv.*`).
- Cleared the original signing team so it ad-hoc builds without a specific Apple Developer account.
- Changed the default placeholder address from `http://www.google.com/` to `about:blank`.
- Replaced the upstream `WVSSConfigController`/`ConfigureSheet.xib` options UI (generic
  "Fetch URLs Remotely / Addresses table") with a new, custom-built `FrameTVConfigController`
  (`FrameTVConfigController.h/.m`, not from upstream) — a branded panel with an embedded
  WKWebView sign-in flow instead of manual URL entry. The old files are still present and still
  compile (unused) rather than removed, to keep this change reviewable as a diff; `WVSSConfig`/
  `WVSSAddress` (the underlying storage layer) are unmodified and still used by the new panel.

The underlying `WKWebView`-based screensaver engine (address cycling, config storage,
notifications) is unmodified from upstream. Original file headers and copyright notices are
preserved.
