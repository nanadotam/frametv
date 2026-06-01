'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music2 } from 'lucide-react';
import { FastAverageColor } from 'fast-average-color';
import type { ModeProps } from '@/modes/types';
import { useSpotifyNowPlaying } from '@/hooks/useSpotifyNowPlaying';

// ─── Dominant color + background palette ──────────────────────────────────────

interface Palette {
  base:   string;
  light:  string;
  dark:   string;
  accent: string;
  muted:  string;
}

type Rgb = [number, number, number];

function rgbString([r, g, b]: Rgb): string {
  return `rgb(${r},${g},${b})`;
}

function lightenRgb([r, g, b]: Rgb, amt: number): string {
  const l = (c: number) => Math.min(255, Math.round(c + (255 - c) * amt));
  return `rgb(${l(r)},${l(g)},${l(b)})`;
}

function darkenRgb([r, g, b]: Rgb, amt: number): string {
  const d = (c: number) => Math.max(0, Math.round(c * (1 - amt)));
  return `rgb(${d(r)},${d(g)},${d(b)})`;
}

function resultRgb(value: [number, number, number, number]): Rgb {
  return [value[0], value[1], value[2]];
}

const DEFAULT_PALETTE: Palette = {
  base:  '#6b5040',
  light: 'rgb(148,118,96)',
  dark:  'rgb(42,28,18)',
  accent: 'rgb(190,153,112)',
  muted: 'rgb(94,68,47)',
};

function usePalette(url: string | null | undefined): Palette {
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const fac    = useRef(new FastAverageColor());
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!url || url === lastUrl.current) return;
    lastUrl.current = url;
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      Promise.all([
        fac.current.getColorAsync(img, { algorithm: 'dominant', mode: 'precision' }),
        fac.current.getColorAsync(img, { algorithm: 'sqrt', mode: 'precision' }),
        fac.current.getColorAsync(img, {
          algorithm: 'sqrt',
          mode: 'precision',
          left: 0,
          top: 0,
          width: Math.max(1, Math.round(width * 0.5)),
          height: Math.max(1, Math.round(height * 0.5)),
        }),
        fac.current.getColorAsync(img, {
          algorithm: 'sqrt',
          mode: 'precision',
          left: Math.max(0, Math.round(width * 0.5)),
          top: Math.max(0, Math.round(height * 0.5)),
          width: Math.max(1, Math.round(width * 0.5)),
          height: Math.max(1, Math.round(height * 0.5)),
        }),
      ])
        .then(([dominant, average, topLeft, bottomRight]) => {
          const dominantRgb = resultRgb(dominant.value);
          const averageRgb = resultRgb(average.value);
          const topRgb = resultRgb(topLeft.value);
          const bottomRgb = resultRgb(bottomRight.value);

          setPalette({
            base: rgbString(dominantRgb),
            light: lightenRgb(topRgb, 0.22),
            dark: darkenRgb(bottomRgb, 0.44),
            accent: lightenRgb(averageRgb, 0.34),
            muted: darkenRgb(averageRgb, 0.24),
          });
        })
        .catch(() => {});
    };
  }, [url]);

  return palette;
}

// ─── Vinyl SVG — large label, dense micro-grooves ────────────────────────────

