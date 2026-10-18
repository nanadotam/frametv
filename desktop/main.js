// Mantel for Mac — a small companion around the Mantel website:
//   • first-run onboarding (local, animated)
//   • the website itself (account, library, looks, devices)
//   • a guided screensaver setup that installs the bundled Mantel.saver
//     and connects it to the signed-in account.

const { app, BaseWindow, WebContentsView, BrowserWindow, ipcMain, shell, Menu, net, session, clipboard, nativeTheme } = require('electron');
const fs = require('fs');
const path = require('path');
const saver = require('./lib/screensaver');

const SITE = process.env.MANTEL_URL || 'https://mantelapp.vercel.app';
const SITE_ORIGIN = new URL(SITE).origin;
const RELEASES_API = 'https://api.github.com/repos/nanadotam/frametv/releases/latest';
const STATE_FILE = () => path.join(app.getPath('userData'), 'state.json');

let win = null;

// ── Small persisted state ────────────────────────────────────────────────────

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(patch) {
  const next = { ...readState(), ...patch };
  fs.mkdirSync(path.dirname(STATE_FILE()), { recursive: true });
  fs.writeFileSync(STATE_FILE(), JSON.stringify(next));
  return next;
}

// ── Window ───────────────────────────────────────────────────────────────────
// A BaseWindow holding two views: a slim native-feeling toolbar (back,
// forward, home, reload, screensaver) and the content below it, so the
// toolbar never overlaps the website's own layout.

const local = (page) => path.join(__dirname, 'ui', page);
const TOOLBAR_HEIGHT = 46;

let toolbar = null;
let view = null;

function layout() {
  if (!win) return;
  const [width, height] = win.getContentSize();
  const onboarding = view.webContents.getURL().endsWith('onboarding.html');
  const bar = onboarding ? 0 : TOOLBAR_HEIGHT;
  toolbar.setBounds({ x: 0, y: 0, width, height: bar });
  view.setBounds({ x: 0, y: bar, width, height: height - bar });
}

function sendToolbarState() {
  if (!toolbar || !view) return;
  const wc = view.webContents;
  const url = wc.getURL();
  let section = 'Mantel';
  if (url.endsWith('setup.html')) section = 'Screensaver setup';
  else if (url.startsWith(SITE_ORIGIN)) {
    const p = new URL(url).pathname;
    section =
      p === '/admin' ? 'Now' :
      p.startsWith('/admin/albums') ? 'Library' :
      p.startsWith('/admin/modes') ? 'Looks' :
      p.startsWith('/admin/devices') ? 'Devices' :
      p.startsWith('/admin/settings') ? 'Settings' :
      p.startsWith('/help') ? 'Help' :
      wc.getTitle().replace(/ · Mantel$/, '') || 'Mantel';
  }
  toolbar.webContents.send('toolbar:state', {
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward(),
    loading: wc.isLoading(),
    section,
  });
  layout();
}

function createWindow() {
  win = new BaseWindow({
    width: 1120,
    height: 760,
    minWidth: 400,
    minHeight: 600,
    title: 'Mantel',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#f2f2f7',
    show: false,
  });

  toolbar = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'preload-toolbar.js'), contextIsolation: true, sandbox: true },
  });
  view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  toolbar.setBackgroundColor('#00000000');
  win.contentView.addChildView(view);
  win.contentView.addChildView(toolbar);
  toolbar.webContents.loadFile(local('toolbar.html'));
  win.on('resize', layout);
  win.on('closed', () => {
    win = null;
    toolbar = null;
    view = null;
  });

  const wc = view.webContents;
  wc.once('did-finish-load', () => win?.show());

  // Keep Mantel pages in the window; everything else opens in the browser.
  const isInternal = (url) => url.startsWith(SITE_ORIGIN) || url.startsWith('file://');
  wc.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    if (url.startsWith('mantel://')) {
      event.preventDefault();
      return;
    }
    if (!isInternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  // No internet (or the site is unreachable): show a friendly offline page
  // that reconnects by itself, instead of Chromium's error screen.
  const NETWORK_ERRORS = new Set([-21, -100, -101, -102, -104, -105, -106, -109, -118, -130, -137, -324]);
  wc.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || !NETWORK_ERRORS.has(code) || !url.startsWith(SITE_ORIGIN)) return;
    const back = new URL(url).pathname + new URL(url).search;
    wc.loadFile(local('offline.html'), { query: { back } });
  });

  for (const ev of ['did-navigate', 'did-navigate-in-page', 'did-start-loading', 'did-stop-loading', 'did-finish-load', 'dom-ready', 'page-title-updated']) {
    wc.on(ev, sendToolbarState);
  }
  toolbar.webContents.on('did-finish-load', sendToolbarState);

  const state = readState();
  if (!state.onboarded) wc.loadFile(local('onboarding.html'));
  else wc.loadURL(`${SITE}/admin`);
  layout();

  // Dev aid: MANTEL_CAPTURE=dir saves the toolbar and page, then quits.
  if (process.env.MANTEL_CAPTURE) {
    setTimeout(async () => {
      const dir = process.env.MANTEL_CAPTURE;
      fs.writeFileSync(path.join(dir, 'toolbar.png'), (await toolbar.webContents.capturePage()).toPNG());
      fs.writeFileSync(path.join(dir, 'page.png'), (await view.webContents.capturePage()).toPNG());
      app.quit();
    }, 7000);
  }
}

