import { createServiceClient } from '@/lib/supabase/server';

/**
 * Photos and videos uploaded straight to Mantel live in our storage
 * (Google Drive albums don't count), so each account gets a fixed
 * allowance. Override with STORAGE_QUOTA_MB (VIDEO_QUOTA_MB still works).
 */
export const STORAGE_QUOTA_BYTES =
  Number(process.env.STORAGE_QUOTA_MB ?? process.env.VIDEO_QUOTA_MB ?? 500) * 1024 * 1024;

export async function getStorageUsage(userId: string) {
  const { data } = await createServiceClient()
    .from('photos')
    .select('bytes, media_type')
    .eq('user_id', userId)
    .eq('source_type', 'upload');
  const rows = data ?? [];
  const used = rows.reduce((sum, r) => sum + (Number(r.bytes) || 0), 0);
  return {
    used,
    quota: STORAGE_QUOTA_BYTES,
    count: rows.length,
    photos: rows.filter((r) => r.media_type !== 'video').length,
    videos: rows.filter((r) => r.media_type === 'video').length,
  };
}

/** @deprecated name kept for existing callers */
export const getVideoUsage = getStorageUsage;

export const STORAGE_FULL_MESSAGE =
  'Your Mantel storage is full. Delete some uploads, or add more photos through a Google Drive folder. Those don’t count.';
