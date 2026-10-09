'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePhotos, type MediaType } from './usePhotos';
import type { Photo } from '@/types/db';

interface UsePhotoRotationOptions {
  albumIds?: string[];
  shuffle?: boolean;
  mediaType?: MediaType;
}

export interface PhotoRotationResult {
  /** All photos in the current rotation order */
  photos: Photo[];
  /** Index of the currently active photo */
  currentIndex: number;
  /** Currently active photo (convenience alias for photos[currentIndex]) */
  currentPhoto: Photo | null;
  advance: () => void;
  previous: () => void;
  reshuffle: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Updates an existing order with a fresh list: surviving photos stay where
 * they are (with fresh data), deleted ones drop out, new ones are slotted in
 * at random positions.
 */
function mergeOrder(prev: Photo[], next: Photo[]): Photo[] {
  const byId = new Map(next.map((p) => [p.id, p]));
  const kept = prev.flatMap((p) => byId.get(p.id) ?? []);
  const keptIds = new Set(kept.map((p) => p.id));
  for (const p of shuffleArray(next.filter((p) => !keptIds.has(p.id)))) {
    kept.splice(Math.floor(Math.random() * (kept.length + 1)), 0, p);
  }
  return kept;
}

export function usePhotoRotation({
  albumIds,
  shuffle = false,
  mediaType = 'image',
}: UsePhotoRotationOptions = {}): PhotoRotationResult {
  const raw = usePhotos(albumIds, mediaType);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  useEffect(() => { indexRef.current = index; }, [index]);
  // Bump this counter to force a fresh shuffle without changing raw or shuffle flag
  const [shuffleKey, setShuffleKey] = useState(0);
  const orderedRef = useRef<Photo[]>([]);
  const [ordered, setOrdered] = useState<Photo[]>([]);
  // Shuffle key the current order was built with — a new key means a full
  // reshuffle; otherwise refetches (every minute, or on any photo change)
  // keep the running order instead of reshuffling everything mid-show
  const orderKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${shuffle}:${shuffleKey}`;
    const fresh = orderKeyRef.current !== key;
    orderKeyRef.current = key;
    setOrdered((prev) => {
      if (raw.length === 0) return [];
      if (!shuffle) return raw;
      return fresh || prev.length === 0 ? shuffleArray(raw) : mergeOrder(prev, raw);
    });
  }, [raw, shuffle, shuffleKey]);

  // Keep the same photo current across list changes when it still exists
  useEffect(() => {
    const currentId = orderedRef.current[indexRef.current]?.id;
    orderedRef.current = ordered;
    const at = currentId ? ordered.findIndex((p) => p.id === currentId) : -1;
    setIndex(at >= 0 ? at : 0);
  }, [ordered]);

  const advance = useCallback(() => {
    setIndex((i) =>
      orderedRef.current.length > 0 ? (i + 1) % orderedRef.current.length : 0
    );
  }, []);

  const previous = useCallback(() => {
    setIndex((i) =>
      orderedRef.current.length > 0
        ? (i - 1 + orderedRef.current.length) % orderedRef.current.length
        : 0
    );
  }, []);

  const reshuffle = useCallback(() => {
    setShuffleKey((k) => k + 1);
  }, []);

  // Listen for remote skip signals dispatched by the display page
  useEffect(() => {
    const onSkip = (e: Event) => {
      const dir = (e as CustomEvent<{ direction: 'next' | 'prev' }>).detail?.direction;
      if (dir === 'next') advance();
      else if (dir === 'prev') previous();
    };
    window.addEventListener('frametv:skip', onSkip);
    return () => window.removeEventListener('frametv:skip', onSkip);
  }, [advance, previous]);

  // Listen for reshuffle signal dispatched by the display page
  useEffect(() => {
    const onReshuffle = () => reshuffle();
    window.addEventListener('frametv:reshuffle', onReshuffle);
    return () => window.removeEventListener('frametv:reshuffle', onReshuffle);
  }, [reshuffle]);

  const currentPhoto = ordered.length > 0 ? (ordered[index] ?? null) : null;

  return { photos: ordered, currentIndex: index, currentPhoto, advance, previous, reshuffle };
}
