'use client';

import { useEffect, useState } from 'react';
import type { ModeProps } from '@/modes/types';
import { GRID, GRID_COLS, THEMES, type ThemeKey } from './constants';
import { computeActiveWords } from './logic';

interface ClockTextConfig {
  theme?: ThemeKey;
  fontSize?: number;
  fontFamily?: string;
}

export default function ClockTextMode({
  config,
  brightness,
  onReady,
}: ModeProps) {
  const cfg = config as ClockTextConfig;
  const themeKey: ThemeKey = (cfg.theme as ThemeKey) ?? 'dark';
  const fontSize = cfg.fontSize ?? 20;
  const fontFamily = cfg.fontFamily ?? 'DM Sans';

  const palette = THEMES[themeKey] ?? THEMES.dark;

  const [activeWords, setActiveWords] = useState<Set<string>>(() =>
    computeActiveWords(new Date())
  );

  useEffect(() => {
    onReady?.();

    const tick = () => setActiveWords(computeActiveWords(new Date()));
    tick();

    // Update every 30 seconds
    const id = setInterval(tick, 30_000);

    // Align to next 30s boundary
    const now = new Date();
    const ms =
      (30 - (now.getSeconds() % 30)) * 1000 - now.getMilliseconds();
    const alignId = setTimeout(() => {
      tick();
    }, ms);

    return () => {
      clearInterval(id);
      clearTimeout(alignId);
    };
  }, [onReady]);

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ backgroundColor: palette.bg, opacity: brightness / 100 }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gap: '0.15em',
          fontFamily: `'${fontFamily}', sans-serif`,
          fontSize: `${fontSize}px`,
          fontWeight: 700,
          letterSpacing: '0.05em',
          userSelect: 'none',
        }}
      >
        {GRID.map((cell, idx) => {
          const isActive = cell.wordId !== '' && activeWords.has(cell.wordId);
          return (
            <span
              key={idx}
              style={{
                color: isActive ? palette.on : palette.off,
                transition: 'color 0.6s ease',
                textAlign: 'center',
                display: 'inline-block',
                width: '1.2em',
                lineHeight: '1.6',
              }}
            >
              {cell.letter}
            </span>
          );
        })}
      </div>
    </div>
  );
}
