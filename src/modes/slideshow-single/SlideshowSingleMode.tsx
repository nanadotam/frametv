'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import { getPhotoRotation, fullscreenRotationStyle } from '@/lib/photoRotation';

interface SlideshowSingleConfig {
  intervalSeconds?: number;
  transition?: 'fade' | 'pixelate' | 'slide' | 'blur';
  shuffle?: boolean;
}

const TRANSITIONS: Record<string, {
  initial: object; animate: object; exit: object; transition: object;
}> = {
  fade:     { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.9 } },
  slide:    { initial: { opacity: 0, x: 80 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -80 }, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } },
  blur:     { initial: { opacity: 0, filter: 'blur(24px)' }, animate: { opacity: 1, filter: 'blur(0px)' }, exit: { opacity: 0, filter: 'blur(24px)' }, transition: { duration: 1.0 } },
  pixelate: { initial: { opacity: 0, filter: 'blur(20px) saturate(0.2)' }, animate: { opacity: 1, filter: 'blur(0px) saturate(1)' }, exit: { opacity: 0, filter: 'blur(20px) saturate(0.2)' }, transition: { duration: 1.1 } },
};

const IMG_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  imageOrientation: 'from-image',
};

/** Loads a thumbnail immediately then upgrades to high-res in background */
function useProgressiveSrc(photoId: string | undefined) {
  const thumbUrl = photoId ? `/api/photos/${photoId}/thumbnail?size=800` : null;
  const hiResUrl = photoId ? `/api/photos/${photoId}/thumbnail?size=2000` : null;
  const [src, setSrc] = useState<string | null>(thumbUrl);

  useEffect(() => {
    if (!thumbUrl || !hiResUrl) { setSrc(null); return; }
    setSrc(thumbUrl);
    let cancelled = false;
    fetch(hiResUrl).then((r) => { if (!cancelled && r.ok) setSrc(hiResUrl); }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoId]);

  return src;
}

export default function SlideshowSingleMode({
  brightness,
  isPaused,
  onReady,
  config,
  albumIds,
}: ModeProps) {
  const cfg = config as SlideshowSingleConfig;
  // intervalSeconds is the canonical key; 'interval' is the old legacy key from early admin UI
  const intervalSeconds = cfg.intervalSeconds ?? (config as Record<string, unknown>).interval as number ?? 300;
  const transition = cfg.transition ?? 'fade';
  const shuffle = cfg.shuffle ?? true;

  const { photos, currentIndex, advance } = usePhotoRotation({ albumIds, shuffle });
  const [key, setKey] = useState(0);

  const photo = photos[currentIndex] ?? null;
  const src = useProgressiveSrc(photo?.id);
  const rotation = getPhotoRotation(photo);
  const rotStyle = fullscreenRotationStyle(rotation);

  const v = TRANSITIONS[transition] ?? TRANSITIONS.fade;

  useEffect(() => {
    if (photos.length > 0) onReady?.();
  }, [photos.length, onReady]);

  useEffect(() => {
    if (isPaused || photos.length === 0) return;
    const id = setInterval(() => { advance(); setKey((k) => k + 1); }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [isPaused, intervalSeconds, photos.length, advance]);

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-black"
      style={{ opacity: brightness / 100 }}
    >
      <AnimatePresence mode="wait">
        {src && (
          <motion.div
            key={key}
            className="absolute inset-0"
            initial={v.initial as never}
            animate={v.animate as never}
            exit={v.exit as never}
            transition={v.transition as never}
          >
            {/* Blurred backdrop */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              aria-hidden
              style={{
                ...IMG_STYLE,
                position: 'absolute',
                inset: 0,
                filter: 'blur(48px) saturate(0.8) brightness(0.6)',
                transform: `scale(1.15)${rotation ? ` rotate(${rotation}deg)` : ''}`,
              }}
            />
            {/* Primary image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              style={{
                ...IMG_STYLE,
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                ...rotStyle,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!src && (
        <div className="flex items-center justify-center w-full h-full">
          <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse" />
        </div>
      )}
    </div>
  );
}
