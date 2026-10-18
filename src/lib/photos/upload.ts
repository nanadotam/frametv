'use client';

import { createClient } from '@/lib/supabase/client';
import type { Photo } from '@/types/db';
import { compressPhoto } from './compress';

export type PhotoUploadStage = { stage: 'compressing'; progress: number } | { stage: 'uploading' } | { stage: 'saving' };

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

/**
 * Compresses a photo on-device (WebP, ≤2560 px + thumbnail), uploads both
 * straight to storage with signed URLs, then adds it to the album.
 */
export async function uploadPhoto(
  file: File,
  albumId: string,
  fingerprint: string,
  onStage: (s: PhotoUploadStage) => void,
  source: string = 'upload'
): Promise<Photo> {
  onStage({ stage: 'compressing', progress: 0.3 });
  const out = await compressPhoto(file);
  const ext = out.display.type === 'image/jpeg' ? 'jpg' : 'webp';
  const bytes = out.display.size + out.thumb.size;

  onStage({ stage: 'uploading' });
  const urls = await jsonOrThrow<{ imagePath: string; imageToken: string; thumbPath: string; thumbToken: string }>(
    await fetch('/api/photos/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId, bytes, ext }),
    })
  );
  const bucket = createClient().storage.from('photos');
  const [a, b] = await Promise.all([
    bucket.uploadToSignedUrl(urls.imagePath, urls.imageToken, out.display, { contentType: out.display.type, cacheControl: '31536000' }),
    bucket.uploadToSignedUrl(urls.thumbPath, urls.thumbToken, out.thumb, { contentType: out.thumb.type, cacheControl: '31536000' }),
  ]);
  const err = a.error ?? b.error;
  if (err) throw new Error(`Upload failed: ${err.message}`);

  onStage({ stage: 'saving' });
  const { photo } = await jsonOrThrow<{ photo: Photo }>(
    await fetch('/api/photos/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        albumId,
        imagePath: urls.imagePath,
        thumbPath: urls.thumbPath,
        width: out.width,
        height: out.height,
        bytes,
        mimeType: out.display.type,
        takenAt: out.takenAt,
        originalName: file.name,
        fingerprint,
        source,
      }),
    })
  );
  return photo;
}
