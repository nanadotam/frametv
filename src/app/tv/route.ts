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
.ftv-link-btn{
  display:block;width:100%;text-align:center;
  background:transparent;border:none;color:rgba(255,255,255,.45);
  font-size:.95rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
  cursor:pointer;font-family:inherit;
  -webkit-appearance:none;-moz-appearance:none;appearance:none;
}
.ftv-pair-code{
  font-family:'Courier New',monospace;font-weight:700;
  letter-spacing:.3em;font-size:3.2rem;text-align:center;
  background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.14);
  border-radius:14px;padding:24px 10px;
}
.ftv-pair-timer{text-align:center;font-size:1rem;color:rgba(255,255,255,.35)}

/* Display ───────────────────────────────────────────────────────────────── */
#ftv-display{
  position:fixed;top:0;right:0;bottom:0;left:0;
  background:#000;
  -webkit-transition:opacity .35s ease;
  transition:opacity .35s ease;
}
.ftv-control{
  position:fixed;right:24px;bottom:24px;z-index:80;
  width:58px;height:58px;border-radius:999px;
  border:1px solid rgba(255,255,255,.18);
  background:rgba(0,0,0,.55);color:#fff;
  font-size:28px;line-height:58px;text-align:center;
  cursor:pointer;
  -webkit-appearance:none;-moz-appearance:none;appearance:none;
}
.ftv-full-prompt{
  position:fixed;top:0;right:0;bottom:0;left:0;z-index:85;
  display:-webkit-box;display:-ms-flexbox;display:flex;
  -webkit-box-align:center;-ms-flex-align:center;align-items:center;
  -webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;
  padding:40px;pointer-events:none;
}
.ftv-full-card{
  width:100%;max-width:440px;text-align:center;
  background:rgba(0,0,0,.68);
  border:1px solid rgba(255,255,255,.16);
  border-radius:24px;
  padding:28px;
  pointer-events:auto;
  box-shadow:0 28px 80px rgba(0,0,0,.5);
}
.ftv-full-card h2{font-size:30px;line-height:1.1;margin-bottom:10px}
.ftv-full-card p{font-size:16px;line-height:1.55;color:rgba(255,255,255,.62);margin-bottom:18px}
.ftv-full-card button{
  width:100%;height:56px;border-radius:14px;border:0;
  background:#fff;color:#000;font-weight:800;letter-spacing:.08em;
  text-transform:uppercase;font-family:inherit;cursor:pointer;
}
.ftv-full-card .ftv-skip{
  display:block;width:auto;height:auto;margin:16px auto 0;
  background:transparent;color:rgba(255,255,255,.48);font-size:12px;
}
.ftv-unsupported{
  position:absolute;top:0;right:0;bottom:0;left:0;
  display:-webkit-box;display:-ms-flexbox;display:flex;
  -webkit-box-align:center;-ms-flex-align:center;align-items:center;
  -webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;
  background:linear-gradient(135deg,#17120e,#302014);
  padding:40px;text-align:center;
}
.ftv-unsupported-card{
  max-width:720px;border:1px solid rgba(255,255,255,.14);
  background:rgba(0,0,0,.32);border-radius:24px;padding:34px;
  box-shadow:0 28px 90px rgba(0,0,0,.35);
}
.ftv-unsupported-card h1{font-size:clamp(34px,5vw,62px);line-height:1.04;margin-bottom:16px}
.ftv-unsupported-card p{font-size:clamp(17px,1.8vw,24px);line-height:1.55;color:rgba(255,255,255,.68)}
.ftv-unsupported-actions{margin-top:24px;display:-webkit-box;display:-ms-flexbox;display:flex;-webkit-box-pack:center;-ms-flex-pack:center;justify-content:center}
.ftv-unsupported-actions a{
  display:inline-block;color:#000;background:#fff;text-decoration:none;
  border-radius:999px;padding:14px 22px;font-weight:800;font-size:14px;
  letter-spacing:.06em;text-transform:uppercase;
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
.ftv-hidden{display:none!important}
.ftv-grid{
  position:absolute;top:0;right:0;bottom:0;left:0;
  display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);
  gap:10px;padding:10px;background:#050505;
}
.ftv-grid img,.ftv-pincol img{
  width:100%;height:100%;object-fit:cover;display:block;background:#111;
}
.ftv-pinterest{
  position:absolute;top:0;right:0;bottom:0;left:0;
  display:-webkit-box;display:-ms-flexbox;display:flex;
  gap:10px;padding:10px;overflow:hidden;background:#050505;
}
.ftv-pincol{
  -webkit-box-flex:1;-ms-flex:1;flex:1;
  display:-webkit-box;display:-ms-flexbox;display:flex;
  -webkit-box-orient:vertical;-webkit-box-direction:normal;
  -ms-flex-direction:column;flex-direction:column;
  gap:10px;
}
.ftv-pincol img{height:34vh;border-radius:16px}
.ftv-vinyl{
  position:absolute;top:0;right:0;bottom:0;left:0;
  display:-webkit-box;display:-ms-flexbox;display:flex;
  -webkit-box-orient:vertical;-webkit-box-direction:normal;
  -ms-flex-direction:column;flex-direction:column;
  -webkit-box-align:center;-ms-flex-align:center;align-items:center;
  -webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;
  overflow:hidden;background:#6b5040;
}
.ftv-vinyl-bg{
  position:absolute;top:0;right:0;bottom:0;left:0;
  background:radial-gradient(ellipse at 35% 20%,rgba(255,255,255,.22),transparent 48%),linear-gradient(155deg,#806044,#2a1c12);
}
.ftv-record{
  position:relative;width:62vmin;height:62vmin;border-radius:50%;
  background:
    repeating-radial-gradient(circle at center,#111 0,#111 2px,#191919 2.8px,#090909 4.2px),
    radial-gradient(circle at center,#1a1a1a 0,#050505 65%,#000 100%);
  box-shadow:0 18px 60px rgba(0,0,0,.45);
  -webkit-animation:ftv-spin 18s linear infinite;
  animation:ftv-spin 18s linear infinite;
}
@-webkit-keyframes ftv-spin{from{-webkit-transform:rotate(0)}to{-webkit-transform:rotate(360deg)}}
@keyframes ftv-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.ftv-label{
  position:absolute;top:50%;left:50%;
  width:62%;height:62%;border-radius:50%;overflow:hidden;
  -webkit-transform:translate(-50%,-50%);transform:translate(-50%,-50%);
  background:rgba(255,255,255,.12);
}
.ftv-label img{width:100%;height:100%;object-fit:cover;display:block}
.ftv-vinyl-title{
  position:relative;text-align:center;margin-top:34px;max-width:78vw;
}
.ftv-vinyl-title h1{font-size:clamp(34px,5vw,68px);line-height:1.05}
.ftv-vinyl-title p{font-size:clamp(20px,2.4vw,34px);color:rgba(255,255,255,.72);margin-top:10px}

/* Scripture ─────────────────────────────────────────────────────────────── */
.ftv-scripture{
  position:absolute;top:0;right:0;bottom:0;left:0;
  display:-webkit-box;display:-ms-flexbox;display:flex;
  -webkit-box-orient:vertical;-webkit-box-direction:normal;
  -ms-flex-direction:column;flex-direction:column;
  -webkit-box-align:center;-ms-flex-align:center;align-items:center;
  -webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;
  overflow:hidden;background:#0a0a0a;text-align:center;
}
.ftv-scripture-bg{position:absolute;top:0;right:0;bottom:0;left:0}
.ftv-scripture-bg img{width:100%;height:100%;object-fit:cover;display:block}
.ftv-scripture-overlay{position:absolute;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.55)}
.ftv-scripture-cross{position:absolute;top:28px;left:28px;opacity:.55}
.ftv-scripture-body{position:relative;padding:8% 14%;max-width:900px;width:100%}
.ftv-scripture-text{
  font-family:Georgia,"Times New Roman",serif;
  font-size:clamp(22px,3vw,46px);
  font-weight:400;line-height:1.65;color:#fff;margin:0;
}
.ftv-scripture-rule{width:36px;height:1px;background:rgba(255,255,255,.35);margin:clamp(14px,2vw,24px) auto}
.ftv-scripture-ref{
  font-family:system-ui,-apple-system,sans-serif;
  font-size:clamp(11px,1.1vw,15px);font-weight:600;
  letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6);margin:0;
}
.ftv-scripture-trans{
  font-family:system-ui,-apple-system,sans-serif;
  font-size:clamp(9px,.75vw,11px);letter-spacing:.08em;color:rgba(255,255,255,.3);margin:5px 0 0;
}
.ftv-scripture-credit{
  position:absolute;bottom:12px;right:16px;
  font-size:10px;color:rgba(255,255,255,.28);font-family:system-ui,-apple-system,sans-serif;
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
  var modeConfig    = {};
  var tPhoto        = null;
  var tPoll         = null;
  var tClock        = null;
  var tSpotify      = null;

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
    D.pinToPair = grab('ftv-pin-to-pair');
    D.pairGate = grab('ftv-pair-gate');
    D.pairCodeEl = grab('ftv-pair-code');
    D.pairTimer = grab('ftv-pair-timer');
    D.pairToPin = grab('ftv-pair-to-pin');
    D.display  = grab('ftv-display');
    D.imgA     = grab('ftv-img-a');
    D.imgB     = grab('ftv-img-b');
    D.grid     = grab('ftv-grid');
    D.pinGrid  = grab('ftv-pinterest');
    D.vinyl    = grab('ftv-vinyl');
    D.vinylBg  = grab('ftv-vinyl-bg');
    D.vinylArt = grab('ftv-vinyl-art');
    D.vinylName = grab('ftv-vinyl-name');
    D.vinylArtist = grab('ftv-vinyl-artist');
    D.unsupported = grab('ftv-unsupported');
    D.unsupportedMode = grab('ftv-unsupported-mode');
    D.fullPrompt = grab('ftv-full-prompt');
    D.fullPromptBtn = grab('ftv-full-prompt-btn');
    D.fullPromptSkip = grab('ftv-full-prompt-skip');
    D.fullPromptMsg = grab('ftv-full-prompt-msg');
    D.scripture        = grab('ftv-scripture');
    D.scriptureBgImg   = grab('ftv-scripture-bg-img');
    D.scriptureOverlay = grab('ftv-scripture-overlay');
    D.scriptureText    = grab('ftv-scripture-text');
    D.scriptureRef     = grab('ftv-scripture-ref');
    D.scriptureTrans   = grab('ftv-scripture-trans');
    D.scriptureCredit  = grab('ftv-scripture-credit');
    D.fullBtn  = grab('ftv-fullscreen');
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

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  }
  function fullscreenSupported() {
    var el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
  }
  function toggleFullscreen() {
    var el = document.documentElement;
    if (fullscreenElement()) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
      return;
    }
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  }

  function dismissFullscreenPrompt() {
    hide(D.fullPrompt);
    try { localStorage.setItem('frametv:tv-fullscreen-prompt-dismissed', '1'); } catch (e) {}
  }

  function showFullscreenPrompt() {
    try {
      if (localStorage.getItem('frametv:tv-fullscreen-prompt-dismissed')) return;
    } catch (e) {}
    if (!D.fullPrompt) return;
    if (!fullscreenSupported() && D.fullPromptMsg) {
      D.fullPromptMsg.textContent = 'Fullscreen is not exposed by this TV browser. Use your TV browser menu if it has a fullscreen option.';
      if (D.fullPromptBtn) hide(D.fullPromptBtn);
    }
    showFlex(D.fullPrompt);
    setTimeout(dismissFullscreenPrompt, 8000);
  }

  function clientId() {
    try {
      var key = 'frametv:display-device-id';
      var existing = localStorage.getItem(key);
      if (existing) return existing;
      var next = String(Date.now()) + '-' + String(Math.random()).slice(2);
      localStorage.setItem(key, next);
      return next;
    } catch (e) {
      return String(Date.now()) + '-' + String(Math.random()).slice(2);
    }
  }

  function heartbeat() {
    var body = JSON.stringify({
      client_id: clientId(),
      label: 'TV display',
      route: '/tv',
      renderer: 'html-tv',
      active_mode_id: modeId,
      viewport_width: window.innerWidth || document.documentElement.clientWidth,
      viewport_height: window.innerHeight || document.documentElement.clientHeight,
      screen_width: window.screen ? window.screen.width : null,
      screen_height: window.screen ? window.screen.height : null,
      device_pixel_ratio: window.devicePixelRatio || 1,
      fullscreen_supported: fullscreenSupported(),
      fullscreen_active: !!fullscreenElement(),
      visibility_state: document.visibilityState || 'visible'
    });
    post('/api/display-devices', body, function () {});
  }

  /* ── auth ───────────────────────────────────────────────────────────────── */
  var pairCode  = null;
  var pairPoll  = null;
  var pairTick  = null;
  var pairBusy  = false;

  function checkAuth() {
    get('/api/auth/me', function (data, ok) {
      if (ok && data && data.user) { launch(); }
      else                         { showPair(); }
    });
  }

  function showPin() {
    stopPairing();
    hide(D.pairGate);
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

  /* ── device pairing (code-only; no QR on this compat renderer) ─────────── */
  function stopPairing() {
    if (pairPoll) { clearInterval(pairPoll); pairPoll = null; }
    if (pairTick) { clearInterval(pairTick); pairTick = null; }
    pairBusy = false;
  }

  function showPair() {
    hide(D.pinGate);
    hide(D.loading);
    showFlex(D.pairGate);
    beginPairing();
  }

  function beginPairing() {
    stopPairing();
    if (D.pairCodeEl) D.pairCodeEl.textContent = '——————';
    if (D.pairTimer) D.pairTimer.textContent = '';
    post('/api/auth/pair/start', null, function (data, ok) {
      if (!ok || !data || !data.code) {
        setTimeout(beginPairing, 4000);
        return;
      }
      pairCode = data.code;
      if (D.pairCodeEl) D.pairCodeEl.textContent = data.code;

      var expiresAt = new Date(data.expires_at).getTime();
      pairTick = setInterval(function () {
        var secs = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
        var m = Math.floor(secs / 60);
        var s = secs % 60;
        if (D.pairTimer) D.pairTimer.textContent = 'Code expires in ' + m + ':' + (s < 10 ? '0' : '') + s;
      }, 1000);

      pairPoll = setInterval(pollPairStatus, 2000);
    });
  }

  function pollPairStatus() {
    if (pairBusy || !pairCode) return;
    get('/api/auth/pair/status?code=' + pairCode, function (data, ok) {
      if (!ok || !data) return;
      if (data.status === 'approved') {
        pairBusy = true;
        stopPairing();
        post('/api/auth/pair/consume', JSON.stringify({ code: pairCode }), function (cData, cOk) {
          if (cOk) {
            hide(D.pairGate);
            showFlex(D.loading);
            launch();
          } else {
            beginPairing();
          }
        });
      } else if (data.status === 'expired' || data.status === 'invalid') {
        beginPairing();
      }
    });
  }

  /* ── boot sequence ──────────────────────────────────────────────────────── */
  function launch() {
    // Clear any timers from a previous session (e.g. user logs out and back in).
    if (tClock) { clearInterval(tClock); tClock = null; }
    if (tPhoto) { clearInterval(tPhoto); tPhoto = null; }
    if (tSpotify) { clearInterval(tSpotify); tSpotify = null; }
    msg('');
    loadState();
    heartbeat();
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
      modeConfig = cfg;
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

      if (!tvSafeModeSupported(modeId)) { showUnsupportedMode(); }
      else if (modeId === 'clock-text') { startClockMode(); }
      else if (modeId === 'vinyl' || modeId === 'coverflow') { startVinylMode(); }
      else if (modeId === 'scripture') { startScriptureMode(); }
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
    showFullscreenPrompt();
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

  function clearVisuals() {
    hide(D.imgA);
    hide(D.imgB);
    hide(D.grid);
    hide(D.pinGrid);
    hide(D.vinyl);
    hide(D.scripture);
    hide(D.unsupported);
    hide(D.clock);
  }

  function tvSafeModeSupported(id) {
    return id === 'slideshow-single' ||
      id === 'slideshow-grid' ||
      id === 'pinterest' ||
      id === 'clock-text' ||
      id === 'vinyl' ||
      id === 'coverflow' ||
      id === 'scripture';
  }

  function showUnsupportedMode() {
    clearVisuals();
    hide(D.loading);
    D.display.style.opacity = (brightness / 100).toFixed(2);
    showBlock(D.display);
    if (D.unsupportedMode) D.unsupportedMode.textContent = modeId || 'This mode';
    showFlex(D.unsupported);
    showFullscreenPrompt();
  }

  function startScriptureMode() {
    clearVisuals();
    hide(D.loading);
    D.display.style.opacity = (brightness / 100).toFixed(2);
    showBlock(D.display);
    showFullscreenPrompt();
    showFlex(D.scripture);

    var translation = (modeConfig && modeConfig.translation) || 'KJV';
    var customMood  = (modeConfig && modeConfig.customMood)  || '';
    var overlayVal  = (modeConfig && typeof modeConfig.overlayOpacity === 'number')
      ? (modeConfig.overlayOpacity / 100).toFixed(2)
      : '0.55';

    if (D.scriptureOverlay) {
      D.scriptureOverlay.style.background = 'rgba(0,0,0,' + overlayVal + ')';
    }

    get('/api/scripture?translation=' + encodeURIComponent(translation), function (data, ok) {
      if (!ok || !data || !data.text) return;
      if (D.scriptureText)  D.scriptureText.textContent  = data.text;
      if (D.scriptureRef)   D.scriptureRef.textContent   = data.reference || '';
      if (D.scriptureTrans) D.scriptureTrans.textContent = data.translation || '';

      var mood = customMood || 'green valley mountains nature peaceful';
      get('/api/unsplash?mood=' + encodeURIComponent(mood), function (uData, uOk) {
        if (!uOk || !uData || !uData.photos || !uData.photos.length) return;
        var now = new Date();
        var dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
        var photo = uData.photos[dayOfYear % uData.photos.length];
        if (!photo) return;
        if (D.scriptureBgImg) D.scriptureBgImg.src = photo.urls.regular;
        if (D.scriptureCredit && photo.user) {
          D.scriptureCredit.textContent = 'Photo: ' + (photo.user.name || '') + ' / Unsplash';
        }
      });
    });
  }

  function startVinylMode() {
    clearVisuals();
    hide(D.loading);
    D.display.style.opacity = (brightness / 100).toFixed(2);
    showBlock(D.display);
    showFullscreenPrompt();
    showFlex(D.vinyl);
    loadSpotifyVinyl();
    if (tSpotify) clearInterval(tSpotify);
    tSpotify = setInterval(loadSpotifyVinyl, 15000);
  }

  function loadSpotifyVinyl() {
    get('/api/spotify/now-playing', function (data, ok) {
      var cur = ok && data && data.current ? data.current : null;
      if (!cur) {
        if (D.vinylName) D.vinylName.textContent = 'Spotify idle';
        if (D.vinylArtist) D.vinylArtist.textContent = 'Last song will appear after playback';
        return;
      }
      if (D.vinylArt && cur.albumArtUrl) D.vinylArt.src = cur.albumArtUrl;
      if (D.vinylName) D.vinylName.textContent = cur.name || '';
      if (D.vinylArtist) D.vinylArtist.textContent = (cur.artists || []).join(', ');
      if (cur.albumArtUrl) sampleImageColor(cur.albumArtUrl);
    });
  }

  function sampleImageColor(src) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var c = document.createElement('canvas');
        c.width = 24; c.height = 24;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 24, 24);
        var data = ctx.getImageData(0, 0, 24, 24).data;
        var r = 0, g = 0, b = 0, n = 0;
        for (var i = 0; i < data.length; i += 16) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
        var light = 'rgb(' + Math.min(255, r + 52) + ',' + Math.min(255, g + 52) + ',' + Math.min(255, b + 52) + ')';
        var base = 'rgb(' + r + ',' + g + ',' + b + ')';
        var dark = 'rgb(' + Math.round(r * .45) + ',' + Math.round(g * .45) + ',' + Math.round(b * .45) + ')';
        if (D.vinylBg) {
          D.vinylBg.style.background = 'radial-gradient(ellipse at 35% 20%,' + light + ' 0%,transparent 48%),linear-gradient(155deg,' + base + ',' + dark + ')';
        }
      } catch (e) { /* CORS can block canvas reads; keep default colors */ }
    };
    img.src = src;
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
    showFullscreenPrompt();
    if (modeId === 'slideshow-grid') {
      startGridMode();
    } else if (modeId === 'pinterest') {
      startPinterestMode();
    } else {
      startSlideshowMode();
    }
    if (clockEnabled) mountClockOverlay();
  }

  function startSlideshowMode() {
    clearVisuals();
    showBlock(D.imgA);
    showBlock(D.imgB);
    advance(0);
    startTimer();
  }

  function startGridMode() {
    clearVisuals();
    renderGrid();
    showBlock(D.grid);
    startTimer();
  }

  function startPinterestMode() {
    clearVisuals();
    renderPinterest();
    showFlex(D.pinGrid);
    startTimer();
  }

  function renderGrid() {
    if (!D.grid || !photos.length) return;
    var html = '';
    for (var i = 0; i < 6; i++) {
      var idx = ((currentIdx + i) % photos.length + photos.length) % photos.length;
      var p = photos[idx];
      html += '<img alt="" src="' + photoSrc(p) + '">';
    }
    D.grid.innerHTML = html;
  }

  function renderPinterest() {
    if (!D.pinGrid || !photos.length) return;
    var cols = Math.max(2, Math.min(5, Number(modeConfig.rows || 3)));
    var html = '';
    for (var c = 0; c < cols; c++) {
      html += '<div class="ftv-pincol">';
      for (var r = 0; r < 5; r++) {
        var idx = ((currentIdx + c + r * cols) % photos.length + photos.length) % photos.length;
        var p = photos[idx];
        html += '<img alt="" src="' + photoSrc(p) + '">';
      }
      html += '</div>';
    }
    D.pinGrid.innerHTML = html;
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
      if (isPaused) return;
      if (modeId === 'slideshow-grid') {
        currentIdx = (currentIdx + 6) % photos.length;
        renderGrid();
      } else if (modeId === 'pinterest') {
        currentIdx = (currentIdx + 3) % photos.length;
        renderPinterest();
      } else {
        advance(currentIdx + 1);
      }
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
          currentIdx = 0;
        } else {
          var dir   = delta > 0 ? 1 : -1;
          var steps = Math.abs(delta);
          currentIdx = currentIdx + dir * steps;
        }
        if (modeId === 'slideshow-grid') renderGrid();
        else if (modeId === 'pinterest') renderPinterest();
        else advance(currentIdx);
      }
      lastSkip = ns;

      if (s.active_mode_id && s.active_mode_id !== modeId) {
        loadState();
      }
      heartbeat();
    });
  }

  /* ── remote / keyboard ──────────────────────────────────────────────────── */
  function onKey(e) {
    var k = e.key || e.keyCode;
    if      (k === 'ArrowRight' || k === 39) {
      if (modeId === 'slideshow-grid') { currentIdx += 6; renderGrid(); }
      else if (modeId === 'pinterest') { currentIdx += 3; renderPinterest(); }
      else if (modeId !== 'clock-text' && modeId !== 'vinyl' && modeId !== 'coverflow' && modeId !== 'scripture') advance(currentIdx + 1);
    }
    else if (k === 'ArrowLeft'  || k === 37) {
      if (modeId === 'slideshow-grid') { currentIdx -= 6; renderGrid(); }
      else if (modeId === 'pinterest') { currentIdx -= 3; renderPinterest(); }
      else if (modeId !== 'clock-text' && modeId !== 'vinyl' && modeId !== 'coverflow' && modeId !== 'scripture') advance(currentIdx - 1);
    }
    else if (k === 'Enter' || k === 13 || k === ' ' || k === 32) { isPaused = !isPaused; }
    else if (k === 'f' || k === 'F' || k === 70) { toggleFullscreen(); }
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
    if (D.pinToPair) D.pinToPair.addEventListener('click', function () { hide(D.pinGate); showPair(); });
    if (D.pairToPin) D.pairToPin.addEventListener('click', showPin);
    if (D.fullBtn) D.fullBtn.addEventListener('click', toggleFullscreen);
    if (D.fullPromptBtn) D.fullPromptBtn.addEventListener('click', function () {
      dismissFullscreenPrompt();
      toggleFullscreen();
    });
    if (D.fullPromptSkip) D.fullPromptSkip.addEventListener('click', dismissFullscreenPrompt);
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', heartbeat);
    document.addEventListener('webkitfullscreenchange', heartbeat);
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
      <button id="ftv-pin-to-pair" class="ftv-link-btn" type="button">Pair with a code instead</button>
    </form>
  </div>
</div>

<!-- Pairing gate (default unauthenticated view) -->
<div id="ftv-pair-gate" style="display:none">
  <div class="ftv-pin-wrap">
    <div class="ftv-logo">&#128250;</div>
    <h1 class="ftv-title">FrameTV</h1>
    <p class="ftv-subtitle">On your phone, sign in and enter this code</p>
    <div id="ftv-pair-code" class="ftv-pair-code">&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;</div>
    <p id="ftv-pair-timer" class="ftv-pair-timer"></p>
    <button id="ftv-pair-to-pin" class="ftv-link-btn" type="button">Sign in with PIN instead</button>
  </div>
</div>

<!-- Display canvas (hidden until photos are ready) -->
<div id="ftv-display" style="display:none">
  <!-- Two layers crossfade — only one is visible at a time -->
  <img id="ftv-img-a" class="ftv-photo" alt="">
  <img id="ftv-img-b" class="ftv-photo" alt="">
  <div id="ftv-grid" class="ftv-grid" style="display:none"></div>
  <div id="ftv-pinterest" class="ftv-pinterest" style="display:none"></div>
  <div id="ftv-unsupported" class="ftv-unsupported" style="display:none">
    <div class="ftv-unsupported-card">
      <h1>Compatibility renderer</h1>
      <p>
        <span id="ftv-unsupported-mode">This mode</span> is not supported by the TV-safe renderer yet.
        Open the full renderer if this TV browser can handle it, or switch to Slideshow from the admin remote.
      </p>
      <div class="ftv-unsupported-actions">
        <a href="/display?full=1">Open full renderer</a>
      </div>
    </div>
  </div>
  <div id="ftv-vinyl" class="ftv-vinyl" style="display:none">
    <div id="ftv-vinyl-bg" class="ftv-vinyl-bg"></div>
    <div class="ftv-record">
      <div class="ftv-label">
        <img id="ftv-vinyl-art" alt="">
      </div>
    </div>
    <div class="ftv-vinyl-title">
      <h1 id="ftv-vinyl-name">Spotify idle</h1>
      <p id="ftv-vinyl-artist">Last song will appear after playback</p>
    </div>
  </div>
  <!-- Scripture mode -->
  <div id="ftv-scripture" class="ftv-scripture" style="display:none">
    <div class="ftv-scripture-bg"><img id="ftv-scripture-bg-img" alt=""></div>
    <div id="ftv-scripture-overlay" class="ftv-scripture-overlay"></div>
    <svg class="ftv-scripture-cross" width="16" height="22" viewBox="0 0 16 22" fill="none">
      <rect x="6" y="0" width="4" height="22" rx="2" fill="white" fill-opacity="0.55"/>
      <rect x="0" y="6" width="16" height="4" rx="2" fill="white" fill-opacity="0.55"/>
    </svg>
    <div class="ftv-scripture-body">
      <p id="ftv-scripture-text" class="ftv-scripture-text"></p>
      <div class="ftv-scripture-rule"></div>
      <p id="ftv-scripture-ref" class="ftv-scripture-ref"></p>
      <p id="ftv-scripture-trans" class="ftv-scripture-trans"></p>
    </div>
    <p id="ftv-scripture-credit" class="ftv-scripture-credit"></p>
  </div>
  <!-- Clock overlay / fullscreen clock -->
  <div id="ftv-clock" style="display:none" aria-live="off">
    <span id="ftv-clock-txt"></span>
  </div>
  <button id="ftv-fullscreen" class="ftv-control" type="button" aria-label="Fullscreen">&#9974;&#xFE0E;</button>
  <div id="ftv-full-prompt" class="ftv-full-prompt" style="display:none">
    <div class="ftv-full-card">
      <h2>Enter fullscreen</h2>
      <p id="ftv-full-prompt-msg">This display looks best without the browser frame.</p>
      <button id="ftv-full-prompt-btn" type="button">Enter fullscreen</button>
      <button id="ftv-full-prompt-skip" class="ftv-skip" type="button">Not now</button>
    </div>
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
