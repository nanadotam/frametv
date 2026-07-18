'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import { getPhotoRotation, cellRotationStyle } from '@/lib/photoRotation';
import type { Photo } from '@/types/db';
import { photoThumbUrl, getConnectionSpeed, IMG_SIZES } from '@/lib/image-urls';

export type ScrapbookBackground = 'plain' | 'cork' | 'denim' | 'chalkboard' | 'velvet' | 'kraft';

interface ScrapbookConfig {
  intervalSeconds?: number;
  maxOnScreen?: number;
  tapeFrequency?: number;
  showDate?: boolean;
  background?: ScrapbookBackground;
}

// Pure CSS textures — no image assets to host, painted once (not animated),
// so they cost nothing extra on low-end devices.
export const SCRAPBOOK_BACKGROUNDS: Record<ScrapbookBackground, { label: string; css: string }> = {
  plain: {
    label: 'Plain',
    css: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,.05), transparent 60%), #0a0a0a',
  },
  cork: {
    label: 'Cork board',
    css:
      'radial-gradient(circle at 1px 1px, rgba(0,0,0,.16) 1px, transparent 0) 0 0/8px 8px, ' +
      'linear-gradient(160deg, #c49a6c, #8a6239)',
  },
  denim: {
    label: 'Denim',
    css:
      'repeating-linear-gradient(45deg, rgba(255,255,255,.05) 0 2px, transparent 2px 4px), ' +
      'repeating-linear-gradient(-45deg, rgba(0,0,0,.08) 0 2px, transparent 2px 4px), ' +
      'linear-gradient(160deg, #4f6d8f, #2c435c)',
  },
  chalkboard: {
    label: 'Chalkboard',
    css:
      'radial-gradient(circle at 1px 1px, rgba(255,255,255,.045) 1px, transparent 0) 0 0/5px 5px, ' +
      'linear-gradient(160deg, #1f2f28, #14201b)',
  },
  velvet: {
    label: 'Velvet',
    css:
      'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.06), transparent 55%), ' +
      'radial-gradient(ellipse at 70% 80%, rgba(120,20,60,.25), transparent 60%), ' +
      'linear-gradient(160deg, #2a0f1e, #120610)',
  },
  kraft: {
    label: 'Kraft paper',
    css:
      'repeating-linear-gradient(0deg, rgba(0,0,0,.025) 0 1px, transparent 1px 3px), ' +
      'linear-gradient(160deg, #cbb08a, #a9885f)',
  },
};

interface PlacedPolaroid {
  key: number;
  photo: Photo;
  src: string;
  x: number; // percent
  y: number; // percent
  rotation: number; // degrees, settled resting angle
  tossFrom: number; // degrees, extra rotation during the toss-in
  restScale: number; // final resting size, slight per-card variance
  hasTape: boolean;
  tapeCorner: 'left' | 'right';
  z: number;
}

let placementCounter = 0;

// Low-end signal: few CPU cores or little RAM (Chrome/Android TV report these).
// Falls back to "capable" when the browser doesn't expose them (e.g. Safari).
function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  return lowMemory || lowCores;
}

// A ~300px CSS box at 2x DPI only needs ~600px source — thumb_large (800px) was
// overkill and slower to decode on weak devices. Drop a size tier when the
// connection is slow or the device looks low-end.
function pickImageSize(): number {
  const slow = getConnectionSpeed() === 'slow';
  return slow || isLowEndDevice() ? IMG_SIZES.thumb_small : IMG_SIZES.thumb_medium;
}

