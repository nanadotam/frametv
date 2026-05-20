'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import { pickLayout, computeCellAR, type Layout } from './layout';
import { getPhotoRotation, cellRotationStyle } from '@/lib/photoRotation';
import type { Photo } from '@/types/db';
import { photoThumbUrl, photoFullUrl, getConnectionSpeed, IMG_SIZES } from '@/lib/image-urls';

interface SlideshowGridConfig {
  cellIntervalSeconds?: number;
  focusMode?: boolean;
  staggerMs?: number;
}

interface CellState {
  photo: Photo | null;
  flipKey: number;
}

// Module-level AR cache — persists for page lifetime
const AR_CACHE = new Map<string, number>();

function measureAR(photo: Photo): void {
  if (AR_CACHE.has(photo.id)) return;
  const img = new Image();
  (img as HTMLImageElement & { fetchPriority: string }).fetchPriority = 'low';
  img.src = photoThumbUrl(photo, IMG_SIZES.ar);
  img.onload = () => {
    if (img.naturalWidth && img.naturalHeight) {
      AR_CACHE.set(photo.id, img.naturalWidth / img.naturalHeight);
    }
  };
}

function getAR(photoId: string): number {
  return AR_CACHE.get(photoId) ?? 1;
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

// Ken Burns pan directions — cycle through these per cell to avoid monotony
const KB_VARIANTS = [
  { scale: 1.06, x: '-1.5%', y: '-1%'   },
  { scale: 1.06, x: '1.5%',  y: '-1%'   },
  { scale: 1.06, x: '-1%',   y: '1%'    },
  { scale: 1.04, x: '0%',    y: '-1.5%' },
] as const;

// Transition style pool — one is picked per cell flip based on flipKey
const CELL_TRANSITIONS = [
  // zoom-fade with spring easing
  {
    initial:    { opacity: 0, scale: 1.06 },
    animate:    { opacity: 1, scale: 1    },
    exit:       { opacity: 0, scale: 0.96 },
    transition: {
      opacity: { duration: 0.8,  ease: [0.25, 0.46, 0.45, 0.94] },
      scale:   { duration: 0.85, ease: [0.34, 1.20, 0.64, 1]    },
    },
  },
  // slide-up-fade
  {
    initial:    { opacity: 0, y: 14  },
    animate:    { opacity: 1, y: 0   },
    exit:       { opacity: 0, y: -10 },
    transition: { duration: 0.75, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  // pure dissolve
  {
    initial:    { opacity: 0 },
    animate:    { opacity: 1 },
    exit:       { opacity: 0 },
    transition: { duration: 1.0, ease: 'easeInOut' },
  },
  // zoom-in with slight overshoot
  {
    initial:    { opacity: 0, scale: 1.10 },
    animate:    { opacity: 1, scale: 1    },
    exit:       { opacity: 0, scale: 0.92 },
    transition: {
      opacity: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] },
      scale:   { duration: 0.9, ease: [0.34, 1.56, 0.64, 1]    },
    },
  },
] as const;

function useProgressiveSrc(photo: Photo | undefined) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) { setSrc(null); return; }
    const isSlow = getConnectionSpeed() === 'slow';
    setSrc(photoThumbUrl(photo, isSlow ? IMG_SIZES.thumb_medium : IMG_SIZES.thumb_large));
    if (isSlow) return;

    let dead = false;
    const full = photoFullUrl(photo);
    const img = new Image();
    (img as HTMLImageElement & { fetchPriority: string }).fetchPriority = 'low';
    img.onload = () => { if (!dead) setSrc(full); };
    img.src = full;
    return () => { dead = true; img.onload = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id]);

  return src;
}

