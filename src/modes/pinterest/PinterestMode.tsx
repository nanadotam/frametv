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

// 4× copies ensures even a row with 3 portrait images fills >1920px at any reasonable height.
const COPIES = 4;

function getViewportHeight() {
  return typeof window === 'undefined' ? 900 : window.innerHeight;
}

/**
 * Single photo in the scrolling track.
 * Loads a small thumbnail immediately, upgrades to display-quality in background.
 * Shows a blurred LQIP placeholder until the first thumb paints.
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
  const [displaySrc, setDisplaySrc] = useState<string>(() => photoThumbUrl(photo, IMG_SIZES.thumb_small));

  const rotation = getPhotoRotation(photo);
  const lqipSrc = photoThumbUrl(photo, IMG_SIZES.lqip);

  // Upgrade to display-quality in background once mounted
  useEffect(() => {
    const isSlow = getConnectionSpeed() === 'slow';
    const targetSize = isSlow ? IMG_SIZES.thumb_medium : IMG_SIZES.thumb_large;
    const upgradeSrc = photoThumbUrl(photo, targetSize);
    const img = new Image();
    img.onload = () => setDisplaySrc(upgradeSrc);
    img.src = upgradeSrc;
    return () => { img.onload = null; };
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
      {/* LQIP blurred fill — shows immediately */}
      {!mainLoaded && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lqipSrc}
          aria-hidden
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', filter: 'blur(12px)', transform: 'scale(1.1)',
          }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displaySrc}
        alt=""
        loading="lazy"
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
  // Handle legacy "0.5x"/"1x"/"2x" string values saved by earlier admin UI
  const rawSpeed = cfg.speed;
  const speed = typeof rawSpeed === 'number'
    ? rawSpeed
    : typeof rawSpeed === 'string'
      ? (parseFloat(rawSpeed) || 1)
      : 1;
  // Handle both 'direction' string and legacy 'reverse_direction' boolean
  const direction: 'left' | 'right' = typeof cfg.direction === 'string'
    ? cfg.direction
    : (cfg.reverse_direction ? 'right' : 'left');
  const cornerRadius = cfg.cornerRadius ?? 24;
  const gap = cfg.gap ?? 12;

  const { photos } = usePhotoRotation({ albumIds, shuffle: true });
  const [viewportH, setViewportH] = useState(getViewportHeight);

  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (photos.length > 0) onReady?.();
  }, [photos.length, onReady]);

  // JS animation refs — one pixel position per row, live-measured cycle width.
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posPxRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const isPausedRef = useRef(isPaused);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // Reset per-row positions when row count changes so the animation restarts cleanly
  useEffect(() => { posPxRef.current = []; }, [rowCount]);

  // Pixel-based speed keeps the setting perceptible even when rows are very wide.
  const pxPerSecond = 24 * speed;

  useEffect(() => {
    if (photos.length === 0) return;

    let lastTs = 0;

    const tick = (ts: number) => {
      rafRef.current = requestAnimationFrame(tick);

      if (isPausedRef.current) { lastTs = ts; return; }
      if (!lastTs) { lastTs = ts; return; }

      const dt = Math.min((ts - lastTs) / 1000, 0.1); // cap at 100ms (e.g. tab switch)
      lastTs = ts;

      for (let r = 0; r < rowCount; r++) {
        const track = trackRefs.current[r];
        if (!track) continue;

        // cycleWidth = width of one copy's content (live — updates as images load)
        const cycleWidth = track.scrollWidth / COPIES;
        if (cycleWidth < 10) continue;

        // Advance the pixel position within one repeated copy.
        if (posPxRef.current[r] === undefined) posPxRef.current[r] = 0;
        posPxRef.current[r] = (posPxRef.current[r] + pxPerSecond * dt) % cycleWidth;
        const offsetPx = posPxRef.current[r];

        // Alternate rows scroll in opposite directions
        const rowDir =
          r % 2 === 0
            ? direction === 'left' ? -1 : 1
            : direction === 'left' ? 1 : -1;

        // Left-moving: translate 0 → -cycleWidth.
        // Right-moving: translate -cycleWidth → 0.
        const translateX = rowDir < 0
          ? -offsetPx
          : -(cycleWidth - offsetPx);

        track.style.transform = `translateX(${translateX}px)`;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [photos.length, rowCount, direction, pxPerSecond]);

  if (photos.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black">
        <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  const rowHeightPx = Math.floor((viewportH - gap * (rowCount + 1)) / rowCount);

  // Distribute photos round-robin across rows
  const rows: typeof photos[] = Array.from({ length: rowCount }, () => []);
  photos.forEach((photo, i) => rows[i % rowCount].push(photo));

  return (
    <div
      className="w-full h-full overflow-hidden bg-black flex flex-col"
      style={{ opacity: brightness / 100, gap: `${gap}px`, padding: `${gap}px` }}
    >
      {rows.map((rowPhotos, rowIdx) => {
        // Repeat COPIES times for a seamless loop with enough content
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
              ref={(el) => { trackRefs.current[rowIdx] = el; }}
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
