'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface TileProps {
  char: string;
  bgColor?: string;
  delay?: number;
}

const TILE_BG = '#1a1a1a';
const CHAR_COLOR = '#f5c518'; // yellow amber

export default function Tile({ char, bgColor, delay = 0 }: TileProps) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topNewRef = useRef<HTMLDivElement>(null);
  const prevCharRef = useRef<string>(char);

  useEffect(() => {
    if (char === prevCharRef.current) return;
    const oldChar = prevCharRef.current;
    prevCharRef.current = char;

    const top = topRef.current;
    const bottom = bottomRef.current;
    const topNew = topNewRef.current;
    if (!top || !bottom || !topNew) return;

    const tl = gsap.timeline({ delay });

    // Set initial content
    top.textContent = oldChar;
    bottom.textContent = char;
    topNew.textContent = char;

    // Reset transforms
    gsap.set(top, { rotateX: 0, opacity: 1 });
    gsap.set(topNew, { rotateX: -90, opacity: 1 });
    gsap.set(bottom, { opacity: 0 });

    tl.to(top, { rotateX: 90, duration: 0.18, ease: 'power1.in' })
      .set(bottom, { opacity: 1 })
      .fromTo(
        topNew,
        { rotateX: -90 },
        { rotateX: 0, duration: 0.18, ease: 'power1.out' }
      );
  }, [char, delay]);

  const bg = bgColor ?? TILE_BG;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        perspective: '200px',
        position: 'relative',
        backgroundColor: bg,
        borderRadius: '3px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Bottom half (new char, revealed) */}
      <div
        ref={bottomRef}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: CHAR_COLOR,
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: '0.85em',
          backgroundColor: bg,
          opacity: 0,
        }}
      >
        {char}
      </div>

      {/* Top (old char, flips down) */}
      <div
        ref={topRef}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: CHAR_COLOR,
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: '0.85em',
          backgroundColor: bg,
          transformOrigin: 'center bottom',
          backfaceVisibility: 'hidden',
        }}
      >
        {char}
      </div>

      {/* Top new (new char, swings into place from above) */}
      <div
        ref={topNewRef}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: CHAR_COLOR,
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: '0.85em',
          backgroundColor: bg,
          transformOrigin: 'center top',
          backfaceVisibility: 'hidden',
        }}
      >
        {char}
      </div>
    </div>
  );
}