function PhotoCell({ photo, dwellMs, kbIdx }: {
  photo: Photo | null;
  dwellMs: number;
  kbIdx: number;
}) {
  const src = useProgressiveSrc(photo ?? undefined);
  const [mainLoaded, setMainLoaded] = useState(false);
  const rotation = getPhotoRotation(photo);
  const rotStyle = cellRotationStyle(rotation);

  useEffect(() => { setMainLoaded(false); }, [photo?.id]);

  // 200px AR image already in cache from measureAR() — reuse as LQIP
  const lqipSrc = photo ? photoThumbUrl(photo, IMG_SIZES.ar) : null;
  const kb = KB_VARIANTS[kbIdx % KB_VARIANTS.length];

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#111', overflow: 'hidden' }}>
      {/* Ken Burns wrapper — starts animating once the image is painted */}
      <motion.div
        style={{ position: 'absolute', inset: 0 }}
        initial={{ scale: 1, x: '0%', y: '0%' }}
        animate={mainLoaded
          ? { scale: kb.scale, x: kb.x, y: kb.y }
          : { scale: 1,        x: '0%', y: '0%' }}
        transition={{ duration: dwellMs / 1000, ease: 'linear' }}
      >
        {/* LQIP: blurred 200px fill, already cached from AR measurement */}
        {lqipSrc && !mainLoaded && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lqipSrc} aria-hidden alt=""
            style={{ ...FILL, filter: 'blur(20px)', transform: 'scale(1.1)' }} />
        )}
        {src && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} aria-hidden alt=""
              style={{ ...FILL, filter: 'blur(24px) brightness(0.55)', transform: `scale(1.15)${rotation ? ` rotate(${rotation}deg)` : ''}` }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt=""
              style={{ ...FILL, zIndex: 1, ...rotStyle, opacity: mainLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
              onLoad={() => setMainLoaded(true)} />
          </>
        )}
      </motion.div>
    </div>
  );
}

