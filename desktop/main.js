// Mantel for Mac — a small companion around the Mantel website:
//   • first-run onboarding (local, animated)
//   • the website itself (account, library, looks, devices)
//   • a guided screensaver setup that installs the bundled Mantel.saver
//     and connects it to the signed-in account.

const { app, BrowserWindow, ipcMain, shell, Menu, net, session, clipboard, nativeTheme } = require('electron');
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

const local = (page) => path.join(__dirname, 'ui', page);

function createWindow() {
  win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 400,
    minHeight: 600,
    title: 'Mantel',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#f2f2f7',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Keep Mantel pages in the window; everything else opens in the browser.
  const isInternal = (url) => url.startsWith(SITE_ORIGIN) || url.startsWith('file://');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('mantel://')) {
      event.preventDefault();
      return;
    }
    if (!isInternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // The site adds space for the traffic lights when it sees this.
  win.webContents.on('dom-ready', () => {
    if (win.webContents.getURL().startsWith(SITE_ORIGIN)) {
      win.webContents.insertCSS('header.sticky, main > div:first-child { padding-top: 0; } body { -webkit-user-select: none; } input, textarea { -webkit-user-select: text; }');
    }
  });

  const state = readState();
  if (!state.onboarded) win.loadFile(local('onboarding.html'));
  else win.loadURL(`${SITE}/admin`);
}

function openSite(pathname) {
  if (!win) createWindow();
  win.loadURL(`${SITE}${pathname}`);
}

function openSetup() {
  if (!win) createWindow();
  win.loadFile(local('setup.html'));
}

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
  return { ...status, account };
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
  return { ok: true };
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
        { label: 'Back', accelerator: 'Cmd+[', click: () => win?.webContents.navigationHistory.goBack() },
        { label: 'Reload', accelerator: 'Cmd+R', click: () => win?.webContents.reload() },
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
  app.on('open-url', (event) => {
    event.preventDefault();
    if (win) win.focus();
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
      await w.loadFile(local(process.env.MANTEL_PAGE || 'onboarding.html'));
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
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
