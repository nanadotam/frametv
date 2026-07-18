'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import { getPhotoRotation, cellRotationStyle } from '@/lib/photoRotation';
import type { Photo } from '@/types/db';
import { photoThumbUrl, IMG_SIZES } from '@/lib/image-urls';

interface ScrapbookConfig {
  intervalSeconds?: number;
  maxOnScreen?: number;
  tapeFrequency?: number;
  showDate?: boolean;
}

interface PlacedPolaroid {
  key: number;
  photo: Photo;
  x: number; // percent
  y: number; // percent
  rotation: number; // degrees, settled resting angle
  tossFrom: number; // degrees, extra rotation during the toss-in
  hasTape: boolean;
  tapeCorner: 'left' | 'right';
  z: number;
}

let placementCounter = 0;

function randomPosition(existing: { x: number; y: number }[]) {
  const PAD = 14;
  let best = { x: 50, y: 50 };
  let bestScore = -1;
  for (let attempt = 0; attempt < 10; attempt++) {
    const x = PAD + Math.random() * (100 - PAD * 2);
    const y = PAD + Math.random() * (100 - PAD * 2);
    const minDist = existing.reduce(
      (min, p) => Math.min(min, Math.hypot(p.x - x, p.y - y)),
      Infinity
    );
    if (minDist > bestScore) {
      bestScore = minDist;
      best = { x, y };
    }
    if (minDist > 16) break;
  }
  return best;
}

function formatCaption(photo: Photo): string {
  const raw = photo.taken_at ?? photo.created_at;
  if (!raw) return '';
  try {
    return format(new Date(raw), 'dd/MM/yy');
  } catch {
    return '';
  }
}

function TapeStrip({ corner }: { corner: 'left' | 'right' }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: -14,
        [corner === 'left' ? 'left' : 'right']: '18%',
        width: 64,
        height: 26,
        background: 'linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,.32))',
        transform: `rotate(${corner === 'left' ? -9 : 9}deg)`,
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        borderRadius: 1,
      } as React.CSSProperties}
    />
  );
}

function PolaroidCard({ item, showDate }: { item: PlacedPolaroid; showDate: boolean }) {
  const rotation = getPhotoRotation(item.photo);
  const caption = showDate ? formatCaption(item.photo) : '';

  return (
    <motion.div
      layout
      initial={{
        opacity: 0,
        y: -140,
        scale: 0.72,
        rotate: item.rotation + item.tossFrom,
      }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: item.rotation }}
      exit={{ opacity: 0, scale: 0.88, y: 24, transition: { duration: 0.45 } }}
      transition={{ type: 'spring', stiffness: 170, damping: 15, mass: 0.9 }}
      style={{
        position: 'absolute',
        left: `${item.x}%`,
        top: `${item.y}%`,
        translateX: '-50%',
        translateY: '-50%',
        zIndex: item.z,
        width: 'clamp(200px, 20vw, 300px)',
      }}
    >
      <div
        style={{
          position: 'relative',
          background: '#fafaf7',
          padding: '10px 10px 0',
          borderRadius: 2,
          boxShadow: '0 18px 40px rgba(0,0,0,.5), 0 3px 10px rgba(0,0,0,.3)',
        }}
      >
        {item.hasTape && <TapeStrip corner={item.tapeCorner} />}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            overflow: 'hidden',
            background: '#111',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoThumbUrl(item.photo, IMG_SIZES.thumb_large)}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              ...cellRotationStyle(rotation),
            }}
          />
        </div>
        <div
          style={{
            height: 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 4px 14px',
          }}
        >
          {caption && (
            <span
              style={{
                fontFamily: 'var(--font-clock-dancing), cursive',
                fontSize: '1.15rem',
                color: '#3a3a3a',
              }}
            >
              {caption}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ScrapbookMode({ config, brightness, isPaused, albumIds, onReady }: ModeProps) {
  const cfg = config as ScrapbookConfig;
  const intervalSeconds = Math.max(2, cfg.intervalSeconds ?? 6);
  const maxOnScreen = Math.max(2, Math.min(cfg.maxOnScreen ?? 7, 14));
  const tapeFrequency = typeof cfg.tapeFrequency === 'number' ? cfg.tapeFrequency : 0.35;
  const showDate = cfg.showDate ?? true;

  const { photos: allPhotos } = usePhotoRotation({ albumIds, shuffle: true });
  const [placed, setPlaced] = useState<PlacedPolaroid[]>([]);

  const photosRef = useRef<Photo[]>([]);
  const indexRef = useRef(0);
  const placedRef = useRef<PlacedPolaroid[]>([]);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    photosRef.current = allPhotos;
  }, [allPhotos]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    placedRef.current = placed;
  }, [placed]);

  // Toss the first polaroid in immediately, then keep tossing on an interval.
  useEffect(() => {
    if (allPhotos.length === 0) return;

    const tossOne = () => {
      if (isPausedRef.current) return;
      const photos = photosRef.current;
      if (photos.length === 0) return;

      const photo = photos[indexRef.current % photos.length];
      indexRef.current += 1;

      const pos = randomPosition(placedRef.current.map((p) => ({ x: p.x, y: p.y })));
      placementCounter += 1;

      const next: PlacedPolaroid = {
        key: placementCounter,
        photo,
        x: pos.x,
        y: pos.y,
        rotation: -12 + Math.random() * 24,
        tossFrom: Math.random() > 0.5 ? 40 + Math.random() * 20 : -(40 + Math.random() * 20),
        hasTape: Math.random() < tapeFrequency,
        tapeCorner: Math.random() > 0.5 ? 'left' : 'right',
        z: placementCounter,
      };

      setPlaced((prev) => {
        const updated = [...prev, next];
        return updated.length > maxOnScreen ? updated.slice(updated.length - maxOnScreen) : updated;
      });
    };

    tossOne();
    const timer = setInterval(tossOne, intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [allPhotos.length, intervalSeconds, maxOnScreen, tapeFrequency]);

  useEffect(() => {
    if (placed.length > 0) onReady?.();
  }, [placed.length, onReady]);

  if (allPhotos.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black">
        <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        opacity: brightness / 100,
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,.05), transparent 60%), #0a0a0a',
      }}
    >
      <AnimatePresence>
        {placed.map((item) => (
          <PolaroidCard key={item.key} item={item} showDate={showDate} />
        ))}
      </AnimatePresence>
    </div>
  );
}
