'use client';

import { IMG_SIZES, photoThumbUrl } from '@/lib/image-urls';
import type { Photo } from '@/types/db';

/**
 * Asks the display service worker (public/sw.js) to download every photo
 * in the rotation, so screens keep working when the internet drops. The
 * worker skips anything already cached, so this is cheap to repeat.
 */
export async function warmDisplayCache() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  const worker = reg?.active;
  if (!worker) return;

  const res = await fetch('/api/photos?limit=1000&mediaType=all').catch(() => null);
  if (!res?.ok) return;
  const { photos = [] } = (await res.json()) as { photos?: Photo[] };
  const urls = photos
    .filter((p) => p.media_type !== 'video')
    .map((p) => photoThumbUrl(p, IMG_SIZES.thumb_large));
  const assets = performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((u) => u.startsWith(`${location.origin}/_next/static/`));
  worker.postMessage({ type: 'warm', urls, page: location.pathname + location.search, assets });
}
