'use client';

/**
 * Turns any photo the browser can read (JPEG, PNG, WebP, GIF, iPhone HEIC)
 * into a display-ready WebP plus a small thumbnail, on the user's device:
 *
 *   display  ≤ 2560 px on the long side, WebP q0.82  (~200–600 KB)
 *   thumb    ≤ 480 px,                   WebP q0.72  (~20–40 KB)
 *
 * 2560 px fills a 1440p screen pixel-for-pixel and still looks sharp on a
 * 4K TV at viewing distance, at a tenth of a camera original's size.
 * EXIF orientation is applied while decoding, so photos come out upright.
 */

export const DISPLAY_MAX = 2560;
export const THUMB_MAX = 480;

export interface CompressedPhoto {
  display: Blob;
  thumb: Blob;
  width: number;
  height: number;
  /** Original capture/modified time, ISO. */
  takenAt: string;
}

const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

export function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(file.name);
}

function isHeicFile(file: File) {
  return HEIC_TYPES.includes(file.type) || /\.(heic|heif)$/i.test(file.name);
}

async function decode(file: File): Promise<ImageBitmap> {
  if (isHeicFile(file)) {
    // Safari can decode HEIC natively; everything else gets libheif (loaded only when needed).
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      const { heicTo } = await import('heic-to');
      return heicTo({ blob: file, type: 'bitmap', options: { imageOrientation: 'from-image' } });
    }
  }
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This file isn’t a photo Mantel can read. Try JPEG, PNG, HEIC or WebP.');
  }
}

async function encode(bitmap: ImageBitmap, max: number, quality: number) {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Your browser couldn’t process this photo.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);

  let blob: Blob | null =
    'convertToBlob' in canvas
      ? await canvas.convertToBlob({ type: 'image/webp', quality })
      : await new Promise<Blob | null>((res) => (canvas as HTMLCanvasElement).toBlob(res, 'image/webp', quality));
  // Very old Safari can't encode WebP and silently returns PNG — use JPEG then.
  if (!blob || blob.type !== 'image/webp') {
    blob =
      'convertToBlob' in canvas
        ? await canvas.convertToBlob({ type: 'image/jpeg', quality: quality + 0.05 })
        : await new Promise<Blob | null>((res) => (canvas as HTMLCanvasElement).toBlob(res, 'image/jpeg', quality + 0.05));
  }
  if (!blob) throw new Error('Couldn’t compress this photo.');
  return { blob, width: w, height: h };
}

export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  const bitmap = await decode(file);
  try {
    const display = await encode(bitmap, DISPLAY_MAX, 0.82);
    const thumb = await encode(bitmap, THUMB_MAX, 0.72);
    return {
      display: display.blob,
      thumb: thumb.blob,
      width: display.width,
      height: display.height,
      takenAt: new Date(file.lastModified || Date.now()).toISOString(),
    };
  } finally {
    bitmap.close();
  }
}
