'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePhotos } from './usePhotos';
import type { Photo } from '@/types/db';

interface UsePhotoRotationOptions {
  albumIds?: string[];
  shuffle?: boolean;
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
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function usePhotoRotation({
  albumIds,
  shuffle = false,
}: UsePhotoRotationOptions = {}): PhotoRotationResult {
  const raw = usePhotos(albumIds);
  const [index, setIndex] = useState(0);
  const orderedRef = useRef<Photo[]>([]);

  const ordered = useMemo(() => {
    if (raw.length === 0) return [];
    return shuffle ? shuffleArray(raw) : raw;
  }, [raw, shuffle]);

  // Keep ref in sync and reset index when the list changes identity
  useEffect(() => {
    orderedRef.current = ordered;
    setIndex(0);
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

  const currentPhoto = ordered.length > 0 ? (ordered[index] ?? null) : null;

  return { photos: ordered, currentIndex: index, currentPhoto, advance, previous };
}
