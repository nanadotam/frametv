'use client';

import { useCallback, useRef } from 'react';

interface RippleItem {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function useRipple() {
  const ripples = useRef<RippleItem[]>([]);
  const rerender = useRef<(() => void) | null>(null);

  const addRipple = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const id = Date.now() + Math.random();
    ripples.current.push({ id, x, y, size });
    rerender.current?.();
    setTimeout(() => {
      ripples.current = ripples.current.filter((r) => r.id !== id);
      rerender.current?.();
    }, 600);
  }, []);

  return { ripples: ripples.current, addRipple, rerender };
}

interface RippleProps {
  ripples: RippleItem[];
}

export function Ripple({ ripples }: RippleProps) {
  return (
    <>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute rounded-full bg-white/20 animate-ripple"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </>
  );
}

export default Ripple;
