'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Track {
  albumArt?: string;
  title: string;
  artist: string;
}

interface CoverFlowCarouselProps {
  tracks: Track[];
  currentIndex: number;
  dominantColor: string;
}

const FLANK_COUNT = 2;

export default function CoverFlowCarousel({
  tracks,
  currentIndex,
  dominantColor,
}: CoverFlowCarouselProps) {
  const visibleTracks: { track: Track; offset: number }[] = [];

  for (let o = -FLANK_COUNT; o <= FLANK_COUNT; o++) {
    const idx = currentIndex + o;
    if (idx >= 0 && idx < tracks.length) {
      visibleTracks.push({ track: tracks[idx], offset: o });
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '360px',
        perspective: '1000px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {visibleTracks.map(({ track, offset }) => {
        const isCurrent = offset === 0;
        const absOffset = Math.abs(offset);

        const translateX = offset * 220;
        const translateZ = isCurrent ? 80 : -absOffset * 60;
        const rotateY = isCurrent ? 0 : offset > 0 ? -35 : 35;
        const scale = isCurrent ? 1 : 1 - absOffset * 0.15;
        const zIndex = 10 - absOffset;
        const opacity = 1 - absOffset * 0.25;

        return (
          <motion.div
            key={`${track.title}-${offset}`}
            style={{
              position: 'absolute',
              width: '240px',
              height: '240px',
              zIndex,
            }}
            animate={{
              x: translateX,
              z: translateZ,
              rotateY,
              scale,
              opacity,
            }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Album art */}
            {track.albumArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.albumArt}
                alt={track.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  boxShadow: isCurrent
                    ? `0 24px 80px rgba(0,0,0,0.8), 0 0 40px ${dominantColor}66`
                    : '0 8px 32px rgba(0,0,0,0.6)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '8px',
                  background: `linear-gradient(135deg, ${dominantColor}88, #1a1a1a)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                }}
              >
                🎵
              </div>
            )}

            {/* Reflection */}
            {isCurrent && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  width: '100%',
                  height: '60px',
                  background:
                    'linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)',
                  transform: 'scaleY(-1)',
                  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)',
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)',
                  borderRadius: '0 0 8px 8px',
                  overflow: 'hidden',
                }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
