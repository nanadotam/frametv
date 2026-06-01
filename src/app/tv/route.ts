// GET /tv — standalone TV-browser display page.
// Returns a self-contained HTML document with no React, no Next.js runtime,
// and no external JS dependencies. Compatible with Tizen 4+ (Chromium 56+)
// and webOS 4+ (Chromium 53+). Uses XHR for all API calls and ES6 syntax
// (no optional chaining, no nullish coalescing, no template literals in
// client JS). Flexbox uses -webkit- prefixes for pre-87 Chromium compat.
// `gap` is replaced with `margin-top` selectors for same reason.

export const dynamic = 'force-dynamic';

// ─── CSS ────────────────────────────────────────────────────────────────────

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{
  width:100%;height:100%;
  background:#000;color:#fff;
  overflow:hidden;
  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;
}

/* Loading ───────────────────────────────────────────────────────────────── */
#ftv-loading{
  position:fixed;top:0;right:0;bottom:0;left:0;
  display:-webkit-box;
  display:-ms-flexbox;
  display:flex;
  -webkit-box-orient:vertical;
  -webkit-box-direction:normal;
  -ms-flex-direction:column;
  flex-direction:column;
  -webkit-box-align:center;
  -ms-flex-align:center;
  align-items:center;
  -webkit-box-pack:center;
  -ms-flex-pack:center;
  justify-content:center;
  background:#000;
  z-index:90;
}
.ftv-spinner{
  width:72px;height:72px;border-radius:50%;
  background:rgba(255,255,255,.12);
  margin-bottom:24px;
  -webkit-animation:ftv-pulse 2s ease-in-out infinite;
  animation:ftv-pulse 2s ease-in-out infinite;
}
@-webkit-keyframes ftv-pulse{0%,100%{opacity:.18}50%{opacity:.65}}
@keyframes ftv-pulse{0%,100%{opacity:.18}50%{opacity:.65}}
#ftv-load-msg{
  font-size:1.05rem;
  color:rgba(255,255,255,.4);
  max-width:440px;
  text-align:center;
  line-height:1.6;
  min-height:1.4em;
}

/* PIN gate ──────────────────────────────────────────────────────────────── */
#ftv-pin-gate{
  position:fixed;top:0;right:0;bottom:0;left:0;
  display:-webkit-box;
  display:-ms-flexbox;
  display:flex;
  -webkit-box-align:center;
  -ms-flex-align:center;
  align-items:center;
  -webkit-box-pack:center;
  -ms-flex-pack:center;
  justify-content:center;
  background:#000;
  padding:40px;
  z-index:100;
}
.ftv-pin-wrap{
  width:100%;max-width:520px;
  display:-webkit-box;
  display:-ms-flexbox;
  display:flex;
  -webkit-box-orient:vertical;
  -webkit-box-direction:normal;
  -ms-flex-direction:column;
  flex-direction:column;
}
.ftv-pin-wrap > * + *{margin-top:20px}
.ftv-logo{font-size:60px;text-align:center}
.ftv-title{
  font-size:3.2rem;font-weight:700;
  text-align:center;letter-spacing:-.025em;
}
.ftv-subtitle{
  font-size:1.2rem;text-align:center;
  color:rgba(255,255,255,.42);
}
.ftv-input{
  display:block;width:100%;
  background:rgba(255,255,255,.1);
  border:1.5px solid rgba(255,255,255,.14);
  border-radius:14px;
  color:#fff;
  font-size:1.5rem;
  padding:17px 22px;
  outline:none;
  -webkit-appearance:none;
  -moz-appearance:none;
  appearance:none;
  font-family:inherit;
  -webkit-transition:border-color .15s ease;
  transition:border-color .15s ease;
}
.ftv-input:focus{
  border-color:rgba(255,255,255,.38);
  outline:3px solid rgba(255,255,255,.12);
  outline-offset:0;
}
.ftv-input-pin{
  text-align:center;
  letter-spacing:.45em;
  font-size:2.4rem;
  padding:19px 22px;
}
.ftv-error{
  color:#fca5a5;
  text-align:center;
  font-size:1.05rem;
  min-height:1.4em;
}
.ftv-btn{
  display:block;width:100%;
  padding:21px;border-radius:14px;
  background:-webkit-linear-gradient(315deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%);
  background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%);
  border:none;color:#fff;
  font-size:1.45rem;font-weight:700;
  cursor:pointer;letter-spacing:.02em;
  font-family:inherit;
  -webkit-appearance:none;
  -moz-appearance:none;
  appearance:none;
}
.ftv-btn:focus{outline:3px solid rgba(255,255,255,.45);outline-offset:3px}

