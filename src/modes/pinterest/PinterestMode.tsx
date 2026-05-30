'use client';

import { useEffect, useRef, useState } from 'react';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import { getPhotoRotation } from '@/lib/photoRotation';
import type { Photo } from '@/types/db';
import { photoThumbUrl, getConnectionSpeed, IMG_SIZES } from '@/lib/image-urls';

interface PinterestConfig {
  rows?: number;
  speed?: number;
  direction?: 'left' | 'right';
  cornerRadius?: number;
  gap?: number;
}

// 4× copies ensures seamless looping regardless of strip width.
const COPIES = 4;
// How many photos each row shows per full rotation before refreshing.
const PHOTOS_PER_ROW = 12;

function getViewportHeight() {
  return typeof window === 'undefined' ? 900 : window.innerHeight;
}

/**
 * Returns a page of photos from `all`, wrapping around as needed.
 * pageIdx 0 = first PHOTOS_PER_ROW × rowCount photos, pageIdx 1 = next set, etc.
 */
function getPage(all: Photo[], pageIdx: number, pageSize: number): Photo[] {
  if (all.length === 0) return [];
  const result: Photo[] = [];
  for (let i = 0; i < pageSize; i++) {
    result.push(all[(pageIdx * pageSize + i) % all.length]);
  }
  return result;
}

/**
 * Warms the HTTP cache for a set of photos so <img> tags load instantly.
 * Uses new Image() so results land in the browser's HTTP cache (not Cache Storage).
 */
function preloadImages(photos: Photo[]) {
  const isSlow = getConnectionSpeed() === 'slow';
  const size = isSlow ? IMG_SIZES.thumb_medium : IMG_SIZES.thumb_large;
  photos.forEach((p) => {
    const img = new Image();
    img.src = photoThumbUrl(p, size);
  });
}

/**
 * Single photo in the scrolling track.
 * Loads a small thumbnail immediately, upgrades to display-quality in background.
 * If the display-quality image was preloaded, it appears with no visible loading delay.
 */