function openSite(pathname) {
  if (!win) createWindow();
  view.webContents.loadURL(`${SITE}${pathname}`);
}

function openSetup() {
  if (!win) createWindow();
  view.webContents.loadFile(local('setup.html'));
}

ipcMain.on('toolbar:action', (event, action) => {
  if (!view || event.sender !== toolbar?.webContents) return;
  if (action === 'ready') return sendToolbarState();
  const wc = view.webContents;
  if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  if (action === 'reload') wc.reload();
  if (action === 'home') openSite('/admin');
  if (action === 'setup') openSetup();
  if (action === 'help') openSite('/help');
  if (action === 'zoom') win?.isMaximized() ? win.unmaximize() : win?.maximize();
});

// ── IPC (local pages only for the powerful calls) ────────────────────────────

const fromLocal = (event) => event.senderFrame?.url?.startsWith('file://');

ipcMain.handle('mantel:site', () => SITE);
ipcMain.handle('mantel:finish-onboarding', (event, { next }) => {
  writeState({ onboarded: true });
  openSite(next === 'signup' ? '/signup?next=/welcome' : '/login?next=/admin');
});
ipcMain.handle('mantel:open-setup', () => openSetup());
ipcMain.handle('mantel:open-site', (event, pathname = '/admin') => openSite(String(pathname).startsWith('/') ? pathname : '/admin'));

ipcMain.handle('mantel:saver-status', async (event) => {
  if (!fromLocal(event)) return null;
  const [status, account] = await Promise.all([saver.status(app), whoAmI()]);
  // Fall back to our own record of a successful connect, in case macOS
  // won't let us read the screensaver's settings back.
  const connected = status.connected || (!!readState().saverConnectedAt && status.installed);
  return { ...status, connected, account };
});

ipcMain.handle('mantel:install-saver', async (event) => {
  if (!fromLocal(event)) throw new Error('Not allowed');
  await saver.install(app);
  return saver.status(app);
});

ipcMain.handle('mantel:connect-saver', async (event) => {
  if (!fromLocal(event)) throw new Error('Not allowed');
  const res = await net.fetch(`${SITE}/api/screensaver/authorize`, { method: 'POST', credentials: 'include' });
  if (res.status === 401) return { needsSignIn: true };
  if (!res.ok) throw new Error('Mantel couldn’t create a screensaver link. Check your internet connection.');
  const { token, deviceToken } = await res.json();
  await saver.connect({ origin: SITE_ORIGIN, token, deviceToken });
  writeState({ saverConnectedAt: new Date().toISOString() });
  return { ok: true, code: await newConnectCode() };
});

// A short code the Options panel can redeem if it still asks to sign in.
async function newConnectCode() {
  try {
    const res = await net.fetch(`${SITE}/api/screensaver/code`, { method: 'POST', credentials: 'include' });
    return res.ok ? (await res.json()).code : null;
  } catch {
    return null;
  }
}
ipcMain.handle('mantel:connect-code', (event) => (fromLocal(event) ? newConnectCode() : null));

// macOS marketing version from the Darwin kernel version (Darwin 25 = macOS 26).
ipcMain.handle('mantel:macos', () => {
  const darwin = Number(require('os').release().split('.')[0]);
  return darwin >= 25 ? darwin + 1 : darwin >= 20 ? darwin - 9 : 10 + (darwin - 4) / 10;
});
ipcMain.handle('mantel:open-settings-pane', (event, pane) => {
  if (!fromLocal(event)) return;
  const urls = {
    wallpaper: 'x-apple.systempreferences:com.apple.Wallpaper-Settings.extension',
    screensaver: 'x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension',
    legacy: 'x-apple.systempreferences:com.apple.preference.desktopscreeneffect',
  };
  return shell.openExternal(urls[pane] || urls.screensaver);
});

