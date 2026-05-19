'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import { pickLayout, type Layout } from './layout';
import type { Photo } from '@/types/db';

interface SlideshowGridConfig {
  intervalSeconds?: number;
  transition?: 'blur' | 'fade';
}

function GridSet({
  photos,
  layout,
}: {
  photos: Photo[];
  layout: Layout;
}) {
  return (
    <div
      className="w-full h-full"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gridTemplateRows: 'repeat(6, 1fr)',
        gap: '2px',
      }}
    >
      {layout.areas.map((area, i) => {
        const photo = photos[i];
        const url = photo?.storage_path ?? photo?.thumbnail_path;
        return (
          <div
            key={i}
            style={{
              gridColumn: `${area.colStart} / ${area.colEnd}`,
              gridRow: `${area.rowStart} / ${area.rowEnd}`,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <div className="w-full h-full bg-white/5 animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SlideshowGridMode({
  config,
  brightness,
  isPaused,
  onReady,
}: ModeProps) {
  const cfg = config as SlideshowGridConfig;
  const intervalSeconds = cfg.intervalSeconds ?? 12;

  const { photos, currentIndex, advance } = usePhotoRotation({ shuffle: true });
  const [setKey, setSetKey] = useState(0);

  useEffect(() => {
    if (photos.length > 0) onReady?.();
  }, [photos.length, onReady]);

  useEffect(() => {
    if (isPaused || photos.length === 0) return;
    const id = setInterval(() => {
      advance();
      setSetKey((k) => k + 1);
    }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [isPaused, intervalSeconds, photos.length, advance]);

  // Slice up to 5 photos starting at currentIndex
  const count = Math.min(5, photos.length);
  const slice: Photo[] = [];
  for (let i = 0; i < count; i++) {
    slice.push(photos[(currentIndex + i) % photos.length]);
  }

  const layout = pickLayout(slice);

  const motionProps = {
    initial: { opacity: 0, filter: 'blur(16px) saturate(0.3)' },
    animate: { opacity: 1, filter: 'blur(0px) saturate(1)' },
    exit: { opacity: 0, filter: 'blur(16px) saturate(0.3)' },
    transition: { duration: 1.0 },
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-black"
      style={{ opacity: brightness / 100 }}
    >
      <AnimatePresence mode="wait">
        {layout && slice.length >= 3 ? (
          <motion.div
            key={setKey}
            className="absolute inset-0"
            {...motionProps}
          >
            <GridSet photos={slice} layout={layout} />
          </motion.div>
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse" />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