function TrackPhoto({
  photo,
  rowHeightPx,
  cornerRadius,
}: {
  photo: Photo;
  rowHeightPx: number;
  cornerRadius: number;
}) {
  const [naturalWidth, setNaturalWidth] = useState<number | null>(photo.width ?? null);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(photo.height ?? null);
  const [mainLoaded, setMainLoaded] = useState(false);
  const [displaySrc, setDisplaySrc] = useState<string>(() =>
    photoThumbUrl(photo, IMG_SIZES.thumb_small)
  );

  const rotation = getPhotoRotation(photo);
  const lqipSrc = photoThumbUrl(photo, IMG_SIZES.lqip);

  // Upgrade to display-quality in background once mounted.
  // If preloaded, the Image fires onload immediately and skips the blurry phase.
  useEffect(() => {
    const isSlow = getConnectionSpeed() === 'slow';
    const targetSize = isSlow ? IMG_SIZES.thumb_medium : IMG_SIZES.thumb_large;
    const upgradeSrc = photoThumbUrl(photo, targetSize);
    const img = new Image();
    img.onload = () => setDisplaySrc(upgradeSrc);
    img.src = upgradeSrc;
    return () => {
      img.onload = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id]);

  const isSideways = rotation === 90 || rotation === 270;
  const visualWidth = isSideways ? naturalHeight : naturalWidth;
  const visualHeight = isSideways ? naturalWidth : naturalHeight;
  const ratio = visualWidth && visualHeight ? visualWidth / visualHeight : 1;
  const containerW = Math.max(
    Math.round(rowHeightPx * 0.4),
    Math.min(Math.round(rowHeightPx * ratio), Math.round(rowHeightPx * 2.5))
  );

  return (
    <div
      style={{
        height: `${rowHeightPx}px`,
        width: `${containerW}px`,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: `${cornerRadius}px`,
        background: '#111',
      }}
    >
      {/* LQIP blurred fill — shows immediately while real image loads */}
      {!mainLoaded && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lqipSrc}
          aria-hidden
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(12px)',
            transform: 'scale(1.1)',
          }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displaySrc}
        alt=""
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) {
            setNaturalWidth(img.naturalWidth);
            setNaturalHeight(img.naturalHeight);
          }
          setMainLoaded(true);
        }}
        style={{
          position: 'absolute',
          width: isSideways ? `${rowHeightPx}px` : '100%',
          height: isSideways ? `${containerW}px` : '100%',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%)${rotation ? ` rotate(${rotation}deg)` : ''}`,
          objectFit: 'cover',
          imageOrientation: 'from-image',
          maxWidth: 'none',
          display: 'block',
          opacity: mainLoaded ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      />
    </div>
  );
}

export default function PinterestMode({
  config,
  brightness,
  isPaused,
  albumIds,
  onReady,
}: ModeProps) {
  const cfg = config as PinterestConfig & { reverse_direction?: boolean };
  const rowCount = cfg.rows ?? 3;
  const rawSpeed = cfg.speed;
  const speed =
    typeof rawSpeed === 'number'
      ? rawSpeed
      : typeof rawSpeed === 'string'
        ? parseFloat(rawSpeed) || 1
        : 1;
  const direction: 'left' | 'right' =
    typeof cfg.direction === 'string'
      ? cfg.direction
      : cfg.reverse_direction
        ? 'right'
        : 'left';
  const cornerRadius = cfg.cornerRadius ?? 24;
  const gap = cfg.gap ?? 12;

  const { photos: allPhotos } = usePhotoRotation({ albumIds, shuffle: true });
  const [viewportH, setViewportH] = useState(getViewportHeight);

  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Pagination ──────────────────────────────────────────────────────────────
  // Instead of looping the same photos forever, the strip shows one "page" of
  // PHOTOS_PER_ROW photos per row. After every complete rotation (the circular
  // belt makes one full loop), the next page swaps in — already preloaded.

  const pageSize = rowCount * PHOTOS_PER_ROW;
  const [displayPhotos, setDisplayPhotos] = useState<Photo[]>([]);
  const pageIndexRef = useRef(0);
  const nextPhotosRef = useRef<Photo[]>([]);
  const preloadDoneRef = useRef(false); // true once next-page preload is queued
  const allPhotosRef = useRef<Photo[]>([]);
  useEffect(() => {
    allPhotosRef.current = allPhotos;
  }, [allPhotos]);

  // When the full photo list first arrives (or changes), initialise page 0
  // and immediately start preloading page 1.
  useEffect(() => {
    if (allPhotos.length === 0) return;
    pageIndexRef.current = 0;
    preloadDoneRef.current = false;
    rawPosRef.current = [];

    const page0 = getPage(allPhotos, 0, pageSize);
    setDisplayPhotos(page0);

    const page1 = getPage(allPhotos, 1, pageSize);
    nextPhotosRef.current = page1;
    preloadImages(page1);
    preloadDoneRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPhotos, pageSize]);

  useEffect(() => {
    if (displayPhotos.length > 0) onReady?.();
  }, [displayPhotos.length, onReady]);

  // Stable swap function accessed from the RAF loop via a ref.
  // Called once per full rotation to advance to the next page.
  const doSwapRef = useRef(() => {});
  useEffect(() => {
    doSwapRef.current = () => {
      const next = nextPhotosRef.current;
      if (next.length === 0) return;

      pageIndexRef.current += 1;
      rawPosRef.current = []; // all rows restart at 0 for the fresh strip
      preloadDoneRef.current = false;
      setDisplayPhotos([...next]);

      // Queue preload for the page after the one we just swapped in.
      const all = allPhotosRef.current;
      const pSize = rowCount * PHOTOS_PER_ROW;
      const nextNext = getPage(all, pageIndexRef.current + 1, pSize);
      nextPhotosRef.current = nextNext;
      preloadImages(nextNext);
      preloadDoneRef.current = true;
    };
  }, [rowCount]);

  // ── JS animation ────────────────────────────────────────────────────────────
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  // rawPosRef tracks the raw (non-modulo) accumulated pixel position per row.
  // Using raw values lets us detect when row 0 has scrolled exactly cycleWidth
  // pixels — i.e. one full rotation of the circular belt.
  const rawPosRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  useEffect(() => {
    rawPosRef.current = [];
  }, [rowCount]);

  const pxPerSecond = 24 * speed;

  useEffect(() => {
    if (displayPhotos.length === 0) return;

    let lastTs = 0;

    const tick = (ts: number) => {
      rafRef.current = requestAnimationFrame(tick);

      if (isPausedRef.current) {
        lastTs = ts;
        return;
      }
      if (!lastTs) {
        lastTs = ts;
        return;
      }

      const dt = Math.min((ts - lastTs) / 1000, 0.1);
      lastTs = ts;

      let swappedThisFrame = false;

      for (let r = 0; r < rowCount; r++) {
        const track = trackRefs.current[r];
        if (!track) continue;

        const cycleWidth = track.scrollWidth / COPIES;
        if (cycleWidth < 10) continue;

        const prevRaw = rawPosRef.current[r] ?? 0;
        const newRaw = prevRaw + pxPerSecond * dt;
        rawPosRef.current[r] = newRaw;

        // Row 0 is the master: it drives rotation-complete and preload events.
        if (r === 0 && !swappedThisFrame) {
          const prevRotations = Math.floor(prevRaw / cycleWidth);
          const currRotations = Math.floor(newRaw / cycleWidth);

          if (currRotations > prevRotations) {
            // One full rotation complete — swap to the next page.
            swappedThisFrame = true;
            rawPosRef.current = []; // reset positions (doSwap will re-initialise)
            doSwapRef.current();
          }
        }

        const offsetPx = (rawPosRef.current[r] ?? 0) % cycleWidth;

        // Alternate rows scroll in opposite directions for visual depth.
        const rowDir =
          r % 2 === 0
            ? direction === 'left'
              ? -1
              : 1
            : direction === 'left'
              ? 1
              : -1;

        const translateX = rowDir < 0 ? -offsetPx : -(cycleWidth - offsetPx);
        track.style.transform = `translateX(${translateX}px)`;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [displayPhotos.length, rowCount, direction, pxPerSecond]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (displayPhotos.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black">
        <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  const rowHeightPx = Math.floor((viewportH - gap * (rowCount + 1)) / rowCount);

  // Distribute photos round-robin across rows.
  const rows: (typeof displayPhotos)[] = Array.from({ length: rowCount }, () => []);
  displayPhotos.forEach((photo, i) => rows[i % rowCount].push(photo));

  return (
    <div
      className="w-full h-full overflow-hidden bg-black flex flex-col"
      style={{ opacity: brightness / 100, gap: `${gap}px`, padding: `${gap}px` }}
    >
      {rows.map((rowPhotos, rowIdx) => {
        const repeated = Array.from({ length: COPIES }, () => rowPhotos).flat();

        return (
          <div
            key={rowIdx}
            style={{
              height: `${rowHeightPx}px`,
              flexShrink: 0,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              ref={(el) => {
                trackRefs.current[rowIdx] = el;
              }}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: `${gap}px`,
                willChange: 'transform',
              }}
            >
              {repeated.map((photo, imgIdx) => (
                <TrackPhoto
                  key={`${photo.id}-r${rowIdx}-${imgIdx}`}
                  photo={photo}
                  rowHeightPx={rowHeightPx}
                  cornerRadius={cornerRadius}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
