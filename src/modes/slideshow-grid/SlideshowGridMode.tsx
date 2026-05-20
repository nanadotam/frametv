'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import { pickLayout, type Layout } from './layout';
import { getPhotoRotation, cellRotationStyle } from '@/lib/photoRotation';
import type { Photo } from '@/types/db';

interface SlideshowGridConfig {
  cellIntervalSeconds?: number;
}

interface CellState {
  photo: Photo | null;
  flipKey: number;
}

// Module-level AR cache — persists for page lifetime, shared across re-renders
const AR_CACHE = new Map<string, number>();

function measureAR(photoId: string): void {
  if (AR_CACHE.has(photoId)) return;
  const img = new Image();
  img.src = `/api/photos/${photoId}/thumbnail?size=200`;
  img.onload = () => {
    if (img.naturalWidth && img.naturalHeight) {
      AR_CACHE.set(photoId, img.naturalWidth / img.naturalHeight);
    }
  };
}

function getAR(photoId: string): number {
  return AR_CACHE.get(photoId) ?? 1; // default square until measured
}

const FILL: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  imageOrientation: 'from-image',
  display: 'block',
};

function useProgressiveSrc(photoId: string | undefined) {
  const thumb = photoId ? `/api/photos/${photoId}/thumbnail?size=800` : null;
  const hires = photoId ? `/api/photos/${photoId}/thumbnail?size=2000` : null;
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!thumb || !hires) { setSrc(null); return; }
    setSrc(thumb);
    let dead = false;
    fetch(hires).then((r) => { if (!dead && r.ok) setSrc(hires); }).catch(() => {});
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoId]);

  return src;
}

function PhotoCell({ photo }: { photo: Photo | null }) {
  const src = useProgressiveSrc(photo?.id);
  const rotation = getPhotoRotation(photo);
  const rotStyle = cellRotationStyle(rotation);
  if (!src) return <div style={{ position: 'absolute', inset: 0, background: '#111' }} />;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} aria-hidden alt=""
        style={{ ...FILL, filter: 'blur(24px) brightness(0.55)', transform: `scale(1.15)${rotation ? ` rotate(${rotation}deg)` : ''}` }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ ...FILL, zIndex: 1, ...rotStyle }} />
    </>
  );
}

function GridCell({ cell }: { cell: CellState }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={cell.flipKey}
          style={{ position: 'absolute', inset: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.75 }}
        >
          <PhotoCell photo={cell.photo} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function SlideshowGridMode({
  config,
  brightness,
  isPaused,
  onReady,
  albumIds,
}: ModeProps) {
  const cfg = config as SlideshowGridConfig;
  const cellInterval =
    ((cfg.cellIntervalSeconds ?? (config as Record<string, unknown>).intervalSeconds as number) ?? 300) * 1000;

  const { photos } = usePhotoRotation({ albumIds, shuffle: true });
  const [layout, setLayout] = useState<Layout | null>(null);
  const [cells, setCells] = useState<CellState[]>([]);

  const photoIdxRef  = useRef(0);
  const prevCountRef = useRef<number | null>(null);
  const initialized  = useRef(false);

  // One-time init: pick initial layout, populate cells, kick off AR measurement
  useEffect(() => {
    if (photos.length === 0 || initialized.current) return;
    initialized.current = true;

    // Start measuring ARs in background for the first 30 photos
    photos.slice(0, 30).forEach((p) => measureAR(p.id));

    const initial = pickLayout(1, null, Math.min(photos.length, 6));
    prevCountRef.current = initial.count;
    setLayout(initial);
    setCells(
      initial.areas.map((_, i) => ({
        photo: photos[i % photos.length],
        flipKey: i,
      }))
    );
    photoIdxRef.current = initial.count % photos.length;
    onReady?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  // Cascade + layout change cycle
  useEffect(() => {
    if (isPaused || photos.length < 3 || !layout) return;

    const STAGGER_MS = 1_000;
    const pending: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    // Kick off AR measurement for upcoming photos so future cycles have better data
    const preload = (start: number) => {
      for (let i = 0; i < 12; i++) {
        measureAR(photos[(start + i) % photos.length].id);
      }
    };

    function runCycle() {
      // Look at the next batch of up to 6 photos and compute avg AR
      const maxCells = Math.min(photos.length, 6);
      const peekPhotos = Array.from({ length: maxCells }, (_, i) =>
        photos[(photoIdxRef.current + i) % photos.length]
      );
      peekPhotos.forEach((p) => measureAR(p.id));
      const avgRatio =
        peekPhotos.reduce((sum, p) => sum + getAR(p.id), 0) / peekPhotos.length;

      // Pick a new layout (prefers different count than last cycle)
      const newLayout = pickLayout(avgRatio, prevCountRef.current, maxCells);
      prevCountRef.current = newLayout.count;

      // Pre-allocate the exact photos this cycle will use (in order)
      const batch = Array.from({ length: newLayout.count }, () => {
        const p = photos[photoIdxRef.current];
        photoIdxRef.current = (photoIdxRef.current + 1) % photos.length;
        return p;
      });

      // Preload ARs for the cycle after this one
      preload(photoIdxRef.current);

      // Update layout immediately — grid structure re-flows
      setLayout(newLayout);

      // Ensure cells array length matches new layout (carry over or pad with null)
      setCells((prev) =>
        Array.from({ length: newLayout.count }, (_, i) =>
          prev[i] ?? { photo: null, flipKey: -(i + 1) }
        )
      );

      // Stagger photo updates in random order across all cells
      const order = Array.from({ length: newLayout.count }, (_, i) => i)
        .sort(() => Math.random() - 0.5);

      order.forEach((cellIdx, step) => {
        const t = setTimeout(() => {
          if (cancelled) return;
          setCells((prev) => {
            if (prev.length !== newLayout.count) return prev;
            const next = [...prev];
            next[cellIdx] = {
              photo: batch[cellIdx],
              flipKey: Date.now() + cellIdx,
            };
            return next;
          });
        }, step * STAGGER_MS);
        pending.push(t);
      });

      // Schedule the next cycle
      const cascadeDuration = (newLayout.count - 1) * STAGGER_MS;
      const t = setTimeout(() => {
        if (!cancelled) runCycle();
      }, cascadeDuration + cellInterval);
      pending.push(t);
    }

    // First cycle fires after the initial interval
    const first = setTimeout(() => { if (!cancelled) runCycle(); }, cellInterval);
    pending.push(first);

    return () => {
      cancelled = true;
      pending.forEach(clearTimeout);
    };
  }, [isPaused, photos, cellInterval, layout]);

  if (!layout || cells.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black">
        <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-black"
      style={{ opacity: brightness / 100 }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridTemplateRows: 'repeat(6, 1fr)',
          gap: '2px',
        }}
      >
        {layout.areas.map((area, i) => (
          <div
            key={i}
            style={{
              gridColumn: `${area.colStart} / ${area.colEnd}`,
              gridRow: `${area.rowStart} / ${area.rowEnd}`,
              position: 'relative',
              overflow: 'hidden',
              background: '#000',
            }}
          >
            {cells[i] && <GridCell cell={cells[i]} />}
          </div>
        ))}
      </div>
    </div>
  );
}
