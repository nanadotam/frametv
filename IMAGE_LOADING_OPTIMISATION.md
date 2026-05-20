# Image Loading Optimisation Recommendations

> Written for FrameTV — prioritised for slow/metered connections (Ghana context).  
> Each section shows **what to change**, **where in the code**, and **expected impact**.

---

## Executive Summary

The app already has progressive loading in grid and slideshow-single modes. The gaps are:

- Pinterest mode loads 1200 px images eagerly with no skeleton
- Every Drive image makes a round-trip through a Next.js proxy (`/api/photos/[id]/thumbnail`) instead of going straight to Google's CDN
- No network-aware quality switching
- Admin album grid and cover art load full thumbnails eagerly
- No `<img loading="lazy">` on the display page itself (only admin)
- Service-worker cache is large but images are never pre-warmed before the display session begins

Fixing these in order will have the most impact on slow connections.

---

## 1. Remove the Proxy Hop for Drive Thumbnails (Highest Impact)

**Current behaviour**  
Every image on the display page goes:

```
Browser → /api/photos/[id]/thumbnail (Next.js) → drive.google.com → back to browser
```

This doubles the latency and blocks the Node.js function slot for the duration of the fetch.

**Recommendation**  
Store the raw Google Drive thumbnail URL in the database at sync time (already done in `sync.ts` line 95) and serve it directly from the client instead of proxying.

For images that need a size parameter, construct the URL client-side:

```ts
// lib/drive/urls.ts
export function driveThumbnailUrl(fileId: string, size = 400) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

export function driveFullUrl(fileId: string) {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}
```

Then in each mode component, call this directly instead of hitting `/api/photos/[id]/thumbnail`.

The proxy can remain for uploaded (Supabase-stored) photos since those legitimately need a redirect. Add a `source` field discriminator on the `Photo` type so components can branch.

**Files to change**  
- `src/lib/drive/urls.ts` — new file  
- `src/app/(display)/display/` — all mode components  
- `src/app/(admin)/admin/albums/[id]/page.tsx` line 215  
- `src/app/(admin)/admin/albums/page.tsx` line 190

**Expected gain**: 1–3 seconds faster first image on a slow connection (removes a full server round-trip per image).

---

## 2. Tiered Thumbnail Sizes — Match Size to Purpose

**Current sizes in use**

| Mode | Thumbnail | Hi-res |
|---|---|---|
| Slideshow Single | 800 px | 2000 px |
| Grid | 200 px (AR measure) → 800 px | 2000 px |
| Pinterest | 1200 px | — |
| CoverFlow | not checked | — |
| Admin album grid | default (no explicit size) | — |

**Recommendation**

Define a single constants file and use the smallest size that looks good for the screen size:

```ts
// lib/image-sizes.ts
export const IMG_SIZES = {
  placeholder: 40,     // blurred background / LQIP
  thumb_small: 200,    // AR measurement, admin grid
  thumb_medium: 600,   // grid cells on 1080p
  thumb_large: 1200,   // single slideshow first load
  full: 2000,          // hi-res upgrade
} as const;
```

Specific changes:
- **Pinterest mode** (`PinterestMode.tsx` line 42): drop from 1200 → 600. Pinterest rows are ~300 px tall on a 1080p screen — 1200 px is wasted.
- **Grid mode hi-res** (`SlideshowGridMode.tsx` line 50): a 2000 px image in a cell that is 400 px wide wastes bandwidth. Use `Math.round(cellWidth * 1.5)` as the target size so it adapts to actual layout.
- **Admin album grid**: add `?size=200` to thumbnail URLs — these are small thumbnails, not display images.

**Expected gain**: Pinterest bandwidth drops ~75%. Grid hi-res drops 50–70% on typical layouts.

---

## 3. Fix Pinterest Mode — Add Progressive Loading and Skeleton

**Current behaviour**  
`PinterestMode.tsx` line 75 uses `loading="eager"` and waits for all images to load before beginning the scroll animation. On a slow connection the screen is blank for several seconds.

**Recommendation**

Step 1 — show a skeleton while images load:

```tsx
// Before the track is ready, show a blurred placeholder row
{!trackReady && (
  <div className="h-full w-full flex items-center justify-center">
    <div className="w-12 h-12 rounded-full bg-white/20 animate-pulse" />
  </div>
)}
```

Step 2 — load in two stages (same pattern already used in grid/single modes):

```ts
const THUMB_SIZE = 300;   // load this first
const DISPLAY_SIZE = 600; // upgrade once thumb is painted
```

Step 3 — change `loading="eager"` to `loading="lazy"` so off-screen row images don't block the first visible row.

**Files to change**: `src/app/(display)/display/components/pinterest/PinterestMode.tsx`

---

## 4. Low-Quality Image Placeholder (LQIP) on Every Mode

**What is LQIP?**  
A 40 px blurred version of the image is fetched first (tiny — a few KB). It fills the cell immediately as a blurred background while the real image loads. Removes the "blank cell" flash.

**Current state**  
Grid mode already fetches a 200 px AR-measurement image. That image can double as the LQIP — just render it blurred behind the real image until the real image paints.

