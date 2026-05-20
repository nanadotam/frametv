'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FastAverageColor } from 'fast-average-color';
import type { ModeProps } from '@/modes/types';
import { useSpotifyNowPlaying } from '@/hooks/useSpotifyNowPlaying';
import CoverFlowCarousel from './CoverFlowCarousel';

function NoSpotify() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-white/60">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span style={{ fontSize: '1.2rem', letterSpacing: '0.05em' }}>
        NOTHING PLAYING ON SPOTIFY
      </span>
    </div>
  );
}

export default function CoverFlowMode({ brightness, onReady }: ModeProps) {
  const { current, queue, history } = useSpotifyNowPlaying();
  const [dominantColor, setDominantColor] = useState('#1db954');
  const lastArtRef = useRef<string | null>(null);
  const fac = useRef(new FastAverageColor());

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  // Extract dominant color from album art whenever the track changes
  useEffect(() => {
    const albumArt = current?.albumArtUrl;
    if (!albumArt || albumArt === lastArtRef.current) return;
    lastArtRef.current = albumArt;

    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = albumArt;
    img.onload = () => {
      fac.current
        .getColorAsync(img)
        .then((color) => setDominantColor(color.hex))
        .catch(() => setDominantColor('#1db954'));
    };
  }, [current?.albumArtUrl]);

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{ opacity: brightness / 100 }}
      animate={{
        background: current
          ? `radial-gradient(ellipse at center, ${dominantColor}33 0%, #000 70%)`
          : '#000',
      }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      {!current ? (
        <NoSpotify />
      ) : (
        <>
          <CoverFlowCarousel
            history={history}
            current={current}
            queue={queue}
            dominantColor={dominantColor}
          />

          {/* Track info */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              className="text-center px-8"
              style={{ marginTop: '24px' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {/* Song name */}
              <div
                style={{
                  color: '#ffffff',
                  fontSize: 'clamp(1.6rem, 2.8vw, 2.6rem)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                  maxWidth: '800px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {current.name}
              </div>

              {/* Artist names */}
              <div
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 'clamp(1rem, 1.8vw, 1.5rem)',
                  marginTop: '6px',
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '800px',
                }}
              >
                {current.artists.join(', ')}
              </div>

              {/* Album name */}
              {current.albumName && (
                <div
                  style={{
                    color: 'rgba(255,255,255,0.35)',
                    fontSize: 'clamp(0.8rem, 1.3vw, 1.1rem)',
                    marginTop: '4px',
                    letterSpacing: '0.03em',
                    fontStyle: 'italic',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '800px',
                  }}
                >
                  {current.albumName}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}
