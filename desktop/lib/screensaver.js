// Installs and configures the bundled Mantel.saver.
//
// The screensaver keeps its settings in ScreenSaverDefaults under the
// module name "FrameTVScreenSaver" (kept from before the rename so existing
// installs keep working). Since Sonoma those live in legacyScreenSaver's
// container, ByHost, keyed by the Mac's hardware UUID.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const run = promisify(execFile);

const HOME = os.homedir();
const SAVERS_DIR = path.join(HOME, 'Library', 'Screen Savers');
const SAVER_NAME = 'Mantel.saver';
const LEGACY_NAMES = ['FrameTVScreenSaver.saver'];
const MODULE = 'FrameTVScreenSaver';
// Every process that may host the screensaver or its Options panel keeps
// its own copy: the screensaver itself (legacyScreenSaver, and its Intel
// twin) and, since macOS 26, the Wallpaper settings extension that shows
// the Options sheet. `null` = the user's own ByHost domain.
const CONTAINERS = [
  'com.apple.ScreenSaver.Engine.legacyScreenSaver',
  'com.apple.ScreenSaver.Engine.legacyScreenSaver.x86-64',
  'com.apple.wallpaper.extension.legacy',
];
const PREF_DIRS = [
  ...CONTAINERS.map((c) => path.join(HOME, 'Library/Containers', c, 'Data/Library/Preferences/ByHost')),
  null,
];
const HOME_BYHOST = path.join(HOME, 'Library/Preferences/ByHost');

/** `defaults` arguments addressing the module's domain in one location. */
function domainArgs(dir, uuid) {
  return dir ? [path.join(dir, `${MODULE}.${uuid}`)] : ['-currentHost', MODULE];
}

function bundledSaverPath(app) {
  return app.isPackaged
    ? path.join(process.resourcesPath, SAVER_NAME)
    : path.join(__dirname, '..', 'saver', SAVER_NAME);
}

const installedPath = () => path.join(SAVERS_DIR, SAVER_NAME);

function bundleVersion(saverPath) {
  try {
    const plist = fs.readFileSync(path.join(saverPath, 'Contents', 'Info.plist'), 'utf8');
    return plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function hardwareUUID() {
  const { stdout } = await run('/usr/sbin/ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']);
  const m = stdout.match(/"IOPlatformUUID" = "([^"]+)"/);
  if (!m) throw new Error('Could not read this Mac’s hardware ID.');
  return m[1];
}

async function isQuarantined(p) {
  try {
    const { stdout } = await run('/usr/bin/xattr', [p]);
    return stdout.includes('com.apple.quarantine');
  } catch {
    return false;
  }
}

async function unquarantine(p) {
  await run('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', p]).catch(() => {});
}

/** Restart the screensaver host so it picks up a new bundle or settings. */
async function restartHost() {
  for (const name of ['legacyScreenSaver', 'legacyScreenSaver-x86_64', 'WallpaperLegacyExtension']) {
    await run('/usr/bin/killall', [name]).catch(() => {});
  }
}

async function status(app) {
  const installed = fs.existsSync(installedPath());
  let connected = false;
  let origin = null;
  try {
    const uuid = await hardwareUUID();
    for (const dir of PREF_DIRS) {
      // Ask cfprefsd (`defaults export`) rather than reading the plist file:
      // a fresh `defaults import` may not be flushed to disk yet.
      if (dir && !fs.existsSync(path.dirname(path.dirname(dir)))) continue;
      const args = domainArgs(dir, uuid);
      const { stdout } = await run('/usr/bin/defaults', [...args.slice(0, -1), 'export', args.at(-1), '-']).catch(() => ({ stdout: '' }));
      if (!stdout) continue;
      const tmp = path.join(os.tmpdir(), `mantel-status-${process.pid}.plist`);
      fs.writeFileSync(tmp, stdout);
      const json = await run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', tmp]).catch(() => ({ stdout: '{}' }));
      fs.rmSync(tmp, { force: true });
      const prefs = JSON.parse(json.stdout || '{}');
      const url = prefs.kScreenSaverURLList?.[0]?.kScreenSaverURL;
      if (url && url.startsWith('http')) {
        connected = true;
        origin = prefs.FrameTVOrigin ?? null;
        break;
      }
    }
  } catch {
    /* treat as not connected */
  }
  return {
    installed,
    quarantined: installed ? await isQuarantined(installedPath()) : false,
    upToDate: installed && bundleVersion(installedPath()) === bundleVersion(bundledSaverPath(app)),
    connected,
    origin,
  };
}

async function install(app) {
  const src = bundledSaverPath(app);
  if (!fs.existsSync(src)) throw new Error('The screensaver is missing from this copy of Mantel. Please download Mantel again.');
  fs.mkdirSync(SAVERS_DIR, { recursive: true });
  for (const name of [SAVER_NAME, ...LEGACY_NAMES]) {
    fs.rmSync(path.join(SAVERS_DIR, name), { recursive: true, force: true });
  }
  fs.cpSync(src, installedPath(), { recursive: true, verbatimSymlinks: true });
  // Files copied out of a downloaded app inherit its quarantine flag; the
  // app is already approved, so lift it here rather than making people
  // use Terminal.
  await unquarantine(installedPath());
  await restartHost();
}

/** Point the screensaver at this account's per-device display link. */
async function connect({ origin, token, deviceToken }) {
  const uuid = await hardwareUUID();
  const prefs = {
    FrameTVOrigin: origin,
    FrameTVDeviceToken: deviceToken,
    kScreenSaverFetchURLs: false,
    kScreenSaverURLList: [{ kScreenSaverURL: `${origin}/s/${token}`, kScreenSaverTime: -1 }],
  };
  const tmp = path.join(os.tmpdir(), `mantel-saver-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(prefs));
  const plist = tmp.replace(/\.json$/, '.plist');
  await run('/usr/bin/plutil', ['-convert', 'xml1', '-o', plist, tmp]);

  let wrote = 0;
  let lastError = null;
  for (const dir of PREF_DIRS) {
    try {
      if (dir) fs.mkdirSync(dir, { recursive: true });
      // `defaults import` goes through cfprefsd, so a running screensaver
      // host doesn't overwrite us with a stale cached copy.
      const args = domainArgs(dir, uuid);
      await run('/usr/bin/defaults', [...args.slice(0, -1), 'import', args.at(-1), plist]);
      wrote++;
    } catch (err) {
      lastError = err;
    }
  }
  // Earlier builds wrote a mis-named copy here; tidy it up.
  fs.rmSync(path.join(HOME_BYHOST, `${MODULE}.${uuid}.${uuid}.plist`), { force: true });
  fs.rmSync(tmp, { force: true });
  fs.rmSync(plist, { force: true });
  if (!wrote) throw lastError ?? new Error('Could not save the screensaver settings.');
  await restartHost();
}

async function openSettings() {
  await run('/usr/bin/open', ['x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension']).catch(() =>
    run('/usr/bin/open', ['-b', 'com.apple.systempreferences'])
  );
}

async function preview() {
  await run('/usr/bin/open', ['-a', 'ScreenSaverEngine']);
}

async function openPrivacy() {
  await run('/usr/bin/open', ['x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension']).catch(() => {});
}

module.exports = { status, install, connect, openSettings, preview, openPrivacy, installedPath };