```tsx
// In SlideshowGridMode.tsx cell render
<div style={{ position: 'relative', overflow: 'hidden' }}>
  {/* LQIP — always visible */}
  <img
    src={driveThumbnailUrl(photo.driveFileId, 40)}
    style={{ filter: 'blur(20px)', transform: 'scale(1.1)', position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    aria-hidden
  />
  {/* Real image fades in over LQIP */}
  <img
    src={thumbSrc}
    style={{ position: 'relative', opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.4s' }}
    onLoad={() => setImageLoaded(true)}
  />
</div>
```

**Expected gain**: Cells look filled instantly instead of blank on slow connections — huge perceived performance improvement.

---

## 5. Network-Aware Quality Switching

The browser exposes connection speed via the Network Information API. Use it to skip the hi-res upgrade on slow connections:

```ts
// lib/network.ts
export function getConnectionSpeed(): 'slow' | 'fast' {
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
  const type = nav.connection?.effectiveType;
  return type === '2g' || type === 'slow-2g' ? 'slow' : 'fast';
}
```

Then in grid/single mode:

```ts
const hiResSize = getConnectionSpeed() === 'slow' ? 800 : 2000;
```

On a slow connection, skip the 2000 px fetch entirely — the 800 px version looks perfectly fine on most screens.

**Files to add**: `src/lib/network.ts`  
**Files to change**: `SlideshowSingleMode.tsx`, `SlideshowGridMode.tsx`

---

## 6. Preload the Next Album's First Image

When the user is viewing one album, the next album switch will show a blank screen for 1–3 seconds. Fix this by preloading the first image of the next album in the background when the current one is fully loaded:

```ts
// After current album's first image loads
function preloadNextAlbumCover(photos: Photo[]) {
  if (!photos[0]) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = driveThumbnailUrl(photos[0].driveFileId, 600);
  document.head.appendChild(link);
}
```

---

## 7. Service Worker Pre-warming on Display Wake

**Current state**  
The PWA service worker caches images as they are first seen. On a cold start after overnight sleep, the first cycle is always slow.

**Recommendation**  
When the display page loads, fetch the first 10 thumbnail URLs in the background using `fetch()` with `{priority: 'low'}`. The SW will cache them so they are ready before the first transition:

```ts
// In display/page.tsx useEffect on mount
async function warmCache(photos: Photo[]) {
  for (const photo of photos.slice(0, 10)) {
    fetch(driveThumbnailUrl(photo.driveFileId, 600), { priority: 'low' }).catch(() => {});
  }
}
```

This runs silently in the background and does not block rendering.

---

## 8. Admin Album Grid — Reduce Unnecessary Bandwidth

**Current behaviour**  
`albums/[id]/page.tsx` line 215 loads each photo at the default thumbnail proxy size (no explicit `?size=` parameter). With 100 photos that's 100 HTTP requests and potentially 100 × 400 KB = 40 MB.

**Recommendations**

1. Add explicit `?size=200` to all admin grid thumbnail requests — these are small grid cells, they don't need more.
2. Add `loading="lazy"` to all admin `<img>` tags (already done on line 215 — verify it's also in the albums list page `albums/page.tsx` line 190).
3. Paginate the admin album grid — currently loads up to 1000 photos at once (`/api/photos?limit=1000`). Reduce to 50 with infinite scroll or page buttons.

---

## 9. Use `next/image` for Admin Pages

The admin pages (`/admin/albums`, `/admin/settings`) do not use the Next.js `<Image>` component. `next/image` automatically:

- Serves WebP/AVIF (30–50% smaller than JPEG)
- Generates correct `srcset` for the device's DPR
- Lazy-loads by default

Switch admin `<img>` tags to `<Image from 'next/image'>` with explicit `width` and `height`. The display page's mode components should stay as raw `<img>` since they need precise control over progressive loading.

---

## 10. Compress Photos at Sync Time (Optional — Bigger Project)

If storage permits, when syncing from Drive, store a pre-generated 800 px JPEG alongside the full Drive URL in the database. This would be served from Supabase Storage (same region as the database) rather than Google Drive, which is often faster and more reliable on African networks.

This is a bigger change but would remove the dependency on Google Drive CDN latency for display-critical images.

---

## Priority Order

| # | Change | Effort | Impact |
|---|---|---|---|
| 1 | Remove proxy hop for Drive thumbnails | Medium | Very High |
| 2 | Fix Pinterest mode (skeleton + smaller size) | Small | High |
| 3 | Tiered sizes via `IMG_SIZES` constants | Small | High |
| 4 | LQIP blurred placeholders in all modes | Medium | High |
| 5 | Network-aware quality switching | Small | Medium |
| 6 | Preload next album cover | Small | Medium |
| 7 | Admin album grid pagination + size=200 | Medium | Medium |
| 8 | Service worker pre-warming | Small | Medium |
| 9 | `next/image` for admin pages | Medium | Low-Medium |
| 10 | Pre-compressed photos in Supabase Storage | Large | High (long term) |

---

## Quick Wins (Do First)

These three changes take under an hour combined and will be immediately felt on slow connections:

1. Add `?size=600` to Pinterest mode thumbnail URL (one line change, `PinterestMode.tsx:42`)
2. Add `?size=200` to admin album grid thumbnail URLs
3. Add the `getConnectionSpeed()` helper and gate hi-res upgrades behind it in grid + single modes