// Resolves once the image has loaded, failed, or timed out — never rejects,
// so a slow/broken photo can't stall the toss queue forever.
function preloadImage(src: string, timeoutMs = 2500): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(resolve, timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(); };
    img.onerror = () => { clearTimeout(timer); resolve(); };
    img.src = src;
  });
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ── Spatial layout ──────────────────────────────────────────────────────────
// Pure random x/y (or "cluster near an existing card") drifts toward hot
// spots over a long run — the more cards land somewhere, the more likely
// the next one lands nearby too, so two or three spots fill up while most
// of the screen stays empty.
//
// Instead we divide the screen into a grid sized to the on-screen count and
// hand out cells from a shuffled "bag": every cell gets used exactly once
// before any cell repeats (same trick Tetris uses for piece order), which
// guarantees full-screen coverage no matter how long the mode runs. Each
// card still gets a healthy jitter within (and slightly beyond) its cell so
// the grid itself is never visible.
function gridDims(cellCount: number) {
  const cols = Math.max(2, Math.round(Math.sqrt(cellCount * (16 / 9))));
  const rows = Math.max(2, Math.ceil(cellCount / cols));
  return { cols, rows };
}

function shuffledBag(size: number): number[] {
  const bag = Array.from({ length: size }, (_, i) => i);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function positionForCell(cellIndex: number, cols: number, rows: number) {
  const PAD = 8;
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  const cx = col * cellW + cellW / 2;
  const cy = row * cellH + cellH / 2;
  return {
    x: clamp(cx + (Math.random() - 0.5) * cellW * 0.8, PAD, 100 - PAD),
    y: clamp(cy + (Math.random() - 0.5) * cellH * 0.8, PAD, 100 - PAD),
  };
}

function formatCaption(photo: Photo): string {
  const raw = photo.taken_at ?? photo.created_at;
  if (!raw) return '';
  try {
    return format(new Date(raw), 'dd/MM/yy');
  } catch {
    return '';
  }
}

function TapeStrip({ corner }: { corner: 'left' | 'right' }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: -14,
        [corner === 'left' ? 'left' : 'right']: '18%',
        width: 64,
        height: 26,
        background: 'linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,.32))',
        transform: `rotate(${corner === 'left' ? -9 : 9}deg)`,
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        borderRadius: 1,
      } as React.CSSProperties}
    />
  );
}

