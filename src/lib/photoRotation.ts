import type { CSSProperties } from 'react';
import type { Photo } from '@/types/db';

export function getPhotoRotation(photo: Photo | null | undefined): number {
  if (!photo?.metadata) return 0;
  const r = (photo.metadata as Record<string, unknown>).rotation;
  return typeof r === 'number' ? ((r % 360) + 360) % 360 : 0;
}

/**
 * Full-screen rotation style.
 * For 90/270° rotations, swaps 100vh ↔ 100vw so the image fills the viewport
 * after being rotated — the classic CSS "portrait-to-landscape" trick.
 * Call this on an absolutely-positioned img inside an `overflow: hidden` container.
 */
export function fullscreenRotationStyle(rotation: number): CSSProperties {
  if (rotation === 0) return {};
  if (rotation === 180) {
    return { transform: 'rotate(180deg)' };
  }
  // 90 or 270
  return {
    position: 'absolute',
    width: '100vh',
    height: '100vw',
    maxWidth: 'none',
    top: '50%',
    left: '50%',
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  };
}

/**
 * Cell / track rotation style.
 * Simple CSS rotation — objectFit: cover handles the cropping for grid/track items
 * where the container is bounded and not full-viewport.
 */
export function cellRotationStyle(rotation: number): CSSProperties {
  return rotation ? { transform: `rotate(${rotation}deg)` } : {};
}
