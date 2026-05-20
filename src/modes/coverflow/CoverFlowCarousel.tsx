'use client';

import { useRef, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { SpotifyTrack } from '@/lib/spotify/now-playing';

type Track = Pick<SpotifyTrack, 'id' | 'name' | 'artists' | 'albumArtUrl' | 'albumName'>;

interface CoverFlowCarouselProps {
  history: Track[];
  current: Track;
  queue: Track[];
  dominantColor: string;
}

// All values scaled from the iPod-classic-js reference (128px base → 300px)
const COVER_PX = 300;
const S = COVER_PX / 128; // scale factor ≈ 2.34

const ACTIVE_X_OFFSET = Math.round(60 * S);  // px to subtract from midpoint for active cover
const ANCHOR = Math.round(46 * S);            // left-anchor offset for side covers
const SPACING = Math.round(48 * S);           // px between side cover centers
const PERSPECTIVE = Math.round(500 * S);      // css perspective depth

function getOffsetPx(offset: number, midpointX: number): number {
  // offset < 0 → history (left), offset > 0 → queue (right)
  const val = midpointX - ANCHOR + offset * SPACING;
  return val + (offset < 0 ? -SPACING : Math.round(SPACING / 2));
}

function coverTransform(offset: number, midpointX: number): string {
  if (offset === 0) {
    return `translate3d(${midpointX - ACTIVE_X_OFFSET}px, 4px, 20px)`;
  }
  const x = getOffsetPx(offset, midpointX);
  const ry = offset < 0 ? '70deg' : '-70deg';
  return `translateX(${x}px) scale(1.1) translateZ(-65px) rotateY(${ry})`;
}

interface EntryProps {
  track: Track;
  offset: number;
  midpointX: number;
  dominantColor: string;
}

function CoverEntry({ track, offset, midpointX, dominantColor }: EntryProps) {
  const isActive = offset === 0;
  const isHidden = !isActive && Math.abs(offset) > 8;
  const zIndex = isActive ? 100 : Math.max(0, 50 - Math.abs(offset));
  const transform = coverTransform(offset, midpointX);

  return (
    <motion.div
      // framer-motion handles enter/exit fade; CSS transition handles positional slide
      initial={{ opacity: 0 }}
      animate={{ opacity: isHidden ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${COVER_PX}px`,
        height: `${COVER_PX}px`,
        zIndex,
        // CSS transition animates the position when offset changes (same DOM node, new transform)
        transform,
        transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)',
        transformStyle: 'preserve-3d',
        WebkitBoxReflect:
          'below 0px -webkit-gradient(linear, left top, left bottom, from(transparent), color-stop(70%, transparent), to(rgba(240,240,240,0.18)))',
      }}
    >
      {track.albumArtUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.albumArtUrl}
          alt={track.name}
          style={{
            position: 'absolute',
            width: `${COVER_PX}px`,
            height: `${COVER_PX}px`,
            objectFit: 'cover',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: isActive
              ? `0 32px 100px rgba(0,0,0,0.9), 0 0 60px ${dominantColor}55`
              : '0 8px 32px rgba(0,0,0,0.75)',
            transition: 'box-shadow 0.6s ease',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            width: `${COVER_PX}px`,
            height: `${COVER_PX}px`,
            borderRadius: '8px',
            background: `linear-gradient(135deg, ${dominantColor}99, #111)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '80px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: isActive
              ? `0 32px 100px rgba(0,0,0,0.9), 0 0 60px ${dominantColor}55`
              : '0 8px 32px rgba(0,0,0,0.75)',
          }}
        >
          ♪
        </div>
      )}
    </motion.div>
  );
}

export default function CoverFlowCarousel({
  history,
  current,
  queue,
  dominantColor,
}: CoverFlowCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [midpointX, setMidpointX] = useState(0);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setMidpointX(containerRef.current.getBoundingClientRect().width / 2);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Flat ordered array: [...history, current, ...queue]
  // Key by track.id so the SAME DOM node persists when a cover shifts roles
  // (e.g. first queue item becomes current → same node, transform updates via CSS transition)
  const historySlice = history.slice(-5);
  const queueSlice = queue.slice(0, 5);

  const entries: { key: string; track: Track; offset: number }[] = [
    ...historySlice.map((t, i) => ({
      key: t.id,
      track: t,
      offset: i - historySlice.length,      // -5 … -1
    })),
    { key: current.id, track: current, offset: 0 },
    ...queueSlice.map((t, i) => ({
      key: t.id,
      track: t,
      offset: i + 1,                         // +1 … +5
    })),
  ];

  // Deduplicate keys (e.g. repeat listening — same song in queue and history)
  const seen = new Set<string>();
  const deduped = entries.map((e) => {
    const k = seen.has(e.key) ? `${e.key}-${e.offset}` : e.key;
    seen.add(e.key);
    return { ...e, key: k };
  });

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: `${COVER_PX + 60}px`,
        perspective: `${PERSPECTIVE}px`,
        paddingTop: '20px',
      }}
    >
      <AnimatePresence>
        {midpointX > 0 && deduped.map(({ key, track, offset }) => (
          <CoverEntry
            key={key}
            track={track}
            offset={offset}
            midpointX={midpointX}
            dominantColor={dominantColor}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
