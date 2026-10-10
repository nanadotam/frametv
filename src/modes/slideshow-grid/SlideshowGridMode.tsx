'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import { planGrid, type Layout } from './layout';
import { getPhotoRotation, cellRotationStyle, CELL_CONTAINER } from '@/lib/photoRotation';
import { seedFocalCache, getFocal, focalToObjectPosition, detectAndPersistFocal } from '@/lib/focalPoint';
import type { Photo } from '@/types/db';
import { photoThumbUrl, photoFullUrl, getConnectionSpeed, IMG_SIZES } from '@/lib/image-urls';
import InlineVideo from '@/components/display/InlineVideo';

interface SlideshowGridConfig {
  cellIntervalSeconds?: number;
  focusMode?: boolean;
  staggerMs?: number;
  maxCells?: number;
  /** Mix the active albums' videos in among the stills */
  multimodal?: boolean;
}

interface CellState {
  photo: Photo | null;
  flipKey: number;
}

// Module-level AR cache — persists for page lifetime. Measured from the
// thumbnail as actually rendered, so it reflects the photo's real orientation.
const AR_CACHE = new Map<string, number>();
const AR_PENDING = new Map<string, Promise<void>>();

function measureAR(photo: Photo): Promise<void> {
  if (AR_CACHE.has(photo.id)) return Promise.resolve();
  const pending = AR_PENDING.get(photo.id);
  if (pending) return pending;
  const p = new Promise<void>((resolve) => {
    const img = new Image();
    (img as HTMLImageElement & { fetchPriority: string }).fetchPriority = 'low';
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        AR_CACHE.set(photo.id, img.naturalWidth / img.naturalHeight);
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = photoThumbUrl(photo, IMG_SIZES.ar);
  }).finally(() => AR_PENDING.delete(photo.id));
  AR_PENDING.set(photo.id, p);
  return p;
}

/** Shape the photo will be displayed at, or null if not measured yet. */
function knownAR(photo: Photo): number | null {
  let ar = AR_CACHE.get(photo.id) ?? null;
  // Uploaded videos store their display dimensions
  if (ar === null && photo.media_type === 'video' && photo.width && photo.height) {
    ar = photo.width / photo.height;
  }
  if (ar === null) return null;
  // Manual 90°/270° rotation turns the displayed shape on its side
  const rot = getPhotoRotation(photo);
  return rot === 90 || rot === 270 ? 1 / ar : ar;
}

function getAR(photo: Photo): number {
  return knownAR(photo) ?? 1;
}

