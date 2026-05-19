'use client';

import { useEffect, useRef, useState } from 'react';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import type { Photo } from '@/types/db';
import styles from './PinterestMode.module.css';

interface PinterestConfig {
  rows?: number;
  speed?: 0.5 | 1 | 2;
  direction?: 'left' | 'right';
  cornerRadius?: number;
  gap?: number;
}

/**
 * Single photo in the scrolling track.
 * Reads natural dimensions on load so width matches the image's real aspect ratio.
 * Before load: renders at 1:1 as a placeholder so the track has stable width.
 */
function TrackPhoto({
  photo,
  rowHeightPx,
  cornerRadius,
  imgIdx,
}: {
  photo: Photo;
  rowHeightPx: number;
  cornerRadius: number;
  imgIdx: number;
}) {
  const [displayWidth, setDisplayWidth] = useState<number>(rowHeightPx); // 1:1 until loaded
  const imgRef = useRef<HTMLImageElement | null>(null);

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const img = e.currentTarget as any;
    const nw: number = img.naturalWidth ?? 0;
    const nh: number = img.naturalHeight ?? 0;
    if (!nw || !nh) return;
    // Use rendered clientWidth/clientHeight to get the visual ratio after EXIF rotation
    const cw: number = img.clientWidth ?? 0;
    const ch: number = img.clientHeight ?? 0;
    const visualRatio = cw > 0 && ch > 0 ? cw / ch : nw / nh;
    setDisplayWidth(Math.round(rowHeightPx * visualRatio));
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      key={`${photo.id}-${imgIdx}`}
      src={`/api/photos/${photo.id}/thumbnail?size=1200`}
      alt=""
      className={styles.photo}
      onLoad={onLoad}
      style={{
        height: `${rowHeightPx}px`,
        width: `${displayWidth}px`,
        borderRadius: `${cornerRadius}px`,
        imageOrientation: 'from-image',
        flexShrink: 0,
        objectFit: 'cover',
        display: 'block',
      }}
    />
  );
}

export default function PinterestMode({
  config,
  brightness,
  isPaused,
  onReady,
}: ModeProps) {
  const cfg = config as PinterestConfig;
  const rowCount = cfg.rows ?? 3;
  const speed = cfg.speed ?? 1;
  const direction = cfg.direction ?? 'left';
  const cornerRadius = cfg.cornerRadius ?? 24;
  const gap = cfg.gap ?? 12;

  const { photos } = usePhotoRotation({ shuffle: true });
  const [viewportH, setViewportH] = useState(900);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = globalThis as any;
    if (!w.innerHeight) return;
    setViewportH(w.innerHeight);
    const onResize = () => setViewportH(w.innerHeight);
    w.addEventListener('resize', onResize);
    return () => w.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (photos.length > 0) onReady?.();
  }, [photos.length, onReady]);

  if (photos.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black">
        <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  // Pixel row height so TrackPhoto can calculate correct width
  const rowHeightPx = Math.floor((viewportH - gap * (rowCount + 1)) / rowCount);

  // Distribute photos round-robin across rows, then duplicate for seamless loop
  const rows: typeof photos[] = Array.from({ length: rowCount }, () => []);
  photos.forEach((photo, i) => rows[i % rowCount].push(photo));

  const baseDuration = 30 / speed;

  return (
    <div
      className="w-full h-full overflow-hidden bg-black flex flex-col"
      style={{ opacity: brightness / 100, gap: `${gap}px`, padding: `${gap}px` }}
    >
      {rows.map((rowPhotos, rowIdx) => {
        const rowDirection =
          rowIdx % 2 === 0
            ? direction === 'left' ? 'normal' : 'reverse'
            : direction === 'left' ? 'reverse' : 'normal';

        const duration = baseDuration * (1 + rowIdx * 0.05);
        const doubled = [...rowPhotos, ...rowPhotos];

        return (
          <div
            key={rowIdx}
            className={styles.row}
            style={{ height: `${rowHeightPx}px`, flexShrink: 0 }}
          >
            <div
              className={styles.track}
              style={{
                '--duration': `${duration}s`,
                '--direction': rowDirection,
                gap: `${gap}px`,
                animationPlayState: isPaused ? 'paused' : 'running',
              } as React.CSSProperties}
            >
              {doubled.map((photo, imgIdx) => (
                <TrackPhoto
                  key={`${photo.id}-${imgIdx}`}
                  photo={photo}
                  rowHeightPx={rowHeightPx}
                  cornerRadius={cornerRadius}
                  imgIdx={imgIdx}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
