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

// Shared image style: fills the cell, respects EXIF orientation
const FILL: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  imageOrientation: 'from-image',
  display: 'block',
};

/** Progressive-load: thumb first, hi-res swapped in once fetched */
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

/** Single grid cell with cross-fade when its photo changes */
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
  // intervalSeconds is the canonical key; cellIntervalSeconds is the legacy key
  const cellInterval = ((cfg.cellIntervalSeconds ?? (config as Record<string, unknown>).intervalSeconds as number) ?? 300) * 1000;

  const { photos } = usePhotoRotation({ albumIds, shuffle: true });
  const [layout, setLayout] = useState<Layout | null>(null);
  const [cells, setCells] = useState<CellState[]>([]);
  const photoIdxRef = useRef(0);
  const initialized = useRef(false);

  // One-time init once photos are ready
  useEffect(() => {
    if (photos.length === 0 || initialized.current) return;
    const l = pickLayout(photos);
    if (!l) return;
    initialized.current = true;
    setLayout(l);
    setCells(
      l.areas.map((_, i) => ({
        photo: photos[i % photos.length],
        flipKey: i,
      }))
    );
    photoIdxRef.current = l.areas.length % photos.length;
    onReady?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  // Staggered animation: change ONE random cell per interval
  useEffect(() => {
    if (isPaused || photos.length === 0 || cells.length === 0) return;

    const id = setInterval(() => {
      const cellIdx = Math.floor(Math.random() * cells.length);
      const nextPhoto = photos[photoIdxRef.current];
      photoIdxRef.current = (photoIdxRef.current + 1) % photos.length;

      setCells((prev) => {
        const next = [...prev];
        next[cellIdx] = { photo: nextPhoto, flipKey: prev[cellIdx].flipKey + 100 };
        return next;
      });
    }, cellInterval);

    return () => clearInterval(id);
  }, [isPaused, photos, cells.length, cellInterval]);

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
