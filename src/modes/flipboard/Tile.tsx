'use client';

import { useEffect, useRef, useState } from 'react';
import s from './FlipboardMode.module.css';

interface TileProps {
  char: string;
  tileSize: number;
  delay?: number; // ms
  defaultBg?: string; // override the normal tile inner background
}

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-!?\'/: ';
const SCRAMBLE_COLORS = ['#00AAFF', '#00FFCC', '#AA00FF', '#FF2D00', '#FFCC00', '#FFFFFF'];
const SCRAMBLE_INTERVAL = 65; // ms between each random char
const MAX_SCRAMBLES = 11;

export default function Tile({ char, tileSize, delay = 0, defaultBg }: TileProps) {
  const [displayed, setDisplayed] = useState(char);
  const [bg, setBg] = useState<string>('');
  const [textColor, setTextColor] = useState('');
  const [phase, setPhase] = useState<'idle' | 'scrambling' | 'settling'>('idle');
  const prevCharRef = useRef(char);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (char === prevCharRef.current) return;
    const target = char;
    prevCharRef.current = char;

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (delayRef.current) { clearTimeout(delayRef.current); delayRef.current = null; }
    if (settleRef.current) { clearTimeout(settleRef.current); settleRef.current = null; }

    delayRef.current = setTimeout(() => {
      setPhase('scrambling');
      let count = 0;
      const maxScrambles = MAX_SCRAMBLES + Math.floor(Math.random() * 4);

      timerRef.current = setInterval(() => {
        if (count >= maxScrambles) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setBg('');
          setTextColor('');
          setDisplayed(target);
          setPhase('settling');
          settleRef.current = setTimeout(() => setPhase('idle'), 200);
          return;
        }
        const randChar = CHARSET[Math.floor(Math.random() * CHARSET.length)];
        const color = SCRAMBLE_COLORS[count % SCRAMBLE_COLORS.length];
        setDisplayed(randChar);
        setBg(color);
        setTextColor(color === '#FFFFFF' || color === '#FFCC00' ? '#111111' : '#FFFFFF');
        count++;
      }, SCRAMBLE_INTERVAL);
    }, delay);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (delayRef.current) clearTimeout(delayRef.current);
      if (settleRef.current) clearTimeout(settleRef.current);
    };
  }, [char, delay]);

  const classNames = [
    s.tile,
    phase === 'scrambling' ? s.scrambling : '',
    phase === 'settling'   ? s.settling   : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      style={{ width: tileSize, height: tileSize }}
    >
      <div
        className={s.tileInner}
        style={{ backgroundColor: bg || defaultBg || undefined }}
      >
        <span
          className={s.tileChar}
          style={{
            fontSize: Math.round(tileSize * 0.52),
            color: textColor || undefined,
          }}
        >
          {displayed === ' ' ? '' : displayed}
        </span>
      </div>
    </div>
  );
}
