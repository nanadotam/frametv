import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';
import { getStorageUsage, STORAGE_FULL_MESSAGE } from '@/lib/video/quota';

// POST { albumId, bytes, ext } — signed upload URLs for a compressed photo
// and its thumbnail. The browser uploads straight to storage, then calls
// /api/photos/register.
export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const { albumId, bytes, ext } = (await request.json().catch(() => ({}))) as { albumId?: string; bytes?: number; ext?: string };
  if (!albumId) return NextResponse.json({ error: 'albumId is required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: album } = await supabase.from('albums').select('id').eq('id', albumId).eq('user_id', auth.user.id).maybeSingle();
  if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });

  const usage = await getStorageUsage(auth.user.id);
  if (usage.used + (Number(bytes) || 0) > usage.quota) {
    return NextResponse.json({ error: STORAGE_FULL_MESSAGE }, { status: 413 });
  }

  const extension = ext === 'jpg' ? 'jpg' : 'webp';
  const id = randomUUID();
  const imagePath = `photos/${albumId}/${id}.${extension}`;
  const thumbPath = `photos/${albumId}/${id}-thumb.${extension}`;
  const bucket = supabase.storage.from('photos');
  const [image, thumb] = await Promise.all([bucket.createSignedUploadUrl(imagePath), bucket.createSignedUploadUrl(thumbPath)]);
  const err = image.error ?? thumb.error;
  if (err || !image.data || !thumb.data) {
    return NextResponse.json({ error: err?.message ?? 'Could not create upload URL' }, { status: 500 });
  }

  return NextResponse.json({ imagePath, imageToken: image.data.token, thumbPath, thumbToken: thumb.data.token });
}
