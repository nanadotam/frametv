'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ModeProps } from '@/modes/types';

interface EaselConfig {
  texts?: string[];
  intervalMinutes?: number;
  fontFamily?: string;
}

const DEFAULT_TEXTS = [
  'Make something beautiful today.',
  'Slow down. Look around.',
  'This is your space.',
];

export default function EaselMode({
  config,
  theme,
  brightness,
  isPaused,
  onReady,
}: ModeProps) {
  const cfg = config as EaselConfig;
  const texts = cfg.texts && cfg.texts.length > 0 ? cfg.texts : DEFAULT_TEXTS;
  const intervalMinutes = cfg.intervalMinutes ?? 5;
  const fontFamily = cfg.fontFamily ?? 'Syne';

  const [index, setIndex] = useState(0);
  const [textKey, setTextKey] = useState(0);

  const bg = theme === 'dark' ? '#000000' : '#f9f8f5';
  const color = theme === 'dark' ? '#ffffff' : '#1a1a1a';

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    if (isPaused || texts.length <= 1) return;
    const intervalMs = intervalMinutes * 60 * 1000;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % texts.length);
      setTextKey((k) => k + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [isPaused, intervalMinutes, texts.length]);

  return (
    <div
      className="w-full h-full flex items-center justify-center px-16"
      style={{ backgroundColor: bg, opacity: brightness / 100 }}
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={textKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{
            fontFamily: `'${fontFamily}', sans-serif`,
            fontSize: 'clamp(3rem, 8vw, 8vw)',
            fontWeight: 400,
            color,
            textAlign: 'center',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            maxWidth: '16ch',
          }}
        >
          {texts[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
