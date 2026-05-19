'use client';

import { useRef, useEffect, useState } from 'react';

import type { SpotifyTrack } from '@/hooks/useSpotifyNowPlaying';

type Track = Pick<SpotifyTrack, 'name' | 'artists' | 'albumArtUrl'>;

interface CoverFlowCarouselProps {
  tracks: Track[];
  currentIndex: number;
  dominantColor: string;
}

const COVER_SIZE = 240;
const FLANK_COUNT = 4;

// Ported from ipod-classic-js AlbumCover.tsx getOffsetPx
function getOffsetPx(offset: number, midpointX: number): number {
  if (offset === 0) return 0;
  const val = midpointX - COVER_SIZE / 2 + offset * (COVER_SIZE / 2);
  return val + (offset < 0 ? -COVER_SIZE / 2 : COVER_SIZE / 4);
}

export default function CoverFlowCarousel({
  tracks,
  currentIndex,
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

  const visibleTracks: { track: Track; index: number; offset: number }[] = [];
  for (let o = -FLANK_COUNT; o <= FLANK_COUNT; o++) {
    const idx = currentIndex + o;
    if (idx >= 0 && idx < tracks.length) {
      visibleTracks.push({ track: tracks[idx], index: idx, offset: o });
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: `${COVER_SIZE + 80}px`,
        perspective: '500px',
        transformStyle: 'preserve-3d',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20px',
      }}
    >
      {visibleTracks.map(({ track, index, offset }) => {
        const isActive = offset === 0;
        const offsetPx = getOffsetPx(offset, midpointX);
        const zIndex = 1 - Math.abs(offset);

        // CSS transform matching ipod-classic-js patterns exactly
        const transform = isActive
          ? `translate3d(0, 4px, 20px)`
          : `translateX(${offsetPx}px) scale(1.1) translateZ(-65px) rotateY(${offset < 0 ? '70deg' : '-70deg'})`;

        return (
          <div
            key={`cf-${index}`}
            style={{
              position: 'absolute',
              width: `${COVER_SIZE}px`,
              height: `${COVER_SIZE}px`,
              zIndex,
              transition: 'transform 0.25s ease, opacity 0.35s ease',
              transform,
              transformStyle: 'preserve-3d',
              // Reflection matching ipod-classic-js -webkit-box-reflect
              WebkitBoxReflect:
                'below 0px -webkit-gradient(linear, left top, left bottom, from(transparent), color-stop(70%, transparent), to(rgba(240,240,240,0.2)))',
            }}
          >
            {track.albumArtUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.albumArtUrl}
                alt={track.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: isActive
                    ? `0 24px 80px rgba(0,0,0,0.8), 0 0 40px ${dominantColor}66`
                    : '0 8px 32px rgba(0,0,0,0.6)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '4px',
                  background: `linear-gradient(135deg, ${dominantColor}88, #1a1a1a)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                🎵
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
