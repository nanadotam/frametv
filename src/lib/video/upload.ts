'use client';

import { createClient } from '@/lib/supabase/client';
import type { Photo } from '@/types/db';

export type VideoUploadStage =
  | { stage: 'converting'; progress: number }
  | { stage: 'compressing'; progress: number }
  | { stage: 'uploading' }
  | { stage: 'saving' };

/** Supabase free-plan per-object ceiling; the bucket enforces the same. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

/**
 * Compresses a video in the browser, uploads it (plus a poster frame)
 * directly to Supabase Storage, then registers it in the album.
 */
export async function uploadVideo(
  file: File,
  albumId: string,
  fingerprint: string,
  onStage: (s: VideoUploadStage) => void
): Promise<Photo> {
  onStage({ stage: 'compressing', progress: 0 });
  // Loaded on demand — mediabunny is only needed on this one admin action
  const { transcodeForDisplay } = await import('./transcode');
  const out = await transcodeForDisplay(file, (progress, stage) => onStage({ stage, progress }));

  if (out.video.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Compressed video is ${(out.video.size / 1024 / 1024).toFixed(0)} MB — over the 50 MB limit. Trim it shorter and try again.`
    );
  }

  onStage({ stage: 'uploading' });
  const urls = await jsonOrThrow<{
    videoPath: string;
    videoToken: string;
    posterPath: string;
    posterToken: string;
  }>(
    await fetch('/api/videos/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId }),
    })
  );

  const bucket = createClient().storage.from('photos');
  const [videoUp, posterUp] = await Promise.all([
    bucket.uploadToSignedUrl(urls.videoPath, urls.videoToken, out.video, { contentType: 'video/mp4' }),
    bucket.uploadToSignedUrl(urls.posterPath, urls.posterToken, out.poster, { contentType: 'image/jpeg' }),
  ]);
  const upErr = videoUp.error ?? posterUp.error;
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  onStage({ stage: 'saving' });
  const { video } = await jsonOrThrow<{ video: Photo }>(
    await fetch('/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        albumId,
        videoPath: urls.videoPath,
        posterPath: urls.posterPath,
        width: out.width,
        height: out.height,
        durationMs: out.durationMs,
        bytes: out.video.size,
        originalName: file.name,
        fingerprint,
      }),
    })
  );
  return video;
}

export interface DuplicateMatch {
  id: string;
  albumId: string;
  albumName: string;
}

/** Videos this account already has that came from the same source file. */
export async function findDuplicates(
  fingerprint: string,
  name: string
): Promise<DuplicateMatch[]> {
  const { matches } = await jsonOrThrow<{ matches: DuplicateMatch[] }>(
    await fetch('/api/videos/duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, name }),
    })
  );
  return matches;
}

/** Copies an already-uploaded video into another album — no re-encode. */
export async function copyVideo(sourceId: string, albumId: string): Promise<Photo> {
  const { video } = await jsonOrThrow<{ video: Photo }>(
    await fetch('/api/videos/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, albumId }),
    })
  );
  return video;
}
