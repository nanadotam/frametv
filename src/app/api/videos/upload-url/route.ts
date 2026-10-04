import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';

// Videos are too large for a function request body (4.5 MB), so the browser
// uploads the transcoded MP4 and its poster JPEG straight to Supabase Storage
// using the signed upload tokens issued here.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const { albumId } = (await request.json()) as { albumId?: string };
    if (!albumId) {
      return NextResponse.json({ error: 'albumId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: album, error: albumErr } = await supabase
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (albumErr || !album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const uuid = randomUUID();
    const videoPath = `videos/${albumId}/${uuid}.mp4`;
    const posterPath = `videos/${albumId}/${uuid}-poster.jpg`;

    const bucket = supabase.storage.from('photos');
    const [video, poster] = await Promise.all([
      bucket.createSignedUploadUrl(videoPath),
      bucket.createSignedUploadUrl(posterPath),
    ]);

    const signErr = video.error ?? poster.error;
    if (signErr || !video.data || !poster.data) {
      return NextResponse.json(
        { error: signErr?.message ?? 'Could not create upload URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      videoPath,
      videoToken: video.data.token,
      posterPath,
      posterToken: poster.data.token,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