/* Display ───────────────────────────────────────────────────────────────── */
#ftv-display{
  position:fixed;top:0;right:0;bottom:0;left:0;
  background:#000;
  -webkit-transition:opacity .35s ease;
  transition:opacity .35s ease;
}
.ftv-photo{
  position:absolute;
  top:0;right:0;bottom:0;left:0;
  width:100%;height:100%;
  -o-object-fit:cover;
  object-fit:cover;
  object-position:center;
  opacity:0;
  -webkit-transition:opacity 1.3s ease;
  transition:opacity 1.3s ease;
}

/* Clock ─────────────────────────────────────────────────────────────────── */
#ftv-clock{
  position:absolute;
  z-index:20;
  color:#fff;
  pointer-events:none;
}
.ftv-clock-full{
  top:0;right:0;bottom:0;left:0;
  display:-webkit-box !important;
  display:-ms-flexbox !important;
  display:flex !important;
  -webkit-box-align:center;
  -ms-flex-align:center;
  align-items:center;
  -webkit-box-pack:center;
  -ms-flex-pack:center;
  justify-content:center;
  font-size:13vw;
  font-weight:700;
  letter-spacing:-.025em;
  text-shadow:0 2px 48px rgba(0,0,0,.55);
}
.ftv-clock-corner{
  font-size:1.95rem;
  font-weight:700;
  background:rgba(0,0,0,.48);
  padding:9px 20px;
  border-radius:11px;
}
.ftv-pos-br{bottom:30px;right:30px}
.ftv-pos-bl{bottom:30px;left:30px}
.ftv-pos-tr{top:30px;right:30px}
.ftv-pos-tl{top:30px;left:30px}
.ftv-pos-c{
  top:50%;left:50%;
  -webkit-transform:translate(-50%,-50%);
  transform:translate(-50%,-50%);
}
`;

// ─── Client-side JS ─────────────────────────────────────────────────────────
// Written in ES6 without optional chaining, nullish coalescing, or template
// literals so it runs unmodified on Tizen 4 (Chromium 56) and webOS 4.

const JS = `
(function () {
  'use strict';

  var POLL_MS          = 5000;
  var DEFAULT_DELAY_MS = 10000;

  /* ── state ──────────────────────────────────────────────────────────────── */
  var photos        = [];
  var currentIdx    = 0;
  var frontLayer    = 0;   /* 0 = img-a visible, 1 = img-b visible */
  var isPaused      = false;
  var brightness    = 100;
  var intervalMs    = DEFAULT_DELAY_MS;
  var lastSkip      = null;
  var clockEnabled  = false;
  var clockPosClass = 'ftv-pos-br';
  var clockFont     = 'system-ui,sans-serif';
  var modeId        = null;
  var tPhoto        = null;
  var tPoll         = null;
  var tClock        = null;

  /* ── dom cache ──────────────────────────────────────────────────────────── */
  var D = {};
  function grab(id) { return document.getElementById(id); }
  function cacheDom() {
    D.loading  = grab('ftv-loading');
    D.loadMsg  = grab('ftv-load-msg');
    D.pinGate  = grab('ftv-pin-gate');
    D.pinForm  = grab('ftv-pin-form');
    D.pinUser  = grab('ftv-pin-user');
    D.pinCode  = grab('ftv-pin-code');
    D.pinErr   = grab('ftv-pin-error');
    D.display  = grab('ftv-display');
    D.imgA     = grab('ftv-img-a');
    D.imgB     = grab('ftv-img-b');
    D.clock    = grab('ftv-clock');
    D.clockTxt = grab('ftv-clock-txt');
  }

  /* ── xhr helper ─────────────────────────────────────────────────────────── */
  function xhr(url, method, body, cb) {
    var x = new XMLHttpRequest();
    x.open(method || 'GET', url, true);
    x.withCredentials = true;
    x.timeout = 12000;
    if (body) x.setRequestHeader('Content-Type', 'application/json');
    x.onload = function () {
      var ok = x.status >= 200 && x.status < 300;
      var data = null;
      try { data = JSON.parse(x.responseText); } catch (e) { /* ignore */ }
      cb(data, ok);
    };
    x.onerror = x.ontimeout = function () { cb(null, false); };
    x.send(body || null);
  }
  function get(url, cb)        { xhr(url, 'GET', null, cb); }
  function post(url, body, cb) { xhr(url, 'POST', body, cb); }

  /* ── display helpers ────────────────────────────────────────────────────── */
  function showFlex(el)  { if (el) el.style.display = 'flex'; }
  function showBlock(el) { if (el) el.style.display = 'block'; }
  function hide(el)      { if (el) el.style.display = 'none'; }
  function msg(t)        { if (D.loadMsg) D.loadMsg.textContent = t; }

  /* ── auth ───────────────────────────────────────────────────────────────── */
  function checkAuth() {
    get('/api/auth/me', function (data, ok) {
      if (ok && data && data.user) { launch(); }
      else                         { showPin(); }
    });
  }

  function showPin() {
    hide(D.loading);
    showFlex(D.pinGate);
    if (D.pinUser) D.pinUser.focus();
  }

  function onPinSubmit(e) {
    e.preventDefault();
    if (D.pinErr) D.pinErr.textContent = '';
    var body = JSON.stringify({
      emailOrUsername: D.pinUser ? D.pinUser.value : '',
      pin:             D.pinCode ? D.pinCode.value : ''
    });
    post('/api/auth/pin', body, function (data, ok) {
      if (ok) {
        hide(D.pinGate);
        showFlex(D.loading);
        launch();
      } else {
        if (D.pinErr) D.pinErr.textContent = (data && data.error) || 'Incorrect credentials.';
      }
    });
  }

  /* ── boot sequence ──────────────────────────────────────────────────────── */
  function launch() {
    // Clear any timers from a previous session (e.g. user logs out and back in).
    if (tClock) { clearInterval(tClock); tClock = null; }
    if (tPhoto) { clearInterval(tPhoto); tPhoto = null; }
    msg('');
    loadState();
    if (tPoll) clearInterval(tPoll);
    tPoll = setInterval(poll, POLL_MS);
  }

  /* Step 1 — display state */
  function loadState() {
    get('/api/display-state', function (data, ok) {
      if (!ok || !data || !data.state) {
        msg('Could not reach display. Retrying…');
        setTimeout(loadState, 6000);
        return;
      }
      var s    = data.state;
      brightness = typeof s.brightness === 'number' ? s.brightness : 100;
      isPaused   = s.is_paused === true;
      lastSkip   = s.photo_skip;
      loadSchedules(s);
    });
  }

  /* Step 2 — resolve active mode via schedules */
  function loadSchedules(ds) {
    get('/api/schedules', function (data, ok) {
      var schedules = (ok && data && data.schedules) || [];
      var active    = findActiveSchedule(schedules);
      modeId        = (active && active.mode_id)   || ds.active_mode_id;
      var albumIds  = (active && active.album_ids) || ds.active_album_ids || [];
      loadModeConfig(albumIds);
    });
  }

  /* Step 3 — load mode config (interval, etc.) */
  function loadModeConfig(albumIds) {
    get('/api/modes', function (data) {
      var modes = (data && data.modes) || [];
      var row   = null;
      for (var i = 0; i < modes.length; i++) {
        if (modes[i].id === modeId) { row = modes[i]; break; }
      }
      var cfg  = (row && row.config) || {};
      var secs = Number(cfg.intervalSeconds || cfg.interval || 10);
      intervalMs = Math.max(2, secs) * 1000;
      loadClockConfig(albumIds);
    });
  }

  /* Step 4 — load clock overlay config then hand off to mode handler */
  function loadClockConfig(albumIds) {
    get('/api/settings?key=clock_overlay', function (data) {
      var cfg      = (data && data.setting && data.setting.value) || {};
      clockEnabled = cfg.enabled === true;
      clockFont    = fontStack(cfg.font || 'Poppins');
      var posMap   = {
        'bottom-right': 'ftv-pos-br',
        'bottom-left':  'ftv-pos-bl',
        'top-right':    'ftv-pos-tr',
        'top-left':     'ftv-pos-tl',
        'center':       'ftv-pos-c'
      };
      clockPosClass = posMap[cfg.position] || 'ftv-pos-br';

      if (modeId === 'clock-text') { startClockMode(); }
      else                         { loadPhotos(albumIds); }
    });
  }

  /* ── schedule resolution ────────────────────────────────────────────────── */
  // days_of_week is stored as int[] in Postgres (0=Sun, 1=Mon … 6=Sat),
  // matching JavaScript's Date.prototype.getDay() values.
  function findActiveSchedule(schedules) {
    if (!schedules || !schedules.length) return null;
    var todayIdx = new Date().getDay(); // 0–6
    var now      = new Date();
    var nowMins  = now.getHours() * 60 + now.getMinutes();

    for (var i = 0; i < schedules.length; i++) {
      var s = schedules[i];
      if (s.is_enabled === false) continue;
      var dow     = s.days_of_week || [];
      var matched = false;
      for (var d = 0; d < dow.length; d++) {
        if (Number(dow[d]) === todayIdx) { matched = true; break; }
      }
      if (!matched) continue;
      var sp    = (s.start_time || '00:00').split(':');
      var ep    = (s.end_time   || '23:59').split(':');
      var sMins = parseInt(sp[0], 10) * 60 + parseInt(sp[1] || '0', 10);
      var eMins = parseInt(ep[0], 10) * 60 + parseInt(ep[1] || '0', 10);
      if (nowMins >= sMins && nowMins < eMins) return s;
    }
    return null;
  }

  /* ── clock-only mode ────────────────────────────────────────────────────── */
  function startClockMode() {
    hide(D.loading);
    hide(D.imgA);
    hide(D.imgB);
    D.display.style.opacity = (brightness / 100).toFixed(2);
    showBlock(D.display);
    D.clock.className        = 'ftv-clock-full';
    D.clock.style.fontFamily = clockFont;
    D.clock.style.display    = 'flex';
    tickClock();
    tClock = setInterval(tickClock, 1000);
  }

  function mountClockOverlay() {
    if (tClock) return;
    D.clock.className        = 'ftv-clock-corner ' + clockPosClass;
    D.clock.style.fontFamily = clockFont;
    showBlock(D.clock);
    tickClock();
    tClock = setInterval(tickClock, 1000);
  }

  function tickClock() {
    var now = new Date();
    var h   = now.getHours();
    var m   = now.getMinutes();
    var ap  = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    if (D.clockTxt) {
      D.clockTxt.textContent = h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
    }
  }

  /* ── photo loading ──────────────────────────────────────────────────────── */
  // Uses /api/photos which allows display sessions (unlike /api/albums/[id]/photos
  // which is admin-only). Fetches all albums in one request via albumIds param.
  function loadPhotos(albumIds) {
    if (!albumIds || !albumIds.length) {
      msg('No albums configured. Open the admin panel to add one.');
      return;
    }
    var url = '/api/photos?limit=1000&albumIds=' + albumIds.join(',');
    get(url, function (data, ok) {
      var list = (ok && data && Array.isArray(data.photos)) ? data.photos : [];
      onPhotosReady(list);
    });
  }

  function onPhotosReady(all) {
    if (!all.length) {
      msg('No photos found. Sync an album from the admin panel first.');
      return;
    }
    photos     = shuffle(all);
    currentIdx = 0;
    hide(D.loading);
    D.display.style.opacity = (brightness / 100).toFixed(2);
    showBlock(D.display);
    advance(0);
    startTimer();
    if (clockEnabled) mountClockOverlay();
  }

  /* ── photo display ──────────────────────────────────────────────────────── */
  function photoSrc(photo) {
    if (photo.source_type === 'drive' && photo.source_id) {
      return 'https://drive.google.com/thumbnail?id=' + photo.source_id + '&sz=w1920';
    }
    return '/api/photos/' + photo.id + '/thumbnail?size=1920';
  }

  function getRotation(photo) {
    if (photo.metadata && typeof photo.metadata.rotation === 'number') {
      return ((photo.metadata.rotation % 360) + 360) % 360;
    }
    return 0;
  }

  function applyRotation(img, rot) {
    /* reset first */
    img.style.position  = 'absolute';
    img.style.width     = '100%';
    img.style.height    = '100%';
    img.style.top       = '';
    img.style.left      = '';
    img.style.maxWidth  = '';
    img.style.transform = '';

    if (rot === 180) {
      img.style.transform = 'rotate(180deg)';
    } else if (rot === 90 || rot === 270) {
      /* portrait photo on landscape screen — swap dimensions */
      img.style.width     = '100vh';
      img.style.height    = '100vw';
      img.style.maxWidth  = 'none';
      img.style.top       = '50%';
      img.style.left      = '50%';
      img.style.transform = 'translate(-50%,-50%) rotate(' + rot + 'deg)';
    }
  }

  function advance(idx) {
    if (!photos.length) return;
    idx        = ((idx % photos.length) + photos.length) % photos.length;
    currentIdx = idx;

    var photo    = photos[idx];
    var src      = photoSrc(photo);
    var rot      = getRotation(photo);
    var nextIdx  = 1 - frontLayer;
    var nextImg  = nextIdx === 0 ? D.imgA : D.imgB;
    var curImg   = frontLayer === 0 ? D.imgA : D.imgB;

    var loader    = new Image();
    loader.onload = function () {
      nextImg.src = src;
      applyRotation(nextImg, rot);
      nextImg.style.opacity = '1';
      curImg.style.opacity  = '0';
      frontLayer = nextIdx;
      preload(idx + 1);
    };
    loader.onerror = function () { advance(idx + 1); };
    loader.src = src;
  }

  function preload(idx) {
    if (!photos.length) return;
    idx = ((idx % photos.length) + photos.length) % photos.length;
    var img = new Image();
    img.src = photoSrc(photos[idx]);
  }

  function startTimer() {
    if (tPhoto) clearInterval(tPhoto);
    tPhoto = setInterval(function () {
      if (!isPaused) advance(currentIdx + 1);
    }, intervalMs);
  }

  /* ── state polling ──────────────────────────────────────────────────────── */
  function poll() {
    get('/api/display-state', function (data, ok) {
      if (!ok || !data || !data.state) return;
      var s = data.state;

      isPaused = s.is_paused === true;

      var nb = typeof s.brightness === 'number' ? s.brightness : brightness;
      if (nb !== brightness) {
        brightness = nb;
        if (D.display) D.display.style.opacity = (brightness / 100).toFixed(2);
      }

      var ns = s.photo_skip;
      if (lastSkip !== null && ns !== lastSkip) {
        var delta = ns - lastSkip;
        if (Math.abs(delta) >= 1000) {
          photos = shuffle(photos);
          advance(0);
        } else {
          var dir   = delta > 0 ? 1 : -1;
          var steps = Math.abs(delta);
          advance(currentIdx + dir * steps);
        }
      }
      lastSkip = ns;
    });
  }

  /* ── remote / keyboard ──────────────────────────────────────────────────── */
  function onKey(e) {
    var k = e.key || e.keyCode;
    if      (k === 'ArrowRight' || k === 39) { if (modeId !== 'clock-text') advance(currentIdx + 1); }
    else if (k === 'ArrowLeft'  || k === 37) { if (modeId !== 'clock-text') advance(currentIdx - 1); }
    else if (k === 'Enter' || k === 13 || k === ' ' || k === 32) { isPaused = !isPaused; }
  }

  /* ── utilities ──────────────────────────────────────────────────────────── */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function fontStack(name) {
    var map = {
      'Poppins':          "'Poppins',system-ui,sans-serif",
      'Oswald':           "'Oswald',system-ui,sans-serif",
      'JetBrains Mono':   "'JetBrains Mono','Courier New',monospace",
      'Pacifico':         "Pacifico,cursive",
      'Playfair Display': "'Playfair Display',Georgia,serif",
      'Dancing Script':   "'Dancing Script',cursive",
      'Bebas Neue':       "'Bebas Neue',Impact,sans-serif",
      'Syne':             "Syne,system-ui,sans-serif"
    };
    return map[name] || 'system-ui,sans-serif';
  }

  /* ── init ───────────────────────────────────────────────────────────────── */
  function boot() {
    cacheDom();
    if (D.pinForm) D.pinForm.addEventListener('submit', onPinSubmit);
    document.addEventListener('keydown', onKey);
    checkAuth();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
`;

// ─── HTML builder ────────────────────────────────────────────────────────────

function buildPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="format-detection" content="telephone=no">
<meta name="robots" content="noindex,nofollow">
<title>FrameTV</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@700&family=Oswald:wght@700&family=Bebas+Neue&family=Pacifico&family=Playfair+Display:wght@700&family=Dancing+Script:wght@700&family=Syne:wght@700&family=JetBrains+Mono:wght@700&display=swap">
<style>${CSS}</style>
</head>
<body>

<!-- Loading (shown immediately) -->
<div id="ftv-loading">
  <div class="ftv-spinner"></div>
  <p id="ftv-load-msg"></p>
</div>

<!-- PIN gate (hidden until auth check fails) -->
<div id="ftv-pin-gate" style="display:none">
  <div class="ftv-pin-wrap">
    <div class="ftv-logo">&#128250;</div>
    <h1 class="ftv-title">FrameTV</h1>
    <p class="ftv-subtitle">Enter your display PIN to continue</p>
    <form id="ftv-pin-form" autocomplete="off" novalidate>
      <input
        id="ftv-pin-user"
        class="ftv-input"
        type="text"
        placeholder="Username or email"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        required
      >
      <input
        id="ftv-pin-code"
        class="ftv-input ftv-input-pin"
        type="tel"
        inputmode="numeric"
        pattern="[0-9]*"
        placeholder="&#8212; &#8212; &#8212; &#8212; &#8212; &#8212;"
        maxlength="6"
        required
      >
      <p id="ftv-pin-error" class="ftv-error" role="alert"></p>
      <button class="ftv-btn" type="submit">&#9654;&#xFE0E;&nbsp;&nbsp;View Display</button>
    </form>
  </div>
</div>

<!-- Display canvas (hidden until photos are ready) -->
<div id="ftv-display" style="display:none">
  <!-- Two layers crossfade — only one is visible at a time -->
  <img id="ftv-img-a" class="ftv-photo" alt="">
  <img id="ftv-img-b" class="ftv-photo" alt="">
  <!-- Clock overlay / fullscreen clock -->
  <div id="ftv-clock" style="display:none" aria-live="off">
    <span id="ftv-clock-txt"></span>
  </div>
</div>

<script>${JS}</script>
</body>
</html>`;
}

// ─── Route handler ───────────────────────────────────────────────────────────

export function GET() {
  return new Response(buildPage(), {
    headers: {
      'Content-Type':           'text/html; charset=utf-8',
      'Cache-Control':          'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
