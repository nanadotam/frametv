import type { Photo } from '@/types/db';

export const IMG_SIZES = {
  lqip: 40,
  ar: 200,
  admin_grid: 200,
  thumb_small: 400,
  thumb_medium: 600,
  thumb_large: 800,
  full: 2000,
} as const;

export function getConnectionSpeed(): 'slow' | 'fast' {
  if (typeof navigator === 'undefined') return 'fast';
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  const t = conn?.effectiveType;
  return t === '2g' || t === 'slow-2g' ? 'slow' : 'fast';
}

type PhotoRef = Pick<Photo, 'id' | 'source_type' | 'source_id' | 'thumbnail_path' | 'storage_path'>;

// For Drive photos, bypass the proxy and hit Google's CDN directly.
// For uploaded photos, /api/photos already resolves storage_path/thumbnail_path
// to direct, publicly-cacheable storage URLs — use those directly and only
// fall back to the authed redirect proxy if a caller has a bare id/source_type
// (e.g. legacy rows without resolved URLs, or a PhotoRef built by hand).
export function photoThumbUrl(photo: PhotoRef, size: number): string {
  if (photo.source_type === 'drive' && photo.source_id) {
    return `https://drive.google.com/thumbnail?id=${photo.source_id}&sz=w${size}`;
  }
  if (photo.thumbnail_path) return photo.thumbnail_path;
  if (photo.storage_path) return photo.storage_path;
  return `/api/photos/${photo.id}/thumbnail?size=${size}`;
}

export function photoFullUrl(photo: PhotoRef): string {
  if (photo.source_type === 'drive' && photo.source_id) {
    return `https://drive.google.com/thumbnail?id=${photo.source_id}&sz=w${IMG_SIZES.full}`;
  }
  if (photo.storage_path) return photo.storage_path;
  if (photo.thumbnail_path) return photo.thumbnail_path;
  return `/api/photos/${photo.id}/thumbnail?size=${IMG_SIZES.full}`;
}
