'use client';

import { useEffect, useRef, useState } from 'react';
import { VT323 } from 'next/font/google';
import { EffectRenderer } from './effects/renderer';
import type { VideoEffect } from './effects/shaders';
import styles from './VideoMode.module.css';

// VCR on-screen-display font, self-hosted at build like the clock fonts
const vcrFont = VT323({ subsets: ['latin'], weight: '400', display: 'swap', preload: false });

export interface ClipProps {
  src?: string;
  poster?: string;
  isPaused: boolean;
  loop: boolean;
  fit: 'cover' | 'contain';
  effect?: VideoEffect | null;
  /** Shown in the Old TV on-screen display */
  dateLabel?: string;
  /** Seek here on load — the grid staggers repeats of the same clip */
  startAt?: number;
  onEnded?: () => void;
  onError?: () => void;
}

// Each clip owns its element so the outgoing clip unmounting after a
// crossfade can't clobber the incoming clip's ref.
export default function Clip({
  src, poster, isPaused, loop, fit, effect, dateLabel, startAt, onEnded, onError,
}: ClipProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [glFailed, setGlFailed] = useState(false);
  const [glShowing, setGlShowing] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isPaused) el.pause();
    else el.play().catch(() => { /* muted autoplay is allowed; ignore interrupted play() */ });
  }, [isPaused]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!effect || glFailed || !video || !canvas) return;
    let renderer: EffectRenderer | null = null;
    try {
      renderer = new EffectRenderer(
        canvas,
        video,
        effect,
        (err) => { console.warn('[video] effect fell back to CSS:', err); setGlFailed(true); },
        () => setGlShowing(true)
      );
    } catch (err) {
      console.warn('[video] WebGL unavailable, using CSS effect:', err);
      setGlFailed(true);
    }
    return () => renderer?.dispose();
  }, [effect, glFailed]);

  const useGl = Boolean(effect) && !glFailed;
  const cssEffect = effect && glFailed ? effect : null;

  const video = (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      // Required for WebGL to read frames from the storage CDN
      crossOrigin="anonymous"
      autoPlay={!isPaused}
      muted
      playsInline
      loop={loop}
      preload="auto"
      disablePictureInPicture
      onLoadedMetadata={startAt ? (e) => { e.currentTarget.currentTime = startAt; } : undefined}
      onEnded={onEnded}
      onError={onError}
      className="absolute inset-0 w-full h-full"
      style={{ objectFit: effect ? 'cover' : fit }}
    />
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {cssEffect === 'fisheye' ? (
        <div className={styles.cssFisheye}>{video}</div>
      ) : cssEffect === 'film' ? (
        <div className={styles.cssScope}>{video}</div>
      ) : (
        video
      )}

      {/* GPU effect layer — sits over the (still-playing) video element,
          fading in on its first drawn frame so crossfades never dip black */}
      {useGl && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full transition-opacity duration-300"
          style={{ opacity: glShowing ? 1 : 0 }}
        />
      )}

      {/* CSS approximations when WebGL isn't available */}
      {cssEffect === 'crt' && <div className={styles.cssCrt} />}
      {cssEffect === 'film' && <div className={styles.cssGrain} />}

      {effect === 'crt' && <VhsOsd dateLabel={dateLabel} />}
    </div>
  );
}

/** VCR-style on-screen display, shown for a few seconds as each clip starts. */
function VhsOsd({ dateLabel }: { dateLabel?: string }) {
  return (
    <div className={styles.osd} style={{ fontFamily: vcrFont.style.fontFamily }} aria-hidden>
      <span className={styles.osdPlay}>PLAY ▶</span>
      {dateLabel && <span className={styles.osdDate}>{dateLabel}</span>}
    </div>
  );
}