function PolaroidCard({ item, showDate }: { item: PlacedPolaroid; showDate: boolean }) {
  const rotation = getPhotoRotation(item.photo);
  const caption = showDate ? formatCaption(item.photo) : '';

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -90,
        scale: item.restScale * 0.85,
        rotate: item.rotation + item.tossFrom,
      }}
      animate={{ opacity: 1, y: 0, scale: item.restScale, rotate: item.rotation }}
      exit={{ opacity: 0, scale: item.restScale * 0.92, y: 18, transition: { duration: 0.35, ease: [0.4, 0, 1, 1] } }}
      transition={{ type: 'spring', duration: 0.55, bounce: 0.22 }}
      style={{
        position: 'absolute',
        left: `${item.x}%`,
        top: `${item.y}%`,
        translateX: '-50%',
        translateY: '-50%',
        zIndex: item.z,
        width: 'clamp(200px, 20vw, 300px)',
        willChange: 'transform, opacity',
      }}
    >
      <div
        style={{
          position: 'relative',
          background: '#fafaf7',
          padding: '10px 10px 0',
          borderRadius: 2,
          boxShadow: '0 18px 40px rgba(0,0,0,.5), 0 3px 10px rgba(0,0,0,.3)',
        }}
      >
        {/* Soft landing glow — pure opacity, cheap on every GPU, plays once on mount */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          style={{
            position: 'absolute',
            inset: -18,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,.35), transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        {item.hasTape && <TapeStrip corner={item.tapeCorner} />}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            overflow: 'hidden',
            background: '#111',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.src}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              ...cellRotationStyle(rotation),
            }}
          />
        </div>
        <div
          style={{
            height: 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 4px 14px',
          }}
        >
          {caption && (
            <span
              style={{
                fontFamily: 'var(--font-clock-dancing), cursive',
                fontSize: '1.15rem',
                color: '#3a3a3a',
              }}
            >
              {caption}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ScrapbookMode({ config, brightness, isPaused, albumIds, onReady }: ModeProps) {
  const cfg = config as ScrapbookConfig;
  const intervalSeconds = Math.max(1, cfg.intervalSeconds ?? 6);
  const tapeFrequency = typeof cfg.tapeFrequency === 'number' ? cfg.tapeFrequency : 0.35;
  const showDate = cfg.showDate ?? true;
  const background = SCRAPBOOK_BACKGROUNDS[cfg.background ?? 'plain']?.css ?? SCRAPBOOK_BACKGROUNDS.plain.css;

  // Cap concurrent on-screen (and therefore concurrently-animating) cards
  // harder on low-end devices, regardless of the configured value.
  const [maxOnScreen] = useState(() => {
    const configured = Math.max(2, Math.min(cfg.maxOnScreen ?? 7, 30));
    return isLowEndDevice() ? Math.min(configured, 5) : configured;
  });
  const [imageSize] = useState(pickImageSize);

  const { photos: allPhotos } = usePhotoRotation({ albumIds, shuffle: true });
  const [placed, setPlaced] = useState<PlacedPolaroid[]>([]);

  const photosRef = useRef<Photo[]>([]);
  const indexRef = useRef(0);
  const placedRef = useRef<PlacedPolaroid[]>([]);
  const isPausedRef = useRef(isPaused);
  const tossingRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    photosRef.current = allPhotos;
  }, [allPhotos]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    placedRef.current = placed;
  }, [placed]);

  // Grid cell "bag" for placement — sized to how many cards are ever on
  // screen at once, reshuffled each time it empties. See gridDims/shuffledBag
  // above for why this replaced plain random x/y.
  const gridRef = useRef<{ cols: number; rows: number; bag: number[] }>({ cols: 0, rows: 0, bag: [] });

  const nextCellPosition = () => {
    const { cols, rows } = gridDims(maxOnScreen);
    const grid = gridRef.current;
    if (grid.cols !== cols || grid.rows !== rows || grid.bag.length === 0) {
      grid.cols = cols;
      grid.rows = rows;
      grid.bag = shuffledBag(cols * rows);
    }
    const cellIndex = grid.bag.pop()!;
    return positionForCell(cellIndex, cols, rows);
  };

  // Toss the first polaroid in immediately, then keep tossing on an interval.
  // Each toss preloads its image fully before entering — a single load at a
  // time, in order, so nothing pops in half-loaded and low-bandwidth devices
  // never have more than one photo fetch in flight.
  useEffect(() => {
    cancelledRef.current = false;
    if (allPhotos.length === 0) return;

    const tossOne = async () => {
      if (isPausedRef.current || tossingRef.current) return;
      const photos = photosRef.current;
      if (photos.length === 0) return;
      tossingRef.current = true;

      const photo = photos[indexRef.current % photos.length];
      indexRef.current += 1;
      const src = photoThumbUrl(photo, imageSize);

      await preloadImage(src);
      if (cancelledRef.current) return;

      const pos = nextCellPosition();
      placementCounter += 1;

      const next: PlacedPolaroid = {
        key: placementCounter,
        photo,
        src,
        x: pos.x,
        y: pos.y,
        rotation: -12 + Math.random() * 24,
        tossFrom: Math.random() > 0.5 ? 22 + Math.random() * 16 : -(22 + Math.random() * 16),
        restScale: 0.93 + Math.random() * 0.12,
        hasTape: Math.random() < tapeFrequency,
        tapeCorner: Math.random() > 0.5 ? 'left' : 'right',
        z: placementCounter,
      };

      setPlaced((prev) => {
        const updated = [...prev, next];
        return updated.length > maxOnScreen ? updated.slice(updated.length - maxOnScreen) : updated;
      });
      tossingRef.current = false;
    };

    tossOne();
    const timer = setInterval(tossOne, intervalSeconds * 1000);
    return () => {
      cancelledRef.current = true;
      clearInterval(timer);
    };
  }, [allPhotos.length, intervalSeconds, maxOnScreen, tapeFrequency, imageSize]);

  useEffect(() => {
    if (placed.length > 0) onReady?.();
  }, [placed.length, onReady]);

  if (allPhotos.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black">
        <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        opacity: brightness / 100,
        background,
      }}
    >
      <AnimatePresence>
        {placed.map((item) => (
          <PolaroidCard key={item.key} item={item} showDate={showDate} />
        ))}
      </AnimatePresence>
    </div>
  );
}
