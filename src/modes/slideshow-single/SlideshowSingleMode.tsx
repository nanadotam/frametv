'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';

interface SlideshowSingleConfig {
  intervalSeconds?: number;
  transition?: 'fade' | 'pixelate' | 'slide' | 'blur';
  blurredBackdrop?: boolean;
  borderPx?: number;
  shuffle?: boolean;
}

import type { Transition, TargetAndTransition, VariantLabels } from 'framer-motion';

interface TransitionVariant {
  initial: TargetAndTransition | VariantLabels;
  animate: TargetAndTransition | VariantLabels;
  exit: TargetAndTransition;
  transition: Transition;
}

const TRANSITION_VARIANTS: Record<string, TransitionVariant> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.8 },
  },
  slide: {
    initial: { opacity: 0, x: 80 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -80 },
    transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(24px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(24px)' },
    transition: { duration: 0.9 },
  },
  pixelate: {
    initial: { opacity: 0, filter: 'blur(20px) saturate(0.2)' },
    animate: { opacity: 1, filter: 'blur(0px) saturate(1)' },
    exit: { opacity: 0, filter: 'blur(20px) saturate(0.2)' },
    transition: { duration: 1.0 },
  },
};

export default function SlideshowSingleMode({
  config,
  theme,
  brightness,
  isPaused,
  onReady,
}: ModeProps) {
  const cfg = config as SlideshowSingleConfig;
  const intervalSeconds = cfg.intervalSeconds ?? 8;
  const transition = cfg.transition ?? 'fade';
  const blurredBackdrop = cfg.blurredBackdrop ?? true;
  const borderPx = cfg.borderPx ?? 4;
  const shuffle = cfg.shuffle ?? true;

  const { photos, currentIndex, advance } = usePhotoRotation({ shuffle });
  const [key, setKey] = useState(0);

  const borderColor = theme === 'dark' ? '#0a0a0a' : '#fefefe';
  const variants = TRANSITION_VARIANTS[transition];

  useEffect(() => {
    if (photos.length > 0) onReady?.();
  }, [photos.length, onReady]);

  useEffect(() => {
    if (isPaused || photos.length === 0) return;
    const id = setInterval(() => {
      advance();
      setKey((k) => k + 1);
    }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [isPaused, intervalSeconds, photos.length, advance]);

  const photo = photos[currentIndex] ?? null;
  const isLandscape =
    photo && photo.width && photo.height
      ? photo.width >= photo.height
      : true;
  const showBackdrop = blurredBackdrop && photo && !isLandscape;

  const photoUrl = photo?.storage_path ?? photo?.thumbnail_path ?? null;

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        opacity: brightness / 100,
        padding: `${borderPx}px`,
        backgroundColor: borderColor,
      }}
    >
      {/* Blurred backdrop */}
      {showBackdrop && photoUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{
            backgroundImage: `url(${photoUrl})`,
            filter: 'blur(32px)',
            transform: 'scale(1.15)',
          }}
        />
      )}

      <AnimatePresence mode="wait">
        {photoUrl && (
          <motion.div
            key={key}
            className="absolute inset-0 flex items-center justify-center"
            style={{ padding: `${borderPx}px` }}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={variants.transition}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt=""
              className="max-w-full max-h-full object-contain"
              style={{ display: 'block' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!photoUrl && (
        <div className="flex items-center justify-center w-full h-full">
          <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse" />
        </div>
      )}
    </div>
  );
}
