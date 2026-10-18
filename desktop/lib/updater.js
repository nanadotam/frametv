// Self-updater for an ad-hoc signed app (Squirrel.Mac / electron-updater
// need a Developer ID signature, which Mantel doesn't have yet).
//
//   check()  → GitHub's latest release; newer than this build?
//   install()→ download Mantel.dmg, mount it, and hand off to a tiny shell
//              script that waits for Mantel to quit, swaps the app bundle,
//              clears the quarantine flag and relaunches it.

const { app, net, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');

const run = promisify(execFile);
const REPO = 'nanadotam/frametv';
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;

function newer(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

/** { version, notes, url } when a newer release exists, else null. */
async function check() {
  const res = await net.fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const rel = await res.json();
  const version = String(rel.tag_name || '').replace(/^[^\d]*/, '');
  const asset = (rel.assets || []).find((a) => a.name === 'Mantel.dmg');
  const current = process.env.MANTEL_FAKE_VERSION || app.getVersion(); // test hook
  if (!version || !asset || !newer(version, current)) return null;
  return { version, notes: rel.body || '', url: asset.browser_download_url, size: asset.size };
}

/** Where the running app bundle lives (…/Mantel.app). */
function appBundlePath() {
  return path.resolve(app.getPath('exe'), '..', '..', '..');
}

async function download(url, dest, onProgress) {
  const res = await net.fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const out = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value.length;
    if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
    if (total) onProgress(got / total);
  }
  await new Promise((r) => out.end(r));
}

/**
 * Downloads and installs `update`, then quits so the hand-off script can
 * swap the bundle and relaunch. Returns false if this copy can't be
 * replaced in place (e.g. running from the DMG), after opening the
 * download page instead.
 */
async function install(update, onProgress) {
  const target = appBundlePath();
  if (!app.isPackaged || target.startsWith('/Volumes/')) {
    await shell.openExternal('https://mantelapp.vercel.app/download');
    return false;
  }
  try {
    fs.accessSync(path.dirname(target), fs.constants.W_OK);
  } catch {
    await shell.openExternal('https://mantelapp.vercel.app/download');
    return false;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mantel-update-'));
  const dmg = path.join(dir, 'Mantel.dmg');
  await download(update.url, dmg, onProgress);

  const mount = path.join(dir, 'mnt');
  fs.mkdirSync(mount);
  await run('/usr/bin/hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mount, dmg]);
  const staged = path.join(dir, 'Mantel.app');
  await run('/usr/bin/ditto', [path.join(mount, 'Mantel.app'), staged]);
  await run('/usr/bin/hdiutil', ['detach', mount, '-force']).catch(() => {});
  await run('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', staged]).catch(() => {});

  // Swap once we've exited, then relaunch.
  const script = path.join(dir, 'swap.sh');
  fs.writeFileSync(
    script,
    `#!/bin/sh
while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done
rm -rf "${target}.old"
if mv "${target}" "${target}.old"; then
  if mv "${staged}" "${target}"; then rm -rf "${target}.old"; else mv "${target}.old" "${target}"; fi
fi
open "${target}" --args --updated
rm -rf "${dir}"
`
  );
  fs.chmodSync(script, 0o755);
  spawn('/bin/sh', [script], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
  return true;
}

module.exports = { check, install, newer };