function VinylSVG() {
  const C      = 500;
  const outerR = 496;
  // Label ~62% of diameter — big art, meaningful groove ring
  const labelR = 308;

  const grooveCount = 118;
  const grooveStart = labelR + 5;
  const grooveEnd   = outerR - 7;
  const step        = (grooveEnd - grooveStart) / (grooveCount - 1);
  const grooves     = Array.from({ length: grooveCount }, (_, i) =>
    grooveStart + i * step
  );

  return (
    <svg
      viewBox="0 0 1000 1000"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-hidden
    >
      <defs>
        <clipPath id="vinyl-outer-clip">
          <circle cx={C} cy={C} r={outerR} />
        </clipPath>
        <radialGradient id="vinyl-edge-grad" cx="50%" cy="50%" r="50%">
          <stop offset="88%" stopColor="rgba(0,0,0,0)"    />
          <stop offset="100%" stopColor="rgba(0,0,0,0.75)" />
        </radialGradient>
        <radialGradient id="vinyl-sheen" cx="36%" cy="28%" r="52%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)"           />
        </radialGradient>
        <radialGradient id="vinyl-core-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#141414" />
          <stop offset="62%"  stopColor="#080808" />
          <stop offset="100%" stopColor="#020202" />
        </radialGradient>
      </defs>

      <g clipPath="url(#vinyl-outer-clip)">
        <circle cx={C} cy={C} r={outerR} fill="url(#vinyl-core-grad)" />
        {grooves.map((r, i) => (
          <circle
            key={r}
            cx={C}
            cy={C}
            r={r}
            fill="none"
            stroke={i % 5 === 0 ? 'rgba(255,255,255,0.105)' : 'rgba(255,255,255,0.052)'}
            strokeWidth={i % 9 === 0 ? 0.95 : 0.58}
          />
        ))}
        {grooves.map((r, i) => i % 4 === 0 && (
          <circle
            key={`shadow-${r}`}
            cx={C}
            cy={C}
            r={r + 0.85}
            fill="none"
            stroke="rgba(0,0,0,0.62)"
            strokeWidth="0.45"
          />
        ))}
        <circle cx={C} cy={C} r={outerR} fill="url(#vinyl-edge-grad)" />
        <circle cx={C} cy={C} r={outerR} fill="url(#vinyl-sheen)" />
      </g>
    </svg>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function NoSpotify() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 28, color: 'rgba(255,255,255,0.25)',
    }}>
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden>
        {[46, 38, 30, 22, 14].map((r) => (
          <circle key={r} cx="50" cy="50" r={r} fill="none"
                  stroke="currentColor" strokeWidth="1.5" />
        ))}
        <circle cx="50" cy="50" r="5" fill="currentColor" />
      </svg>
      <span style={{
        fontSize: 'clamp(0.85rem, 1.4vw, 1.2rem)',
        letterSpacing: '0.12em', fontWeight: 500,
        textTransform: 'uppercase',
      }}>
        Nothing playing on Spotify
      </span>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function VinylMode({ brightness, config, onReady }: ModeProps) {
  const { current, isPlaying } = useSpotifyNowPlaying();
  const palette = usePalette(current?.albumArtUrl);
  const bgMode = (config?.background as string) ?? 'gradient';

  useEffect(() => { onReady?.(); }, [onReady]);

  return (
    <motion.div
      style={{
        width: '100%', height: '100%',
        overflow: 'hidden', position: 'relative',
        opacity: brightness / 100,
      }}
      animate={{
        background: current && bgMode !== 'black'
          ? `radial-gradient(ellipse 72% 58% at 26% 18%, ${palette.light} 0%, transparent 52%),
             radial-gradient(ellipse 68% 62% at 88% 22%, ${palette.accent} 0%, transparent 48%),
             radial-gradient(ellipse 78% 70% at 68% 88%, ${palette.dark} 0%, transparent 62%),
             linear-gradient(155deg, ${palette.base} 0%, ${palette.muted} 48%, ${palette.dark} 100%)`
          : '#000',
      }}
      transition={{ duration: 1.8, ease: 'easeInOut' }}
    >
      {!current ? (
        <NoSpotify />
      ) : (
        <>
        {bgMode !== 'black' && (
          <>
            <motion.div
              aria-hidden
              animate={{
                background: `radial-gradient(circle at 28% 20%, ${palette.accent}55 0%, transparent 35%),
                             radial-gradient(circle at 86% 18%, ${palette.light}30 0%, transparent 30%),
                             radial-gradient(circle at 18% 84%, ${palette.dark}78 0%, transparent 42%),
                             linear-gradient(90deg, rgba(255,255,255,0.045), rgba(255,255,255,0))`,
              }}
              transition={{ duration: 1.8, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.72,
                pointerEvents: 'none',
              }}
            />
          </>
        )}
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 0,
        }}>

          {/* ── Vinyl — ~55% of screen height, centered ── */}
          <div style={{
            position: 'relative',
            width:  'min(61vmin, 780px)',
            height: 'min(61vmin, 780px)',
            flexShrink: 0,
            marginBottom: 'clamp(20px, 3.5vh, 44px)',
          }}>
            <div
              className="vinyl-spin"
              style={{
                position: 'absolute', inset: 0,
                animationPlayState: isPlaying ? 'running' : 'paused',
                animationDuration: '18s',
              }}
            >
              <VinylSVG />

              {/* Album art label — 62% of disc diameter */}
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '61.6%', height: '61.6%',
                borderRadius: '50%',
                overflow: 'hidden',
                boxShadow: '0 0 0 1.5px rgba(255,255,255,0.06)',
              }}>
                <AnimatePresence mode="wait">
                  {current.albumArtUrl ? (
                    <motion.img
                      key={current.id}
                      src={current.albumArtUrl}
                      alt=""
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.7 }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <motion.div
                      key="fallback"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        width: '100%', height: '100%',
                        background: palette.base,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '3rem',
                      }}
                    >
                      <Music2 size={44} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Spindle */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 8, height: 8, borderRadius: '50%',
              background: 'rgba(0,0,0,0.9)', zIndex: 16,
              boxShadow: '0 0 0 1.5px rgba(255,255,255,0.1)',
            }} />
          </div>

          {/* ── Track info — centered below ── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ textAlign: 'center', flexShrink: 0, maxWidth: 'min(61vmin, 780px)', width: '100%' }}
            >
              <div style={{
                color: '#fff',
                fontSize: 'clamp(1.4rem, 2.4vw, 2.8rem)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {current.name}
              </div>

              <div style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 'clamp(0.9rem, 1.5vw, 1.75rem)',
                marginTop: '0.3rem',
                fontWeight: 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {current.artists.join(', ')}
              </div>

              {current.albumName && (
                <div style={{
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: 'clamp(0.75rem, 1.1vw, 1.3rem)',
                  marginTop: '0.2rem',
                  fontStyle: 'italic',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {current.albumName}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

        </div>
        </>
      )}
    </motion.div>
  );
}
