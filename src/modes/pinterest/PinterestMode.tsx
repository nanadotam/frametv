'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import { getPhotoRotation } from '@/lib/photoRotation';
import type { Photo } from '@/types/db';
import { photoThumbUrl, getConnectionSpeed, IMG_SIZES } from '@/lib/image-urls';
import InlineVideo from '@/components/display/InlineVideo';

interface PinterestConfig {
  rows?: number;
  speed?: number;
  direction?: 'left' | 'right';
  cornerRadius?: number;
  gap?: number;
  /** Mix the active albums' videos in among the stills */
  multimodal?: boolean;
  /** How long each page of photos stays up before rolling over to the next. */
  intervalSeconds?: number;
}

// 4× copies ensures seamless looping regardless of strip width.
const COPIES = 4;
// Photos shown per row per page.
const PHOTOS_PER_ROW = 12;
const DEFAULT_INTERVAL_SECONDS = 120;
// The roll-over cascades slot by slot across this many seconds.
const ROLLOVER_SECONDS = 8;

/** A page stays up for the interval, or until its longest clip has played once. */
function pageHoldSeconds(page: Photo[], intervalSeconds: number): number {
  const longestClip = page.reduce(
    (max, p) => (p.media_type === 'video' && p.duration_ms ? Math.max(max, p.duration_ms / 1000) : max),
    0
  );
  return Math.max(intervalSeconds, longestClip);
}

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
  isPaused,
}: {
  photo: Photo;
  rowHeightPx: number;
  cornerRadius: number;
  isPaused: boolean;
}) {
  const [videoPlaying, setVideoPlaying] = useState(false);
  const isVideo = photo.media_type === 'video' && Boolean(photo.storage_path);
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
    setVideoPlaying(false);
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
      {/* Videos: the poster above holds the slot; the clip fades in over it */}
      {isVideo && (
        <InlineVideo
          key={photo.id}
          src={photo.storage_path!}
          isPaused={isPaused}
          onPlaying={() => setVideoPlaying(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: videoPlaying ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        />
      )}
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
  const multimodal = cfg.multimodal ?? false;
  const intervalSeconds = Math.max(5, Number(cfg.intervalSeconds) || DEFAULT_INTERVAL_SECONDS);

  const { photos: allPhotos } = usePhotoRotation({
    albumIds,
    shuffle: true,
    mediaType: multimodal ? 'all' : 'image',
  });
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

  // Unpaused seconds the current page has been up, and — once a roll-over
  // has started — seconds into it (-1 = not rolling).
  const pageElapsedRef = useRef(0);
  const rolloverElapsedRef = useRef(-1);
  // How many photo slots (across all rows, for this column index) have been
  // replaced in the current rolling transition.
  const slotsSwappedRef = useRef(0);
  // Snapshot of the incoming photo set captured at the start of a transition.
  const pendingNextRef = useRef<Photo[]>([]);
  // cycleWidth captured at the start of a transition so mid-swap layout changes
  // (from new photo aspect ratios) don't cause the progress calculation to jump.
  const transitionCycleWidthRef = useRef(0);

  // Start at page 0 on first load or when the row count changes. Later list
  // refreshes (refetches, uploads elsewhere) only update the *upcoming* page —
  // resetting here used to swap the whole wall after ~1 s whenever the photo
  // table changed.
  const builtForPageSizeRef = useRef(0);
  useEffect(() => {
    if (allPhotos.length === 0) return;
    const fresh = builtForPageSizeRef.current !== pageSize || displayPhotosRef.current.length === 0;
    if (fresh) {
      builtForPageSizeRef.current = pageSize;
      pageIndexRef.current = 0;
      rawPosRef.current = [];
      pageElapsedRef.current = 0;
      rolloverElapsedRef.current = -1;
      slotsSwappedRef.current = 0;
      pendingNextRef.current = [];
      transitionCycleWidthRef.current = 0;

      const page0 = getPage(allPhotos, 0, pageSize);
      displayPhotosRef.current = page0;
      setDisplayPhotos(page0);
    }

    const upcoming = getPage(allPhotos, pageIndexRef.current + 1, pageSize);
    nextPhotosRef.current = upcoming;
    preloadImages(upcoming);
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
  const intervalSecondsRef = useRef(intervalSeconds);
  useEffect(() => {
    intervalSecondsRef.current = intervalSeconds;
  }, [intervalSeconds]);

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

        const prevRaw = rawPosRef.current[r] ?? 0;
        const newRaw = prevRaw + pxPerSecond * dt;
        rawPosRef.current[r] = newRaw;

        // ── Rolling swap (row 0 is master) ────────────────────────────────────
        if (r === 0) {
          pageElapsedRef.current += dt;
          const hold = pageHoldSeconds(displayPhotosRef.current, intervalSecondsRef.current);

          if (rolloverElapsedRef.current < 0 && pageElapsedRef.current >= hold && nextPhotosRef.current.length > 0) {
            // Capture the incoming set and belt width once, at roll-over start
            rolloverElapsedRef.current = 0;
            pendingNextRef.current = [...nextPhotosRef.current];
            transitionCycleWidthRef.current = liveWidth;
          }

          if (rolloverElapsedRef.current >= 0 && pendingNextRef.current.length > 0) {
            rolloverElapsedRef.current += dt;
            const progress = rolloverElapsedRef.current / ROLLOVER_SECONDS;
            // Number of slots that should have been swapped by now.
            const targetSwapped = Math.min(Math.ceil(progress * PHOTOS_PER_ROW), PHOTOS_PER_ROW);

            if (targetSwapped > slotsSwappedRef.current) {
              // Build updated photo array, replacing only the newly due slots.
              // Slots are distributed round-robin: photo at (row r, slot s)
              // lives at index s * rowCount + r in the flat displayPhotos array.
              const updated = [...displayPhotosRef.current];
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
                // All slots rolled over — the new page's hold starts now.
                pageElapsedRef.current = 0;
                rolloverElapsedRef.current = -1;
                transitionCycleWidthRef.current = 0;
                slotsSwappedRef.current = 0;
                pendingNextRef.current = [];

                // Advance page index and preload the next-next set.
                pageIndexRef.current += 1;
                const nextNext = getPage(allPhotosRef.current, pageIndexRef.current + 1, rowCount * PHOTOS_PER_ROW);
                nextPhotosRef.current = nextNext;
                preloadImages(nextNext);
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
                  isPaused={isPaused}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
