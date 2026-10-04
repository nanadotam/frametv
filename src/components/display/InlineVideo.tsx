'use client';

import { useEffect, useRef, useState } from 'react';

interface InlineVideoProps {
  src: string;
  isPaused: boolean;
  style?: React.CSSProperties;
  /** Fired once the first frame is actually playing (fade-in hook). */
  onPlaying?: () => void;
}

/**
 * A silent looping clip for use inside photo layouts (multimodal Pinterest
 * and Grid). Only plays — and only fetches — while on screen: Pinterest
 * renders each belt several times over for seamless looping, so most copies
 * of a clip are off-screen at any moment and shouldn't be decoding.
 */
export default function InlineVideo({ src, isPaused, style, onPlaying }: InlineVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  // Latches true on first sight so scrolling back in doesn't refetch
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      // Start a little before the tile scrolls in so it's already moving
      { rootMargin: '0px 25% 0px 25%' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible && !isPaused) {
      el.play().catch(() => { /* muted autoplay is allowed; ignore interrupted play() */ });
    } else {
      el.pause();
    }
  }, [visible, isPaused, seen]);

  return (
    <video
      ref={ref}
      // No src until first visible so off-screen copies never download
      src={seen ? src : undefined}
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      onPlaying={onPlaying}
      style={style}
    />
  );
}
