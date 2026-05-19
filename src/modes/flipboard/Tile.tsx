'use client';

import { useEffect, useRef, useState } from 'react';

interface TileProps {
  char: string;
  bgColor?: string;
  delay?: number;
}

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-: ';
const SCRAMBLE_COLORS = ['#00AAFF', '#00FFCC', '#AA00FF', '#FF2D00', '#FFCC00', '#FFFFFF'];
const MAX_SCRAMBLES = 12;
const SCRAMBLE_INTERVAL_MS = 55;

const TILE_BG = '#111111';
const CHAR_COLOR = '#f5c518';

export default function Tile({ char, bgColor, delay = 0 }: TileProps) {
  const [displayed, setDisplayed] = useState(char);
  const [tileBg, setTileBg] = useState(bgColor ?? TILE_BG);
  const [charColor, setCharColor] = useState(CHAR_COLOR);
  const prevCharRef = useRef(char);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (char === prevCharRef.current) return;
    const target = char;
    prevCharRef.current = char;

    // Clear any in-progress animation
    if (timerRef.current) clearInterval(timerRef.current);
    if (delayRef.current) clearTimeout(delayRef.current);

    delayRef.current = setTimeout(() => {
      let count = 0;

      timerRef.current = setInterval(() => {
        if (count >= MAX_SCRAMBLES) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setDisplayed(target);
          setTileBg(bgColor ?? TILE_BG);
          setCharColor(CHAR_COLOR);
          return;
        }

        const randChar = CHARSET[Math.floor(Math.random() * CHARSET.length)];
        const scrambleColor = SCRAMBLE_COLORS[count % SCRAMBLE_COLORS.length];
        setDisplayed(randChar);
        setTileBg(scrambleColor);
        // Invert text for light backgrounds
        setCharColor(scrambleColor === '#FFFFFF' || scrambleColor === '#FFCC00' ? '#111' : CHAR_COLOR);
        count++;
      }, SCRAMBLE_INTERVAL_MS);
    }, delay);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, [char, bgColor, delay]);

  // Keep in sync when bgColor changes without char change
  useEffect(() => {
    if (char === prevCharRef.current) {
      setTileBg(bgColor ?? TILE_BG);
    }
  }, [bgColor, char]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: tileBg,
        borderRadius: '3px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.04s linear',
        overflow: 'hidden',
      }}
    >
      {/* Center divider line (split-flap aesthetic) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: '1px',
          backgroundColor: 'rgba(0,0,0,0.35)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      <span
        style={{
          color: charColor,
          fontFamily: '"Courier New", Courier, monospace',
          fontWeight: 700,
          fontSize: '0.82em',
          lineHeight: 1,
          userSelect: 'none',
          zIndex: 1,
          transition: 'color 0.04s linear',
        }}
      >
        {displayed === ' ' ? ' ' : displayed}
      </span>
    </div>
  );
}
