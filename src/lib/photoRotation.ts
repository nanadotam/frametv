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
 * Cell / track rotation style for an absolutely-positioned, object-fit: cover
 * img. 180° is a plain rotation. For 90/270° the img box is sized to the
 * cell's height × width (container query units) before rotating, so the
 * turned photo still covers the cell — the ancestor cell must set
 * `containerType: 'size'` (see CELL_CONTAINER).
 */
export function cellRotationStyle(rotation: number): CSSProperties {
  if (!rotation) return {};
  if (rotation === 180) return { transform: 'rotate(180deg)' };
  return {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '100cqh',
    height: '100cqw',
    maxWidth: 'none',
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  };
}

/** Put on the cell that holds a cellRotationStyle img. */
export const CELL_CONTAINER: CSSProperties = { containerType: 'size' };
