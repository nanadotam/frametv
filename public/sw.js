/* Mantel display service worker — keeps screens showing photos offline.
 *
 * Only the display is cached (/display, /s/<link>, /tv); the rest of the
 * app always goes to the network.
 *
 *   pages + settings JSON   network first (4 s), cached copy when offline
 *   /_next/static           cache first (file names are content-hashed)
 *   photos (any host)       cache first; offline, any cached size of the
 *                           same photo will do
 *
 * The display page also sends a "warm" list of photo URLs so the whole
 * rotation is on disk before the network goes away.
 */

const VERSION = 'mantel-v1';
const PAGES = `${VERSION}-pages`;
const DATA = `${VERSION}-data`;
const STATIC = `${VERSION}-static`;
const MEDIA = `${VERSION}-media`;
const MEDIA_MAX = 1500;

const DISPLAY_PATH = /^\/(display|tv|s\/)/;
const DATA_PATHS = /^\/api\/(display-state|modes|photos(?!\/upload)|settings|schedules|auth\/me|albums|reminders|flipboard|scripture|unsplash|spotify\/now-playing)/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, DATA, STATIC, MEDIA]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirst(request, cacheName, cacheKey, ms = 4000) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([fetch(request), timeout(ms)]);
    if (res && (res.ok || res.type === 'opaqueredirect')) cache.put(cacheKey ?? request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(cacheKey ?? request, { ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

/** Same photo, any size: Drive file id, Supabase object path, or URL minus size params. */
function photoIdentity(url) {
  const u = new URL(url);
  if (u.hostname === 'drive.google.com') return `drive:${u.searchParams.get('id')}`;
  if (u.hostname.endsWith('.supabase.co')) return `sb:${u.pathname.replace('/render/image/', '/object/')}`;
  if (u.pathname.startsWith('/api/photos/')) return `api:${u.pathname.split('/')[3]}`;
  return `${u.origin}${u.pathname}`;
}

async function trimMedia() {
  const cache = await caches.open(MEDIA);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MEDIA_MAX; i++) await cache.delete(keys[i]);
}

let puts = 0;
async function media(request) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok || res.type === 'opaque') {
      await cache.put(request, res.clone());
      if (++puts % 50 === 0) trimMedia();
    }
    return res;
  } catch (err) {
    const id = photoIdentity(request.url);
    for (const key of await cache.keys()) {
      if (photoIdentity(key.url) === id) return cache.match(key);
    }
    throw err;
  }
}

async function fromDisplay(event) {
  if (event.request.mode === 'navigate') return DISPLAY_PATH.test(new URL(event.request.url).pathname);
  const client = event.clientId ? await self.clients.get(event.clientId) : null;
  return !!client && DISPLAY_PATH.test(new URL(client.url).pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Video is streamed with range requests; leave it to the network.
  if (request.destination === 'video' || request.headers.has('range')) return;

  event.respondWith(
    (async () => {
      if (!(await fromDisplay(event))) return fetch(request);

      if (request.mode === 'navigate') {
        // /s/<link> just sets a cookie and redirects to the display; offline,
        // go straight to the cached display.
        if (url.pathname.startsWith('/s/')) {
          try {
            return await Promise.race([fetch(request), timeout(4000)]);
          } catch {
            const hit = await (await caches.open(PAGES)).match('/display');
            return hit ?? Response.error();
          }
        }
        return networkFirst(request, PAGES, url.pathname.startsWith('/tv') ? '/tv' : '/display');
      }
      if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) return cacheFirst(request, STATIC);
      if (url.origin === self.location.origin && DATA_PATHS.test(url.pathname)) return networkFirst(request, DATA);
      if (request.destination === 'image' || /\.(jpe?g|png|webp|avif|gif)$/i.test(url.pathname) || url.hostname === 'drive.google.com') {
        return media(request);
      }
      return fetch(request);
    })().catch(() => Response.error())
  );
});

// { type: 'warm', urls: [...] } from the display: download the rotation in
// the background, a few at a time, skipping anything already cached.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'warm' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      // The display page and its code: the very first visit happens before
      // this worker controls the page, so save them explicitly.
      const pages = await caches.open(PAGES);
      const statics = await caches.open(STATIC);
      if (data.page) {
        const res = await fetch(data.page, { credentials: 'include' }).catch(() => null);
        if (res && res.ok) await pages.put(data.page.startsWith('/tv') ? '/tv' : '/display', res);
      }
      for (const asset of data.assets || []) {
        if (await statics.match(asset)) continue;
        const res = await fetch(asset).catch(() => null);
        if (res && res.ok) await statics.put(asset, res);
      }

      const cache = await caches.open(MEDIA);
      const queue = data.urls.slice(0, MEDIA_MAX);
      const worker = async () => {
        while (queue.length) {
          const url = queue.shift();
          try {
            if (await cache.match(url)) continue;
            const cross = new URL(url, self.location.href).origin !== self.location.origin;
            const res = await fetch(url, cross ? { mode: 'no-cors' } : undefined);
            if (res.ok || res.type === 'opaque') await cache.put(url, res);
          } catch {
            /* offline or gone: try again next session */
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      await trimMedia();
    })()
  );
});