// Per-cell transitions — picked from pool using flipKey for variety
function GridCell({ cell, dwellMs }: { cell: CellState; dwellMs: number }) {
  const tIdx = Math.abs(cell.flipKey) % CELL_TRANSITIONS.length;
  const t = CELL_TRANSITIONS[tIdx];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* mode="sync" (default) — exit and enter cross-fade simultaneously */}
      <AnimatePresence>
        <motion.div
          key={cell.flipKey}
          style={{ position: 'absolute', inset: 0 }}
          initial={t.initial as never}
          animate={t.animate as never}
          exit={t.exit as never}
          transition={t.transition as never}
        >
          <PhotoCell photo={cell.photo} dwellMs={dwellMs} kbIdx={tIdx} />
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
    ((cfg.cellIntervalSeconds ??
      (config as Record<string, unknown>).intervalSeconds as number) ?? 300) * 1000;
  const focusMode = cfg.focusMode ?? false;
  const staggerMs = cfg.staggerMs ?? 1000;

  const { photos } = usePhotoRotation({ albumIds, shuffle: true });
  const maxCells  = Math.min(photos.length, focusMode ? 1 : 6);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [cells,  setCells]  = useState<CellState[]>([]);
  // isReady gates the cascade effect without putting `layout` in its deps
  const [isReady, setIsReady] = useState(false);

  const photoIdxRef    = useRef(0);
  const prevCountRef   = useRef<number | null>(null);
  // Mirror of layout state — lets cascade read current layout without being
  // in the effect's dep array (which would cancel pending timeouts on every setLayout call)
  const layoutRef      = useRef<Layout | null>(null);
  const initialized    = useRef(false);
  // Track IDs shown in the last cycle so we never reuse them in the same grid
  const recentlyUsedRef = useRef<Set<string>>(new Set());

  // ── One-time init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (photos.length === 0 || initialized.current) return;
    initialized.current = true;

    photos.slice(0, 30).forEach(measureAR);

    const initial = pickLayout(1, null, maxCells);
    prevCountRef.current = initial.count;
    layoutRef.current    = initial;
    setLayout(initial);
    setCells(
      initial.areas.map((_, i) => ({
        photo: photos[i % photos.length],
        flipKey: i,
      }))
    );
    photoIdxRef.current = initial.count % photos.length;
    onReady?.();
    setIsReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  // ── Cascade + layout cycle ────────────────────────────────────────────────
  // IMPORTANT: `layout` is intentionally NOT in the dep array.
  // We use layoutRef so that calling setLayout() inside runCycle does NOT
  // trigger the cleanup → cancel-all-timeouts → restart loop.
  useEffect(() => {
    if (!isReady || isPaused || photos.length < (focusMode ? 1 : 3)) return;

    const STAGGER_MS = staggerMs;
    const pending: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    function preload(start: number) {
      for (let i = 0; i < 12; i++) {
        measureAR(photos[(start + i) % photos.length]);
      }
    }

    function runCycle() {
      // maxCells is from the component scope (respects focusMode)

      // Peek at upcoming photos for AR calculation
      const peekPhotos = Array.from({ length: maxCells }, (_, i) =>
        photos[(photoIdxRef.current + i) % photos.length]
      );
      peekPhotos.forEach(measureAR);
      const avgRatio =
        peekPhotos.reduce((sum, p) => sum + getAR(p.id), 0) / peekPhotos.length;

      // Pick new layout (prefer different count than last cycle)
      const newLayout = pickLayout(avgRatio, prevCountRef.current, maxCells);
      prevCountRef.current = newLayout.count;

      // Build a candidate pool from the next slice of the photo rotation,
      // excluding photos currently on screen. Pool is 4× the cell count so
      // there's enough variety for the AR-matching step below.
      const excluded = new Set(recentlyUsedRef.current);
      const POOL_SIZE = Math.min(photos.length, Math.max(newLayout.count * 4, 20));
      const pool: { photo: Photo; ar: number }[] = [];

      for (let i = 0; pool.length < POOL_SIZE; i++) {
        if (i >= photos.length) break; // exhausted library
        const p = photos[(photoIdxRef.current + i) % photos.length];
        if (!excluded.has(p.id) && !pool.find((c) => c.photo.id === p.id)) {
          pool.push({ photo: p, ar: getAR(p.id) });
        }
      }

      // Fallback: if the pool is too small, allow recently-used photos
      for (let i = 0; pool.length < newLayout.count; i++) {
        const p = photos[(photoIdxRef.current + i) % photos.length];
        if (!pool.find((c) => c.photo.id === p.id)) {
          pool.push({ photo: p, ar: getAR(p.id) });
        }
      }

      // Greedy AR matching: for each cell pick the pool photo whose AR is
      // closest to the cell's display AR (log-scale diff = scale-invariant).
      const remaining = [...pool];
      const batch: Photo[] = newLayout.areas.map((area) => {
        const target = computeCellAR(area);
        let bestIdx = 0;
        let bestScore = Infinity;
        remaining.forEach(({ ar }, i) => {
          const score = Math.abs(Math.log(ar / target));
          if (score < bestScore) { bestScore = score; bestIdx = i; }
        });
        const [chosen] = remaining.splice(bestIdx, 1);
        return chosen.photo;
      });

      // Advance rotation index by the number of cells used this cycle
      photoIdxRef.current = (photoIdxRef.current + newLayout.count) % photos.length;
      // Remember what's showing so the next cycle can exclude them
      recentlyUsedRef.current = new Set(batch.map((p) => p.id));

      preload(photoIdxRef.current);

      // Update layout ref + state (state for rendering, ref for the effect)
      layoutRef.current = newLayout;
      setLayout(newLayout);

      // Ensure cells array is the right length before the cascade starts
      setCells((prev) =>
        Array.from({ length: newLayout.count }, (_, i) =>
          prev[i] ?? { photo: null, flipKey: -(Date.now() + i) }
        )
      );

      // Cascade: update each cell in random order, 1 s apart
      const order = Array.from({ length: newLayout.count }, (_, i) => i)
        .sort(() => Math.random() - 0.5);

      order.forEach((cellIdx, step) => {
        const t = setTimeout(() => {
          if (cancelled) return;
          setCells((prev) => {
            // Guard: only update if the array is still the right length
            // (handles edge case where another setLayout already ran)
            if (cellIdx >= prev.length) return prev;
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

      // Next cycle fires after cascade finishes + the configured interval
      const cascadeDone = (newLayout.count - 1) * STAGGER_MS;
      const t = setTimeout(() => {
        if (!cancelled) runCycle();
      }, cascadeDone + cellInterval);
      pending.push(t);
    }

    // First cycle starts after the initial interval
    const first = setTimeout(() => { if (!cancelled) runCycle(); }, cellInterval);
    pending.push(first);

    return () => {
      cancelled = true;
      pending.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, isPaused, photos, cellInterval, focusMode, staggerMs]);
  // ↑ `layout` is deliberately excluded — see comment above

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
        {/* Use position-based keys so AnimatePresence fades cells in/out
            when the layout changes — cells that stay in the same grid area
            persist; cells that move or appear/disappear cross-fade. */}
        <AnimatePresence>
          {layout.areas.map((area, i) => (
            <motion.div
              key={`${area.colStart}-${area.colEnd}-${area.rowStart}-${area.rowEnd}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{
                gridColumn: `${area.colStart} / ${area.colEnd}`,
                gridRow: `${area.rowStart} / ${area.rowEnd}`,
                position: 'relative',
                overflow: 'hidden',
                background: '#000',
              }}
            >
              {cells[i] && <GridCell cell={cells[i]} dwellMs={cellInterval} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
