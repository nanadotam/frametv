import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';

interface CreateVideoBody {
  albumId?: string;
  videoPath?: string;
  posterPath?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  bytes?: number;
  originalName?: string;
  fingerprint?: string;
}

// Registers a video the browser already uploaded via /api/videos/upload-url.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const body = (await request.json()) as CreateVideoBody;
    const { albumId, videoPath, posterPath } = body;

    if (!albumId || !videoPath) {
      return NextResponse.json({ error: 'albumId and videoPath are required' }, { status: 400 });
    }
    // Only accept paths minted by upload-url for this album
    const prefix = `videos/${albumId}/`;
    if (!videoPath.startsWith(prefix) || (posterPath && !posterPath.startsWith(prefix))) {
      return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: album, error: albumErr } = await supabase
      .from('albums')
      .select('id, cover_photo_id')
      .eq('id', albumId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (albumErr || !album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const width = body.width ?? null;
    const height = body.height ?? null;

    const { data: video, error: insertErr } = await supabase
      .from('photos')
      .insert({
        album_id: albumId,
        user_id: auth.user.id,
        source_type: 'upload',
        source_id: null,
        media_type: 'video',
        storage_path: videoPath,
        thumbnail_path: posterPath ?? null,
        width,
        height,
        aspect_ratio: width && height ? Number((width / height).toFixed(4)) : null,
        duration_ms: body.durationMs ? Math.round(body.durationMs) : null,
        mime_type: 'video/mp4',
        bytes: body.bytes ?? null,
        taken_at: new Date().toISOString(),
        metadata: {
          originalName: body.originalName ?? null,
          fingerprint: body.fingerprint ?? null,
        },
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // First item in a fresh upload album becomes its cover
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
