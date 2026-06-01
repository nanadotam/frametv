'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { ModeProps } from '@/modes/types';
import type { ScriptureVerse } from '@/app/api/scripture/route';
import { DEFAULT_MOOD_CATEGORIES, type MoodCategory } from './constants';
import { detectMood, daySeededIndex } from './utils';

interface UnsplashPhoto {
  id: string;
  urls: { regular: string };
  user: { name: string; links: { html: string } };
}

interface ScriptureConfig {
  translation?: string;
  customMood?: string;
  moodMappingOverrides?: Record<string, string>;
  showCross?: boolean;
  overlayOpacity?: number;
}

function effectiveCategories(overrides: Record<string, string>): MoodCategory[] {
  return DEFAULT_MOOD_CATEGORIES.map((c) => ({
    ...c,
    query: overrides[c.id] ?? c.query,
  }));
}

const CrossIcon = () => (
  <svg width="16" height="22" viewBox="0 0 16 22" fill="none" aria-hidden>
    <rect x="6" y="0" width="4" height="22" rx="2" fill="white" fillOpacity="0.55" />
    <rect x="0" y="6" width="16" height="4" rx="2" fill="white" fillOpacity="0.55" />
  </svg>
);

export default function ScriptureMode({ config, brightness, onReady }: ModeProps) {
  const cfg = config as ScriptureConfig;
  const translation = cfg.translation ?? 'KJV';
  const showCross = cfg.showCross ?? true;
  const overlayOpacity = (cfg.overlayOpacity ?? 55) / 100;

  // Use refs for values that shouldn't retrigger the fetch
  const customMoodRef = useRef(cfg.customMood ?? '');
  const overridesRef = useRef<Record<string, string>>(cfg.moodMappingOverrides ?? {});
  customMoodRef.current = cfg.customMood ?? '';
  overridesRef.current = cfg.moodMappingOverrides ?? {};

  const [verse, setVerse] = useState<ScriptureVerse | null>(null);
  const [photo, setPhoto] = useState<UnsplashPhoto | null>(null);
  const [visible, setVisible] = useState(false);
  const cancelRef = useRef(false);

  const load = useCallback(async () => {
    cancelRef.current = false;
    setVisible(false);

    // Fetch verse of the day
    let v: ScriptureVerse | null = null;
    try {
      const res = await fetch(`/api/scripture?translation=${encodeURIComponent(translation)}`);
      if (res.ok) v = await res.json() as ScriptureVerse;
    } catch { /* silent */ }
    if (cancelRef.current || !v) return;
    setVerse(v);

    // Determine Unsplash query — custom keyword wins, else semantic detection
    const custom = customMoodRef.current.trim();
    const mood = custom
      ? custom
      : detectMood(v.text, effectiveCategories(overridesRef.current));

    try {
      const res = await fetch(`/api/unsplash?mood=${encodeURIComponent(mood)}`);
      if (res.ok) {
        const data = await res.json() as { photos?: UnsplashPhoto[] };
        const photos = data.photos ?? [];
        if (photos.length > 0 && !cancelRef.current) {
          setPhoto(photos[daySeededIndex(photos.length)]);
        }
      }
    } catch { /* silent */ }

    if (!cancelRef.current) {
      setVisible(true);
      onReady?.();
    }
  }, [translation, onReady]); // moodMappingOverrides and customMood read from refs — no re-fetch loop

  useEffect(() => {
    load();
    return () => { cancelRef.current = true; };
  }, [load]);

  // Refresh verse at midnight
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tid = setTimeout(() => load(), midnight.getTime() - now.getTime());
    return () => clearTimeout(tid);
  }, [load]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#0a0a0a',
        opacity: brightness / 100,
      }}
    >
      {/* Background — static, no movement */}
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.urls.regular}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}

      {/* Flat dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: `rgba(0,0,0,${overlayOpacity})`,
        }}
      />

      {/* Cross — top left */}
      {showCross && (
        <div style={{ position: 'absolute', top: 28, left: 28 }}>
          <CrossIcon />
        </div>
      )}

      {/* Verse */}
      {visible && verse && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8% 14%',
            textAlign: 'center',
          }}
        >
          {/* Verse text — Georgia, the body */}
          <p
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 'clamp(22px, 3vw, 46px)',
              fontWeight: 400,
              lineHeight: 1.65,
              letterSpacing: '0.01em',
              color: '#ffffff',
              margin: 0,
              maxWidth: '860px',
            }}
          >
            {verse.text}
          </p>

          {/* Divider */}
          <div
            style={{
              width: '36px',
              height: '1px',
              backgroundColor: 'rgba(255,255,255,0.35)',
              margin: 'clamp(14px, 2vw, 24px) auto',
            }}
          />

          {/* Reference — Poppins, where it's from */}
          <p
            style={{
              fontFamily: 'var(--font-poppins, "Poppins", sans-serif)',
              fontSize: 'clamp(11px, 1.1vw, 15px)',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
              margin: 0,
            }}
          >
            {verse.reference}
          </p>

          {/* Translation */}
          <p
            style={{
              fontFamily: 'var(--font-poppins, "Poppins", sans-serif)',
              fontSize: 'clamp(9px, 0.75vw, 11px)',
              fontWeight: 400,
              letterSpacing: '0.08em',
              color: 'rgba(255,255,255,0.3)',
              margin: '5px 0 0',
            }}
          >
            {verse.translation}
          </p>
        </div>
      )}

      {/* Unsplash attribution */}
      {photo && (
        <p
          style={{
            position: 'absolute',
            bottom: 12,
            right: 16,
            margin: 0,
            color: 'rgba(255,255,255,0.28)',
            fontSize: '10px',
            fontFamily: 'sans-serif',
            letterSpacing: '0.02em',
          }}
        >
          Photo:{' '}
          <a
            href={`${photo.user.links.html}?utm_source=frametv&utm_medium=referral`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            {photo.user.name}
          </a>{' '}
          / Unsplash
        </p>
      )}
    </div>
  );
}
