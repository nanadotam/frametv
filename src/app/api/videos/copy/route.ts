import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';

// Copies an existing video into another album. The storage objects are
// duplicated rather than shared, so deleting either copy can't break the other.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const { sourceId, albumId } = (await request.json()) as { sourceId?: string; albumId?: string };
    if (!sourceId || !albumId) {
      return NextResponse.json({ error: 'sourceId and albumId are required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const [{ data: source }, { data: album }] = await Promise.all([
      supabase
        .from('photos')
        .select('*')
        .eq('id', sourceId)
        .eq('user_id', auth.user.id)
        .eq('media_type', 'video')
        .maybeSingle(),
      supabase
        .from('albums')
        .select('id, cover_photo_id')
        .eq('id', albumId)
        .eq('user_id', auth.user.id)
        .maybeSingle(),
    ]);
    if (!source?.storage_path) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const uuid = randomUUID();
    const videoPath = `videos/${albumId}/${uuid}.mp4`;
    const posterPath = source.thumbnail_path ? `videos/${albumId}/${uuid}-poster.jpg` : null;

    const bucket = supabase.storage.from('photos');
    const [videoCopy, posterCopy] = await Promise.all([
      bucket.copy(source.storage_path, videoPath),
      posterPath ? bucket.copy(source.thumbnail_path, posterPath) : Promise.resolve({ error: null }),
    ]);
    const copyErr = videoCopy.error ?? posterCopy.error;
    if (copyErr) {
      return NextResponse.json({ error: `Copy failed: ${copyErr.message}` }, { status: 500 });
    }

    const { data: video, error: insertErr } = await supabase
      .from('photos')
      .insert({
        album_id: albumId,
        user_id: auth.user.id,
        source_type: 'upload',
        source_id: null,
        media_type: 'video',
        storage_path: videoPath,
        thumbnail_path: posterPath,
        width: source.width,
        height: source.height,
        aspect_ratio: source.aspect_ratio,
        duration_ms: source.duration_ms,
        mime_type: source.mime_type,
        bytes: source.bytes,
        taken_at: new Date().toISOString(),
        metadata: source.metadata,
      })
      .select()
      .single();

    if (insertErr) {
      await bucket.remove([videoPath, ...(posterPath ? [posterPath] : [])]);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    if (!album.cover_photo_id) {
      await supabase.from('albums').update({ cover_photo_id: video.id }).eq('id', albumId);
    }

    return NextResponse.json({ video }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