function getScreenAR(): number {
  if (typeof window === 'undefined' || !window.innerHeight) return 16 / 9;
  return window.innerWidth / window.innerHeight;
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

/** Video cell: poster holds the frame, the clip fades in once playing.
 *  No Ken Burns — the footage already moves. */
function VideoCell({ photo, isPaused }: { photo: Photo; isPaused: boolean }) {
  const [playing, setPlaying] = useState(false);
  const poster = photoThumbUrl(photo, IMG_SIZES.thumb_large);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#111', overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" style={FILL} />
      <InlineVideo
        src={photo.storage_path!}
        isPaused={isPaused}
        onPlaying={() => setPlaying(true)}
        style={{ ...FILL, zIndex: 1, opacity: playing ? 1 : 0, transition: 'opacity 0.6s ease' }}
      />
    </div>
  );
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

  const lqipSrc = photo ? photoThumbUrl(photo, IMG_SIZES.ar) : null;
  const kb = KB_VARIANTS[kbIdx % KB_VARIANTS.length];

  // Focal point → CSS object-position for smart face-aware cropping
  const focal = photo ? getFocal(photo) : null;
  const photoAR = photo ? getAR(photo) : 1;
  const objPos = focalToObjectPosition(focal, photoAR);

  // When manual rotation is applied, disable EXIF auto-rotation to prevent
  // double-correction (browser imageOrientation + CSS transform).
  const orientationOverride: React.CSSProperties =
    rotation !== 0 ? { imageOrientation: 'none' } : {};

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#111', overflow: 'hidden', ...CELL_CONTAINER }}>
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
            style={{ ...FILL, ...orientationOverride, ...rotStyle, filter: 'blur(20px)', objectPosition: objPos }} />
        )}
        {src && (
          <>
            {/* Blurred background fill — keeps edges dark while sharp image fades in */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} aria-hidden alt=""
              style={{ ...FILL, ...orientationOverride, ...rotStyle, filter: 'blur(24px) brightness(0.55)', objectPosition: objPos }} />
            {/* Sharp main image — fades in on load, triggers face detection */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt=""
              style={{ ...FILL, ...orientationOverride, zIndex: 1, ...rotStyle, objectPosition: objPos, opacity: mainLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
              onLoad={(e) => {
                setMainLoaded(true);
                if (photo) detectAndPersistFocal(photo, e.currentTarget);
              }} />
          </>
        )}
      </motion.div>
    </div>
  );
}

// Per-cell transitions — picked from pool using flipKey for variety
function GridCell({ cell, dwellMs, isPaused }: { cell: CellState; dwellMs: number; isPaused: boolean }) {
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
          {cell.photo?.media_type === 'video' && cell.photo.storage_path
            ? <VideoCell photo={cell.photo} isPaused={isPaused} />
            : <PhotoCell photo={cell.photo} dwellMs={dwellMs} kbIdx={tIdx} />}
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
  const cellInterval = Math.max(5, (cfg.cellIntervalSeconds ??
      (config as Record<string, unknown>).intervalSeconds as number) ?? 300) * 1000;
  const focusMode = cfg.focusMode ?? false;
  const staggerMs = cfg.staggerMs ?? 1000;
  const configuredMaxCells = Math.max(3, Math.min(cfg.maxCells ?? 6, 12));
  const multimodal = cfg.multimodal ?? false;

  const { photos } = usePhotoRotation({
    albumIds,
    shuffle: true,
    mediaType: multimodal ? 'all' : 'image',
  });
  const maxCells  = Math.min(photos.length, focusMode ? 1 : configuredMaxCells);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [cells,  setCells]  = useState<CellState[]>([]);
  const cellsRef = useRef<CellState[]>([]);
  useEffect(() => { cellsRef.current = cells; }, [cells]);
  // isReady gates the cascade effect without putting `layout` in its deps
  const [isReady, setIsReady] = useState(false);

  const photoIdxRef    = useRef(0);
  const prevCountRef   = useRef<number | null>(null);
  // Mirror of layout state — lets cascade read current layout without being
  // in the effect's dep array (which would cancel pending timeouts on every setLayout call)
  const layoutRef      = useRef<Layout | null>(null);
  const initialized    = useRef(false);
  // Everything shown so far this round. Nothing — photo or video — repeats
  // until every item in the rotation has had a turn; then a new round starts.
  const shownRef = useRef<Set<string>>(new Set());
  const [screenAR, setScreenAR] = useState(getScreenAR);
  const screenARRef = useRef(screenAR);
  useEffect(() => {
    const onResize = () => setScreenAR(getScreenAR());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => { screenARRef.current = screenAR; }, [screenAR]);

  // ── One-time init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (photos.length === 0 || initialized.current) return;
    initialized.current = true;

    seedFocalCache(photos);
    const first = photos.slice(0, Math.min(photos.length, Math.max(maxCells * 4, 20)));
    photos.slice(0, 40).forEach(measureAR);

    // Give the first shapes a moment to measure so the opening layout fits too
    let cancelled = false;
    let done = false;
    const timeout = new Promise((r) => setTimeout(r, 1500));
    Promise.race([Promise.all(first.map(measureAR)), timeout]).then(() => {
      if (cancelled) return;
      done = true;
      const plan = planGrid(first.map(getAR), null, maxCells, screenARRef.current, focusMode);
      prevCountRef.current = plan.layout.count;
      layoutRef.current    = plan.layout;
      setLayout(plan.layout);
      setCells(plan.picks.map((p, i) => ({ photo: first[p], flipKey: i })));
      shownRef.current = new Set(plan.picks.map((p) => first[p].id));
      photoIdxRef.current = plan.layout.count % photos.length;
      onReady?.();
      setIsReady(true);
    });
    return () => {
      cancelled = true;
      // Unmounted / list changed before the first layout landed — retry
      if (!done) initialized.current = false;
    };
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

    const POOL_SIZE = Math.min(photos.length, Math.max(maxCells * 4, 20));

    /** Next not-yet-shown items in rotation order, starting at the cursor. */
    function upcoming(limit: number): Photo[] {
      const out: Photo[] = [];
      for (let i = 0; i < photos.length && out.length < limit; i++) {
        const p = photos[(photoIdxRef.current + i) % photos.length];
        if (!shownRef.current.has(p.id)) out.push(p);
      }
      return out;
    }

    // Measure the upcoming unshown items so their shapes are known before
    // they're needed
    function preload() {
      upcoming(40).forEach((p) => void measureAR(p));
    }

    function runCycle() {
      // Round over — too few unshown items left to fill a grid. Start a new
      // round, keeping what's on screen now excluded so it can't reappear
      // straight away.
      if (upcoming(maxCells).length < maxCells) {
        const onScreen = new Set(
          cellsRef.current.flatMap((c) => (c.photo ? [c.photo.id] : []))
        );
        shownRef.current = photos.length - onScreen.size >= maxCells ? onScreen : new Set();
      }

      // Candidate pool: the next unshown items, preferring ones whose shape
      // is already measured — an unknown shape would be guessed as square
      // and could land in the wrong cell.
      const window_ = upcoming(POOL_SIZE * 2);
      const measured = window_.filter((p) => knownAR(p) !== null);
      const pool = (measured.length >= maxCells * 2 ? measured : window_).slice(0, POOL_SIZE);

      // Pick the template and the photo for each cell together, so the
      // layout matches the shapes of the photos actually going into it
      const plan = planGrid(pool.map(getAR), prevCountRef.current, maxCells, screenARRef.current, focusMode);
      const newLayout = plan.layout;
      prevCountRef.current = newLayout.count;
      const batch: Photo[] = plan.picks.map((i) => pool[i]);

      // Mark them shown for this round, and move the cursor to the first
      // item still waiting its turn
      batch.forEach((p) => shownRef.current.add(p.id));
      const next = upcoming(1)[0];
      if (next) photoIdxRef.current = photos.findIndex((p) => p.id === next.id);

      preload();

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
              {cells[i] && <GridCell cell={cells[i]} dwellMs={cellInterval} isPaused={isPaused} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
