import { createServiceClient } from '@/lib/supabase/server';

/**
 * Uploaded videos live in our own storage (photos come from Google Drive),
 * so each account gets a fixed allowance. Override with VIDEO_QUOTA_MB.
 */
export const VIDEO_QUOTA_BYTES = Number(process.env.VIDEO_QUOTA_MB ?? 500) * 1024 * 1024;

export async function getVideoUsage(userId: string) {
  const { data } = await createServiceClient()
    .from('photos')
    .select('bytes')
    .eq('user_id', userId)
    .eq('media_type', 'video');
  const used = (data ?? []).reduce((sum, r) => sum + (Number(r.bytes) || 0), 0);
  return { used, quota: VIDEO_QUOTA_BYTES, count: data?.length ?? 0 };
}