ipcMain.handle('mantel:open-screensaver-settings', (event) => fromLocal(event) && saver.openSettings());
ipcMain.handle('mantel:open-privacy', (event) => fromLocal(event) && saver.openPrivacy());
ipcMain.handle('mantel:preview', (event) => fromLocal(event) && saver.preview());
ipcMain.handle('mantel:copy', (event, text) => clipboard.writeText(String(text)));
ipcMain.handle('mantel:sign-in', () => openSite(`/login?next=${encodeURIComponent('/app/return')}`));

async function whoAmI() {
  try {
    const res = await net.fetch(`${SITE}/api/auth/me`, { credentials: 'include' });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.kind === 'admin' ? { name: j.user?.name, email: j.user?.email } : null;
  } catch {
    return null;
  }
}

// ── Update check (unsigned apps can't self-update; we point at the download) ─

async function checkForUpdate() {
  try {
    const res = await net.fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    const { tag_name } = await res.json();
    const latest = String(tag_name || '').replace(/^[^\d]*/, '');
    if (latest && latest !== app.getVersion() && latest.localeCompare(app.getVersion(), undefined, { numeric: true }) > 0) {
      writeState({ updateAvailable: latest });
    } else {
      writeState({ updateAvailable: null });
    }
  } catch {
    /* offline */
  }
}
ipcMain.handle('mantel:update', () => readState().updateAvailable ?? null);

// ── Menu ─────────────────────────────────────────────────────────────────────

function buildMenu() {
  const template = [
    {
      label: 'Mantel',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Set Up Screensaver…', accelerator: 'Cmd+Shift+S', click: openSetup },
        { label: 'Preview Screensaver', click: () => saver.preview() },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'Go',
      submenu: [
        { label: 'Now', accelerator: 'Cmd+1', click: () => openSite('/admin') },
        { label: 'Library', accelerator: 'Cmd+2', click: () => openSite('/admin/albums') },
        { label: 'Looks', accelerator: 'Cmd+3', click: () => openSite('/admin/modes') },
        { label: 'Devices', accelerator: 'Cmd+4', click: () => openSite('/admin/devices') },
        { label: 'Settings', accelerator: 'Cmd+,', click: () => openSite('/admin/settings') },
        { type: 'separator' },
        { label: 'Back', accelerator: 'Cmd+[', click: () => view?.webContents.navigationHistory.goBack() },
        { label: 'Forward', accelerator: 'Cmd+]', click: () => view?.webContents.navigationHistory.goForward() },
        { label: 'Home', accelerator: 'Cmd+Shift+H', click: () => openSite('/admin') },
        { label: 'Reload', accelerator: 'Cmd+R', click: () => view?.webContents.reload() },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Mantel Help', click: () => openSite('/help') },
        { label: 'Open Mantel in Browser', click: () => shell.openExternal(SITE) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAsDefaultProtocolClient('mantel');
  // mantel://setup and mantel://looks come from the screensaver's Options panel.
  const handleUrl = (url) => {
    const target = String(url).replace(/^mantel:\/\//, '').split(/[/?#]/)[0];
    const go = () => {
      if (target === 'setup') openSetup();
      else if (target === 'looks') openSite('/admin/modes');
      win?.show();
      win?.focus();
      app.focus({ steal: true });
    };
    app.isReady() ? go() : app.whenReady().then(go);
  };
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleUrl(url);
  });
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  // Dev aid: MANTEL_SNAPSHOT=out.png MANTEL_PAGE=setup.html renders one
  // page off-screen, saves a PNG and quits.
  if (process.env.MANTEL_SNAPSHOT) {
    app.whenReady().then(async () => {
      const w = new BrowserWindow({ width: 1120, height: 760, show: false, paintWhenInitiallyHidden: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false } });
      if (process.env.MANTEL_OFFLINE) w.webContents.session.enableNetworkEmulation({ offline: true });
      await w.loadFile(local(process.env.MANTEL_PAGE || 'onboarding.html'), process.env.MANTEL_QUERY ? { query: { back: '/admin' } } : undefined);
      if (process.env.MANTEL_JS) await w.webContents.executeJavaScript(process.env.MANTEL_JS);
      await new Promise((r) => setTimeout(r, 3500));
      fs.writeFileSync(process.env.MANTEL_SNAPSHOT, (await w.webContents.capturePage()).toPNG());
      app.quit();
    });
    return;
  }

  app.whenReady().then(() => {
    // Identify the desktop app to the site (it shows app-specific steps).
    session.defaultSession.setUserAgent(`${session.defaultSession.getUserAgent()} MantelDesktop/${app.getVersion()}`);
    buildMenu();
    createWindow();
    checkForUpdate();
    app.on('activate', () => {
      if (BaseWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
