'use client';

import { memo, useEffect, useRef, useState } from 'react';
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
// Photos shown per row per page.
const PHOTOS_PER_ROW = 12;
// How many full rotations each belt completes before photos begin rolling over.
const ROTATIONS_BEFORE_SWAP = 2;

function getViewportHeight() {
  return typeof window === 'undefined' ? 900 : window.innerHeight;
}

function getPage(all: Photo[], pageIdx: number, pageSize: number): Photo[] {
  if (all.length === 0) return [];
  const result: Photo[] = [];
  for (let i = 0; i < pageSize; i++) {
    result.push(all[(pageIdx * pageSize + i) % all.length]);
  }
  return result;
}

function preloadImages(photos: Photo[]) {
  const isSlow = getConnectionSpeed() === 'slow';
  const size = isSlow ? IMG_SIZES.thumb_medium : IMG_SIZES.thumb_large;
  photos.forEach((p) => {
    const img = new Image();
    img.src = photoThumbUrl(p, size);
  });
}

/**
 * Single photo slot in the scrolling track.
 * Handles both initial load and seamless in-place photo swaps when the
 * `photo` prop changes — new image loads in the background before revealing.
 */
const TrackPhoto = memo(function TrackPhoto({
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

  // Handles initial mount and every subsequent photo prop change.
  // New photo loads progressively: thumb_small → display-quality.
  // If the display-quality image was preloaded it resolves instantly with no LQIP flash.
  useEffect(() => {
    setMainLoaded(false);
    setNaturalWidth(photo.width ?? null);
    setNaturalHeight(photo.height ?? null);
    setDisplaySrc(photoThumbUrl(photo, IMG_SIZES.thumb_small));

    const isSlow = getConnectionSpeed() === 'slow';
    const targetSize = isSlow ? IMG_SIZES.thumb_medium : IMG_SIZES.thumb_large;
    const upgradeSrc = photoThumbUrl(photo, targetSize);
    const img = new Image();
    img.onload = () => setDisplaySrc(upgradeSrc);
    img.src = upgradeSrc;
    return () => {
      img.onload = null;
    };
    // photo.id is the intentional dep — we only reload when the photo changes,
    // not on every render where photo properties might shift.
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
});

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

  const pageSize = rowCount * PHOTOS_PER_ROW;
  const [displayPhotos, setDisplayPhotos] = useState<Photo[]>([]);

  // Kept in sync with displayPhotos but updated synchronously inside the RAF
  // loop so slot-swap logic always reads the latest version without waiting for
  // a React render cycle.
  const displayPhotosRef = useRef<Photo[]>([]);

  const pageIndexRef = useRef(0);
  const nextPhotosRef = useRef<Photo[]>([]);
  const allPhotosRef = useRef<Photo[]>([]);

  useEffect(() => {
    allPhotosRef.current = allPhotos;
  }, [allPhotos]);

  // ── Rolling-swap state (all refs — mutated only inside RAF tick) ────────────

  // rawPos (pixels) at which the last rolling swap completed, per row.
  // Row 0 is master; rows 1+ follow the same visual cycle.
  const lastSwapAtRef = useRef<number[]>([]);
  // How many photo slots (across all rows, for this column index) have been
  // replaced in the current rolling transition.
  const slotsSwappedRef = useRef(0);
  // Snapshot of the incoming photo set captured at the start of a transition.
  const pendingNextRef = useRef<Photo[]>([]);
  // cycleWidth captured at the start of a transition so mid-swap layout changes
  // (from new photo aspect ratios) don't cause the progress calculation to jump.
  const transitionCycleWidthRef = useRef(0);

  // Initialise page 0 and preload page 1 whenever the full photo list changes.
  useEffect(() => {
    if (allPhotos.length === 0) return;
    pageIndexRef.current = 0;
    rawPosRef.current = [];
    lastSwapAtRef.current = [];
    slotsSwappedRef.current = 0;
    pendingNextRef.current = [];
    transitionCycleWidthRef.current = 0;

    const page0 = getPage(allPhotos, 0, pageSize);
    displayPhotosRef.current = page0;
    setDisplayPhotos(page0);

    const page1 = getPage(allPhotos, 1, pageSize);
    nextPhotosRef.current = page1;
    preloadImages(page1);
  }, [allPhotos, pageSize]);

  useEffect(() => {
    if (displayPhotos.length > 0) onReady?.();
  }, [displayPhotos.length, onReady]);

  // ── JS animation ────────────────────────────────────────────────────────────

  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rawPosRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

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

      for (let r = 0; r < rowCount; r++) {
        const track = trackRefs.current[r];
        if (!track) continue;

        const liveWidth = track.scrollWidth / COPIES;
        if (liveWidth < 10) continue;

        // During a rolling transition, use the captured width so that aspect-
        // ratio changes from incoming photos don't cause the progress to jump.
        const cycleWidth =
          transitionCycleWidthRef.current > 0 ? transitionCycleWidthRef.current : liveWidth;

        const prevRaw = rawPosRef.current[r] ?? 0;
        const newRaw = prevRaw + pxPerSecond * dt;
        rawPosRef.current[r] = newRaw;

        // ── Rolling swap (row 0 is master) ────────────────────────────────────
        if (r === 0) {
          const lastSwapAt = lastSwapAtRef.current[0] ?? 0;
          const rawSince = newRaw - lastSwapAt;

          if (rawSince >= ROTATIONS_BEFORE_SWAP * cycleWidth) {
            // Capture the cycle width once when we first enter the transition.
            if (transitionCycleWidthRef.current === 0) {
              transitionCycleWidthRef.current = liveWidth;
            }

            // Capture the incoming photo set once at transition start.
            if (pendingNextRef.current.length === 0 && nextPhotosRef.current.length > 0) {
              pendingNextRef.current = [...nextPhotosRef.current];
            }

            if (pendingNextRef.current.length > 0) {
              const tw = transitionCycleWidthRef.current;
              // Progress through the "transition rotation" (0 → 1).
              const progress = (rawSince - ROTATIONS_BEFORE_SWAP * tw) / tw;
              // Number of slots that should have been swapped by now.
              const targetSwapped = Math.min(
                Math.ceil(progress * PHOTOS_PER_ROW),
                PHOTOS_PER_ROW
              );

              if (targetSwapped > slotsSwappedRef.current) {
                // Build updated photo array, replacing only the newly due slots.
                // Slots are distributed round-robin: photo at (row r, slot s)
                // lives at index s * rowCount + r in the flat displayPhotos array.
                const current = displayPhotosRef.current;
                const updated = [...current];
                for (let slot = slotsSwappedRef.current; slot < targetSwapped; slot++) {
                  for (let rr = 0; rr < rowCount; rr++) {
                    const idx = slot * rowCount + rr;
                    if (idx < pendingNextRef.current.length) {
                      updated[idx] = pendingNextRef.current[idx];
                    }
                  }
                }
                slotsSwappedRef.current = targetSwapped;

                // Keep ref in sync immediately so the next tick reads fresh data.
                displayPhotosRef.current = updated;
                setDisplayPhotos(updated);

                if (slotsSwappedRef.current >= PHOTOS_PER_ROW) {
                  // All slots rolled over — transition complete.
                  lastSwapAtRef.current[0] = newRaw;
                  transitionCycleWidthRef.current = 0;
                  slotsSwappedRef.current = 0;
                  pendingNextRef.current = [];

                  // Advance page index and preload the next-next set.
                  pageIndexRef.current += 1;
                  const all = allPhotosRef.current;
                  const pSize = rowCount * PHOTOS_PER_ROW;
                  const nextNext = getPage(all, pageIndexRef.current + 1, pSize);
                  nextPhotosRef.current = nextNext;
                  preloadImages(nextNext);
                }
              }
            }
          }
        }

        // Apply scroll transform — use live cycleWidth for the visual offset so
        // the belt stays crisp even as slot widths settle after photo changes.
        const effectiveWidth =
          transitionCycleWidthRef.current > 0 ? transitionCycleWidthRef.current : liveWidth;
        const offsetPx = (rawPosRef.current[r] ?? 0) % effectiveWidth;

        // Alternate rows scroll in opposite directions for visual depth.
        const rowDir =
          r % 2 === 0
            ? direction === 'left'
              ? -1
              : 1
            : direction === 'left'
              ? 1
              : -1;

        const translateX = rowDir < 0 ? -offsetPx : -(effectiveWidth - offsetPx);
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
                  key={`r${rowIdx}-${imgIdx}`}
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
