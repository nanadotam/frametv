'use client';

import { useRef, useEffect, useState } from 'react';

import type { SpotifyTrack } from '@/hooks/useSpotifyNowPlaying';

type Track = Pick<SpotifyTrack, 'name' | 'artists' | 'albumArtUrl'>;

interface CoverFlowCarouselProps {
  tracks: Track[];
  currentIndex: number;
  dominantColor: string;
}

// Reference: ipod-classic-js AlbumCover.tsx
// Cover size: 8em. At 28px base the covers are ~224px. We use px so the math is explicit.
const COVER_PX = 224;
const HALF_COVER = COVER_PX / 2;

// Spacing matches reference: midpoint - 46 + offset * 48 (then ±half adjustment)
// We scale those magic numbers to our cover size: 46/128 * COVER_PX ≈ 80, 48/128 * COVER_PX ≈ 84
const SPACING = Math.round((48 / 128) * COVER_PX); // ~84px between cover centers
const ANCHOR = Math.round((46 / 128) * COVER_PX);  // ~80px — left-anchor offset from midpoint

// Ported directly from ipod-classic-js AlbumCover.tsx getOffsetPx
function getOffsetPx(offset: number, midpointX: number): number {
  if (offset === 0) return 0;
  const val = midpointX - ANCHOR + offset * SPACING;
  return val + (offset < 0 ? -SPACING : Math.round(SPACING / 2));
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = globalThis as any;
    w.addEventListener('resize', update);
    return () => w.removeEventListener('resize', update);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: `${COVER_PX + 16}px`,
        perspective: '500px',
        paddingTop: '20px',
      }}
    >
      {tracks.map((track, index) => {
        const offset = index - currentIndex;
        // Only render covers within ±15 (matches reference isVisible check)
        if (Math.abs(offset) > 15) return null;

        const isActive = offset === 0;
        const isHidden = !isActive && Math.abs(offset) > 8;
        const zIndex = 1 - Math.abs(offset);

        const transform = isActive
          // Reference: translate3d(midpoint.x - 60px, 4px, 20px) — 60 ≈ HALF_COVER * 0.54
          ? `translate3d(${midpointX - Math.round(HALF_COVER * 0.54)}px, 4px, 20px)`
          : `translateX(${getOffsetPx(offset, midpointX)}px) scale(1.1) translateZ(-65px) rotateY(${offset < 0 ? '70deg' : '-70deg'})`;

        return (
          <div
            key={`cf-${index}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${COVER_PX}px`,
              height: `${COVER_PX}px`,
              zIndex,
              opacity: isHidden ? 0 : 1,
              transition: 'transform 0.25s ease, opacity 0.35s ease',
              transform,
              transformStyle: 'preserve-3d',
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
                  position: 'absolute',
                  width: `${COVER_PX}px`,
                  height: `${COVER_PX}px`,
                  objectFit: 'cover',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: isActive
                    ? `0 24px 80px rgba(0,0,0,0.85), 0 0 48px ${dominantColor}55`
                    : '0 8px 32px rgba(0,0,0,0.7)',
                }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  width: `${COVER_PX}px`,
                  height: `${COVER_PX}px`,
                  borderRadius: '6px',
                  background: `linear-gradient(135deg, ${dominantColor}88, #1a1a1a)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '64px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                ♪
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
