This directory is a modified fork of [liquidx/webviewscreensaver](https://github.com/liquidx/webviewscreensaver)
by Alastair Tse & Contributors, licensed under the Apache License, Version 2.0 (see `LICENSE`).

Changes made in this fork:
- Renamed the product/target/bundle identifier from `WebViewScreenSaver` (`net.liquidx.*`) to
  `FrameTVScreenSaver` (`com.frametv.*`).
- Cleared the original signing team so it ad-hoc builds without a specific Apple Developer account.
- Changed the default placeholder address from `http://www.google.com/` to `about:blank`.

The underlying `WKWebView`-based screensaver engine (address cycling, config UI, notifications) is
unmodified from upstream. Original file headers and copyright notices are preserved.
