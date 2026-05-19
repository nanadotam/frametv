'use client';

import { useEffect, useRef, useState } from 'react';
import Tile from './Tile';
import s from './FlipboardMode.module.css';
import type { FlipMessage } from './useFlipboardMessages';

interface BoardProps {
  message: FlipMessage | null;
  soundEnabled?: boolean;
}

const ACCENT_COLORS = ['#00FF7F', '#FF4D00', '#AA00FF', '#00AAFF', '#00FFCC'];
const STAGGER_MS = 22; // ms between tiles
const TARGET_TILE_PX = 62;
const GAP_PX = 3;

function formatToGrid(text: string, cols: number, rows: number): string[][] {
  const upper = text.toUpperCase();
  const words = upper.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= cols) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // hard-wrap long single words
      let remaining = word;
      while (remaining.length > cols) {
        lines.push(remaining.slice(0, cols));
        remaining = remaining.slice(cols);
      }
      current = remaining;
    }
  }
  if (current) lines.push(current);

  const cappedLines = lines.slice(0, rows);
  const topPad = Math.floor((rows - cappedLines.length) / 2);

  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const lineIdx = r - topPad;
    const line = lineIdx >= 0 && lineIdx < cappedLines.length ? cappedLines[lineIdx] : '';
    const padLeft = Math.floor((cols - line.length) / 2);
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const ci = c - padLeft;
      row.push(ci >= 0 && ci < line.length ? line[ci] : ' ');
    }
    grid.push(row);
  }
  return grid;
}

export default function Board({ message, soundEnabled }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(30);
  const [rows, setRows] = useState(14);
  const [tileSize, setTileSize] = useState(TARGET_TILE_PX);
  const [accentIdx, setAccentIdx] = useState(0);
  const prevTextRef = useRef<string | null>(null);
  const soundRef = useRef<import('./soundEngine').SoundEngine | null>(null);
  const audioInitRef = useRef(false);

  // Dynamic grid sizing from container
  useEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      const step = TARGET_TILE_PX + GAP_PX;
      const c = Math.max(8, Math.floor((width  + GAP_PX) / step));
      const r = Math.max(4, Math.floor((height + GAP_PX) / step));
      // Tile size: fill width exactly
      const ts = Math.floor((width + GAP_PX) / c) - GAP_PX;
      setCols(c);
      setRows(r);
      setTileSize(Math.max(28, ts));
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Cycle accent color and trigger sound on message change
  useEffect(() => {
    const text = message?.text ?? null;
    if (text !== prevTextRef.current && prevTextRef.current !== null) {
      setAccentIdx((i) => (i + 1) % ACCENT_COLORS.length);
      if (soundEnabled && soundRef.current) {
        soundRef.current.playTransition();
      }
    }
    prevTextRef.current = text;
  }, [message?.text, soundEnabled]);

  // Lazy-load sound engine on first user interaction
  useEffect(() => {
    if (!soundEnabled) return;
    const initSound = async () => {
      if (audioInitRef.current) return;
      audioInitRef.current = true;
      const { SoundEngine } = await import('./soundEngine');
      soundRef.current = new SoundEngine();
      await soundRef.current.init();
      soundRef.current.resume();
    };
    window.addEventListener('click', initSound, { once: true });
    window.addEventListener('keydown', initSound, { once: true });
    return () => {
      window.removeEventListener('click', initSound);
      window.removeEventListener('keydown', initSound);
    };
  }, [soundEnabled]);

  const grid = formatToGrid(message?.text ?? '', cols, rows);
  const accentColor = ACCENT_COLORS[accentIdx];

  return (
    <div ref={containerRef} className={s.board}>
      {/* Left accent bar */}
      <div className={`${s.accentBar} ${s.accentBarLeft}`}>
        <div className={s.accentSegment} style={{ backgroundColor: accentColor }} />
        <div className={s.accentSegment} style={{ backgroundColor: accentColor }} />
      </div>

      {/* Tile grid */}
      <div
        className={s.tileGrid}
        style={{
          gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
          gridTemplateRows:    `repeat(${rows}, ${tileSize}px)`,
        }}
      >
        {grid.map((row, ri) =>
          row.map((char, ci) => (
            <Tile
              key={`${ri}-${ci}`}
              char={char}
              tileSize={tileSize}
              delay={(ri * cols + ci) * STAGGER_MS}
            />
          ))
        )}
      </div>

      {/* Right accent bar */}
      <div className={`${s.accentBar} ${s.accentBarRight}`}>
        <div className={s.accentSegment} style={{ backgroundColor: accentColor }} />
        <div className={s.accentSegment} style={{ backgroundColor: accentColor }} />
      </div>
    </div>
  );
}
