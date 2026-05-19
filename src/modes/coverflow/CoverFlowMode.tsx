'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FastAverageColor } from 'fast-average-color';
import type { ModeProps } from '@/modes/types';
import { useSpotifyNowPlaying, type SpotifyTrack } from '@/hooks/useSpotifyNowPlaying';
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

export default function CoverFlowMode({
  brightness,
  onReady,
}: ModeProps) {
  const spotifyResult = useSpotifyNowPlaying();
  const nowPlaying: SpotifyTrack | null = spotifyResult.current;
  const queue: SpotifyTrack[] = spotifyResult.queue;
  const [dominantColor, setDominantColor] = useState('#1db954');
  const imgRef = useRef<string | null>(null);
  const fac = useRef(new FastAverageColor());

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  // Extract dominant color from album art
  useEffect(() => {
    const albumArt = nowPlaying?.albumArtUrl;
    if (!albumArt || albumArt === imgRef.current) return;
    imgRef.current = albumArt;

    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = albumArt;
    img.onload = () => {
      fac.current
        .getColorAsync(img)
        .then((color) => setDominantColor(color.hex))
        .catch(() => setDominantColor('#1db954'));
    };
  }, [nowPlaying?.albumArtUrl]);

  // Build track list: queue + current
  const tracks = [
    ...(queue ?? []),
    ...(nowPlaying ? [nowPlaying] : []),
  ];
  const currentIndex = tracks.length - 1;

  const isPlaying = !!nowPlaying;

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{ opacity: brightness / 100 }}
      animate={{
        background: isPlaying
          ? `radial-gradient(ellipse at center, ${dominantColor}33 0%, #000 70%)`
          : '#000',
      }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      {!isPlaying ? (
        <NoSpotify />
      ) : (
        <>
          <CoverFlowCarousel
            tracks={tracks}
            currentIndex={currentIndex}
            dominantColor={dominantColor}
          />

          {/* Track info */}
          <motion.div
            key={nowPlaying.name}
            className="text-center mt-12 px-8"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div
              style={{
                color: '#ffffff',
                fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
                maxWidth: '700px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {nowPlaying.name}
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: 'clamp(1rem, 1.8vw, 1.5rem)',
                marginTop: '0.5rem',
                letterSpacing: '0.02em',
              }}
            >
              {nowPlaying.artists?.join(', ')}
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
