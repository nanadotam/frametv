'use client';

import { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ModeProps } from '@/modes/types';

interface UnsplashMoodConfig {
  mood?: string;
  intervalSeconds?: number;
}

interface UnsplashPhoto {
  id: string;
  urls: { full: string; regular: string; small: string };
  user: { name: string; links: { html: string } };
  links: { html: string; download_location: string };
  alt_description?: string | null;
}

export default function UnsplashMoodMode({
  config,
  brightness,
  isPaused,
  onReady,
}: ModeProps) {
  const cfg = config as UnsplashMoodConfig;
  const mood = cfg.mood ?? 'mountains';
  const intervalSeconds = cfg.intervalSeconds ?? 120;

  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoKey, setPhotoKey] = useState(0);
  const prevMoodRef = useRef<string | null>(null);

  // Fetch photos when mood changes
  useEffect(() => {
    if (prevMoodRef.current === mood) return;
    prevMoodRef.current = mood;

    setPhotos([]);
    setCurrentIndex(0);

    fetch(`/api/unsplash?mood=${encodeURIComponent(mood)}`)
      .then((r) => r.json())
      .then((data: { photos?: UnsplashPhoto[]; error?: string }) => {
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          setPhotos(data.photos);
          onReady?.();
        }
      })
      .catch(() => {
        // silently fail — display will remain blank until next fetch
      });
  }, [mood, onReady]);

  // Advance slideshow
  useEffect(() => {
    if (isPaused || photos.length === 0) return;
    const id = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % photos.length);
      setPhotoKey((k) => k + 1);
    }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [isPaused, intervalSeconds, photos.length]);

  const photo = photos[currentIndex] ?? null;

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-black"
      style={{ opacity: brightness / 100 }}
    >
      <AnimatePresence mode="wait">
        {photo ? (
          <motion.div
            key={photoKey}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: 'easeInOut' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.urls.regular}
              alt={photo.alt_description ?? mood}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />

            {/* Attribution overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '16px',
                color: 'rgba(255,255,255,0.65)',
                fontSize: '0.75rem',
                fontFamily: 'sans-serif',
                letterSpacing: '0.02em',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                backdropFilter: 'blur(4px)',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(0,0,0,0.25)',
              }}
            >
              Photo by{' '}
              <a
                href={photo.user.links.html}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                {photo.user.name}
              </a>{' '}
              on Unsplash
            </div>
          </motion.div>
        ) : (
          <div
            key="loading"
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full bg-white/10 animate-pulse" />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
