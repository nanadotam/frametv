'use client';

import { useEffect, useState } from 'react';

export type ClockPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export type ClockFont =
  | 'Poppins'
  | 'Oswald'
  | 'JetBrains Mono'
  | 'Pacifico'
  | 'Playfair Display'
  | 'Dancing Script'
  | 'Bebas Neue'
  | 'Syne';

export interface ClockOverlayConfig {
  enabled: boolean;
  position: ClockPosition;
  font: ClockFont;
}

const POSITION_CLASSES: Record<ClockPosition, string> = {
  'bottom-right': 'bottom-6 right-8 items-end text-right',
  'bottom-left':  'bottom-6 left-8  items-start text-left',
  'top-right':    'top-6  right-8  items-end text-right',
  'top-left':     'top-6  left-8   items-start text-left',
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatTime(d: Date) {
  const h = d.getHours() % 12 || 12;
  const m = pad(d.getMinutes());
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  return { time: `${h}:${m}`, ampm };
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

interface Props {
  config: ClockOverlayConfig;
}

export default function ClockOverlay({ config }: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!config.enabled || !now) return null;

  const { time, ampm } = formatTime(now);
  const date = formatDate(now);
  const posClass = POSITION_CLASSES[config.position];

  return (
    <div
      className={`fixed flex flex-col gap-0.5 pointer-events-none select-none z-50 ${posClass}`}
      style={{ fontFamily: `'${config.font}', sans-serif` }}
    >
      {/* Drop shadow for legibility over any photo */}
      <div
        className="flex items-end gap-2 leading-none"
        style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }}
      >
        <span
          className="text-white font-bold"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', lineHeight: 1 }}
        >
          {time}
        </span>
        <span
          className="text-white/70 font-medium mb-1"
          style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.5rem)' }}
        >
          {ampm}
        </span>
      </div>
      <span
        className="text-white/80"
        style={{
          fontSize: 'clamp(0.75rem, 1.2vw, 1.1rem)',
          filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))',
          letterSpacing: '0.02em',
        }}
      >
        {date}
      </span>
    </div>
  );
}
