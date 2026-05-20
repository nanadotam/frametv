import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireDisplayUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireDisplayUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const size = Math.min(
      4000,
      parseInt(new URL(request.url).searchParams.get('size') ?? '800', 10) || 800
    );

    const supabase = createServiceClient();
    const { data: photo } = await supabase
      .from('photos')
      .select('source_type, source_id, thumbnail_path, storage_path')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Drive photos: redirect directly to Google's CDN — no buffer needed
    if (photo.source_type === 'drive' && photo.source_id) {
      const driveUrl = `https://drive.google.com/thumbnail?id=${photo.source_id}&sz=w${size}`;
      return NextResponse.redirect(driveUrl, { status: 302 });
    }

    // Uploaded photos: redirect to storage URL
    const url = photo.thumbnail_path ?? photo.storage_path;
    if (url) {
      return NextResponse.redirect(url, { status: 302 });
    }

    return NextResponse.json({ error: 'No image available' }, { status: 404 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
