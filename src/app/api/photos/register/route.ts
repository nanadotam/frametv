import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';

// POST — records a photo the browser just uploaded via /api/photos/upload-url.
export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    albumId?: string; imagePath?: string; thumbPath?: string; width?: number; height?: number;
    bytes?: number; mimeType?: string; takenAt?: string; originalName?: string; fingerprint?: string; source?: string;
  };
  const { albumId, imagePath, thumbPath } = body;
  if (!albumId || !imagePath?.startsWith(`photos/${albumId}/`) || (thumbPath && !thumbPath.startsWith(`photos/${albumId}/`))) {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: album } = await supabase.from('albums').select('id, cover_photo_id').eq('id', albumId).eq('user_id', auth.user.id).maybeSingle();
  if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });

  const width = Number(body.width) || null;
  const height = Number(body.height) || null;
  const { data: photo, error } = await supabase
    .from('photos')
    .insert({
      album_id: albumId,
      user_id: auth.user.id,
      source_type: 'upload',
      source_id: null,
      media_type: 'image',
      storage_path: imagePath,
      thumbnail_path: thumbPath ?? null,
      width,
      height,
      aspect_ratio: width && height ? Number((width / height).toFixed(4)) : null,
      mime_type: body.mimeType ?? 'image/webp',
      bytes: Number(body.bytes) || null,
      taken_at: body.takenAt ?? new Date().toISOString(),
      metadata: {
        originalName: body.originalName ?? null,
        fingerprint: body.fingerprint ?? null,
        source: body.source ?? 'upload',
      },
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!album.cover_photo_id) await supabase.from('albums').update({ cover_photo_id: photo.id }).eq('id', albumId);

  const bucket = supabase.storage.from('photos');
  return NextResponse.json({
    photo: {
      ...photo,
      storage_path: bucket.getPublicUrl(imagePath).data.publicUrl,
      thumbnail_path: thumbPath ? bucket.getPublicUrl(thumbPath).data.publicUrl : null,
    },
  });
}
