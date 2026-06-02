'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music2, Play, Pause, SkipForward } from 'lucide-react';
import type { ClockPosition } from './ClockOverlay';
import type { SpotifyTrack } from '@/lib/spotify/now-playing';

// ─── Position helpers ─────────────────────────────────────────────────────────

// Sit above the floating controls bar (bottom:28px + ~40px height + 8px gap = 88px)
function overlayPosition(clockPos: ClockPosition): string {
  return clockPos.includes('right') ? 'left-8' : 'right-8';
}

function cornerGradient(clockPos: ClockPosition): React.CSSProperties {
  const fromLeft = clockPos.includes('right');
  return {
    position: 'absolute',
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
          }}
        >
          <Music2 size={isCurrent ? 28 : 20} />
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
  current: SpotifyTrack | null;
  queue: SpotifyTrack[];
  history: SpotifyTrack[];
  isPlaying: boolean;
  onPlayPause?: () => void;
  onNext?: () => void;
}

export default function SpotifyOverlay({
  clockPosition,
  current,
  queue,
  history,
  isPlaying,
  onPlayPause,
  onNext,
}: SpotifyOverlayProps) {
  const [row, setRow] = useState<RowState | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const rowKeyRef = useRef(0);

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
  }, [current, history, queue]);

  useEffect(() => {
    const nextId = queue[0]?.id;
    setRow((prev) => {
      if (!prev) return null;
      if (prev.next?.id === nextId) return prev;
      return { ...prev, next: queue[0] ?? null };
    });
  }, [queue]);

  useEffect(() => {
    if (!current) return;
    const remaining = current.durationMs - current.progressMs;
    setPulsing(remaining > 0 && remaining < 6_000);
  }, [current]);

  if (!isPlaying || !row) return null;

  const sideClass = overlayPosition(clockPosition);
  const showControls = Boolean(onPlayPause || onNext);

  return (
    <div
      className={`fixed bottom-[88px] ${sideClass} z-50 select-none`}
      style={{ maxWidth: 320, pointerEvents: 'none' }}
    >
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

        {/* Playback controls */}
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              pointerEvents: 'auto',
            }}
          >
            {onPlayPause && (
              <button
                onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
                onDoubleClick={(e) => e.stopPropagation()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, transform 0.1s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.28)';
                  e.currentTarget.style.transform = 'scale(1.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying
                  ? <Pause size={15} fill="currentColor" />
                  : <Play size={15} fill="currentColor" style={{ marginLeft: 1 }} />}
              </button>
            )}

            {onNext && (
              <button
                onClick={(e) => { e.stopPropagation(); onNext(); }}
                onDoubleClick={(e) => e.stopPropagation()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, transform 0.1s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.22)';
                  e.currentTarget.style.transform = 'scale(1.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Next track"
              >
                <SkipForward size={14} fill="currentColor" />
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
