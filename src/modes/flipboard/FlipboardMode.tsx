'use client';

import { useEffect } from 'react';
import type { ModeProps } from '@/modes/types';
import Board from './Board';
import { useFlipboardMessages, type Source } from './useFlipboardMessages';
import s from './FlipboardMode.module.css';

interface FlipboardConfig {
  sources?: Source[];
  seconds_per_message?: number;
  secondsPerMessage?: number; // legacy
  sound?: boolean;
}

export default function FlipboardMode({
  config,
  brightness,
  isPaused,
  onReady,
}: ModeProps) {
  const cfg = config as FlipboardConfig;
  const sources: Source[] = cfg.sources?.length ? cfg.sources : ['reminders', 'quotes', 'messages'];
  const secondsPerMessage = cfg.secondsPerMessage ?? cfg.seconds_per_message ?? 60;
  const soundEnabled = cfg.sound ?? false;

  const { current } = useFlipboardMessages({
    sources,
    secondsPerMessage: isPaused ? 999999 : secondsPerMessage,
  });

  useEffect(() => { onReady?.(); }, [onReady]);

  return (
    <div
      className={s.wrapper}
      style={{ opacity: brightness / 100 }}
    >
      <Board message={current} soundEnabled={soundEnabled} />
    </div>
  );
}
