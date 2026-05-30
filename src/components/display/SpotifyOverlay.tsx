'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpotifyNowPlaying } from '@/hooks/useSpotifyNowPlaying';
import type { ClockPosition } from './ClockOverlay';
import type { SpotifyTrack } from '@/lib/spotify/now-playing';

// ─── Position + gradient helpers ──────────────────────────────────────────────

function overlayPosition(clockPos: ClockPosition): string {
  return clockPos.includes('right') ? 'bottom-6 left-8' : 'bottom-6 right-8';
}

// A wide, feathered corner vignette that blends into any photo background.
// Gradient runs from the nearest corner outward — direction flips based on side.
function cornerGradient(clockPos: ClockPosition): React.CSSProperties {
  const fromLeft = clockPos.includes('right'); // overlay is on the left when clock is right
  return {
    position: 'absolute',
    // Extend well beyond the content so the fade starts far from the albums
    top: '-70px',
    bottom: '-20px',
    left: fromLeft ? '-60px' : '-20px',
    right: fromLeft ? '-20px' : '-60px',
    background: fromLeft
      ? 'linear-gradient(to top right, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.22) 38%, transparent 62%)'
      : 'linear-gradient(to top left,  rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.22) 38%, transparent 62%)',
    zIndex: -1,
    pointerEvents: 'none',
  };
}

// ─── Album art tile ───────────────────────────────────────────────────────────

function AlbumTile({
  track,
  role,
  pulsing,
}: {
  track: SpotifyTrack;
  role: 'prev' | 'current' | 'next';
  pulsing: boolean;
}) {
  const isCurrent = role === 'current';

  const variants = {
    enter: {
      opacity: 0,
      scale: role === 'next' ? 0.7 : 0.75,
      x: role === 'next' ? 28 : role === 'prev' ? -28 : 0,
    },
    visible: {
      opacity: isCurrent ? 1 : 0.48,
      scale: isCurrent ? (pulsing ? 1.07 : 1.0) : 0.83,
      x: 0,
    },
    exit: {
      opacity: 0,
      scale: 0.65,
      x: role === 'prev' ? -32 : 0,
    },
  };

  return (
    <motion.div
      key={track.id + role}
      variants={variants}
      initial="enter"
      animate="visible"
      exit="exit"
      transition={
        isCurrent && pulsing
          ? { type: 'spring', stiffness: 200, damping: 20 }
          : { type: 'spring', stiffness: 280, damping: 28 }
      }
      style={{
        width: isCurrent ? 108 : 72,
        height: isCurrent ? 108 : 72,
        borderRadius: isCurrent ? 14 : 10,
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: isCurrent
          ? '0 10px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1)'
          : '0 4px 14px rgba(0,0,0,0.5)',
      }}
    >
      {track.albumArtUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.albumArtUrl}
          alt={isCurrent ? track.albumName : ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isCurrent ? 28 : 20,
          }}
        >
          🎵
        </div>
      )}
    </motion.div>
  );
}

// ─── Row state ────────────────────────────────────────────────────────────────

interface RowState {
  prev: SpotifyTrack | null;
  current: SpotifyTrack;
  next: SpotifyTrack | null;
  key: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SpotifyOverlayProps {
  clockPosition: ClockPosition;
}

export default function SpotifyOverlay({ clockPosition }: SpotifyOverlayProps) {
  const { current, queue, history, isPlaying } = useSpotifyNowPlaying();
  const [row, setRow] = useState<RowState | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const rowKeyRef = useRef(0);

  // Build/update the three-slot row whenever the current track changes
  useEffect(() => {
    if (!current) return;

    setRow((prev) => {
      if (prev?.current.id === current.id) return prev;
      rowKeyRef.current += 1;
      return {
        prev: prev?.current ?? history[history.length - 1] ?? null,
        current,
        next: queue[0] ?? null,
        key: rowKeyRef.current,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Keep next slot fresh as queue updates
  useEffect(() => {
    const nextId = queue[0]?.id;
    setRow((prev) => {
      if (!prev) return null;
      if (prev.next?.id === nextId) return prev;
      return { ...prev, next: queue[0] ?? null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue[0]?.id]);

  // Pulse current album when track is near its end (< 6 seconds remaining)
  useEffect(() => {
    if (!current) return;
    const remaining = current.durationMs - current.progressMs;
    setPulsing(remaining > 0 && remaining < 6_000);
  }, [current?.progressMs, current?.durationMs]);

  if (!isPlaying || !row) return null;

  const posClass = overlayPosition(clockPosition);

  return (
    <div
      className={`fixed ${posClass} z-50 pointer-events-none select-none`}
      style={{ maxWidth: 320 }}
    >
      {/* Wide, soft corner vignette — blends into any photo */}
      <div aria-hidden style={cornerGradient(clockPosition)} />

      {/* Album trio */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 10 }}>
        <AnimatePresence mode="popLayout">
          {row.prev && (
            <AlbumTile key={`prev-${row.prev.id}-${row.key}`} track={row.prev} role="prev" pulsing={false} />
          )}
        </AnimatePresence>

        <AlbumTile key={`cur-${row.current.id}`} track={row.current} role="current" pulsing={pulsing} />

        <AnimatePresence mode="popLayout">
          {row.next && (
            <AlbumTile key={`next-${row.next.id}-${row.key}`} track={row.next} role="next" pulsing={false} />
          )}
        </AnimatePresence>
      </div>

      {/* Track label */}
      <div style={{ paddingLeft: row.prev ? 82 : 0 }}>
        <motion.p
          key={row.current.id + '-title'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          style={{
            color: '#fff',
            fontSize: '0.9rem',
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
            textShadow: '0 1px 8px rgba(0,0,0,0.8)',
            maxWidth: 190,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            margin: 0,
          }}
        >
          {row.current.name}
        </motion.p>
        <motion.p
          key={row.current.id + '-artist'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          style={{
            color: 'rgba(255,255,255,0.58)',
            fontSize: '0.72rem',
            fontWeight: 500,
            textShadow: '0 1px 6px rgba(0,0,0,0.7)',
            maxWidth: 190,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: 2,
          }}
        >
          {row.current.artists.join(', ')}
        </motion.p>
      </div>
    </div>
  );
}
