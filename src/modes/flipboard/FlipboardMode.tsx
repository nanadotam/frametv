'use client';

import { useEffect } from 'react';
import type { ModeProps } from '@/modes/types';
import Board from './Board';
import { useFlipboardMessages } from './useFlipboardMessages';

type Source = 'reminders' | 'quotes' | 'time';

interface FlipboardConfig {
  sources?: Source[];
  secondsPerMessage?: number;
  showSound?: boolean;
  cols?: number;
  rows?: number;
}

export default function FlipboardMode({
  config,
  brightness,
  isPaused,
  onReady,
}: ModeProps) {
  const cfg = config as FlipboardConfig;
  const sources = cfg.sources ?? ['reminders', 'quotes', 'time'];
  const secondsPerMessage = cfg.secondsPerMessage ?? 12;
  const cols = cfg.cols ?? 22;
  const rows = cfg.rows ?? 6;

  const { current } = useFlipboardMessages({
    sources,
    secondsPerMessage: isPaused ? 999999 : secondsPerMessage,
  });

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <div
      className="w-full h-full bg-black flex items-center justify-center"
      style={{ opacity: brightness / 100 }}
    >
      <div
        style={{
          width: '90vw',
          height: '60vh',
          maxWidth: '1400px',
        }}
      >
        <Board cols={cols} rows={rows} message={current} />
      </div>
    </div>
  );
}
