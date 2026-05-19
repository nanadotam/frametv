'use client';

import { useEffect } from 'react';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import styles from './PinterestMode.module.css';

interface PinterestConfig {
  rows?: number;
  speed?: 0.5 | 1 | 2;
  direction?: 'left' | 'right';
  cornerRadius?: number;
  gap?: number;
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

  // Distribute photos round-robin across rows, then duplicate for seamless loop
  const rows: typeof photos[] = Array.from({ length: rowCount }, () => []);
  photos.forEach((photo, i) => {
    rows[i % rowCount].push(photo);
  });

  // Base duration in seconds at speed=1 → 30s for a full loop
  const baseDuration = 30 / speed;

  const rowHeight = `calc((100vh - ${gap * (rowCount + 1)}px) / ${rowCount})`;

  return (
    <div
      className="w-full h-full overflow-hidden bg-black flex flex-col"
      style={{
        opacity: brightness / 100,
        gap: `${gap}px`,
        padding: `${gap}px`,
      }}
    >
      {rows.map((rowPhotos, rowIdx) => {
        // Alternate rows reverse direction
        const rowDirection =
          rowIdx % 2 === 0
            ? direction === 'left'
              ? 'normal'
              : 'reverse'
            : direction === 'left'
            ? 'reverse'
            : 'normal';

        // Adjust duration slightly per row for organic feel
        const duration = baseDuration * (1 + rowIdx * 0.05);

        // Duplicate for seamless loop
        const doubled = [...rowPhotos, ...rowPhotos];

        return (
          <div
            key={rowIdx}
            className={styles.row}
            style={{ height: rowHeight, flexShrink: 0 }}
          >
            <div
              className={styles.track}
              style={
                {
                  '--duration': `${duration}s`,
                  '--direction': rowDirection,
                  gap: `${gap}px`,
                  animationPlayState: isPaused ? 'paused' : 'running',
                } as React.CSSProperties
              }
            >
              {doubled.map((photo, imgIdx) => {
                const url = photo.storage_path ?? photo.thumbnail_path;
                const aspectRatio =
                  photo.aspect_ratio ??
                  (photo.width && photo.height
                    ? photo.width / photo.height
                    : 1.5);
                const imgWidth = `calc(${rowHeight} * ${aspectRatio})`;

                return url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${photo.id}-${imgIdx}`}
                    src={url}
                    alt=""
                    className={styles.photo}
                    style={{
                      width: imgWidth,
                      borderRadius: `${cornerRadius}px`,
                    }}
                  />
                ) : null;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
