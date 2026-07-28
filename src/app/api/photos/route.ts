import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireDisplayUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDisplayUser(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const albumId = searchParams.get('albumId');
    const albumIds = searchParams.get('albumIds')?.split(',').filter(Boolean) ?? [];
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const supabase = createServiceClient();

    let query = supabase
      .from('photos')
      .select('*', { count: 'exact' })
      .eq('user_id', auth.user.id)
      .order('taken_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (albumId) {
      query = query.eq('album_id', albumId);
    } else if (albumIds.length > 0) {
      query = query.in('album_id', albumIds);
    }

    const { data: photos, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Resolve direct, cacheable storage URLs for uploaded photos here so the
    // client never has to round-trip through the authed /thumbnail redirect
    // per image — getPublicUrl is a pure string builder, no network call.
    // Drive-sourced photos already carry full URLs in these columns.
    const withUrls = (photos ?? []).map((photo) => {
      if (photo.source_type !== 'upload') return photo;
      const resolved = { ...photo };
      if (photo.storage_path) {
        resolved.storage_path = supabase.storage.from('photos').getPublicUrl(photo.storage_path).data.publicUrl;
      }
      if (photo.thumbnail_path) {
        resolved.thumbnail_path = supabase.storage.from('photos').getPublicUrl(photo.thumbnail_path).data.publicUrl;
      }
      return resolved;
    });

    return NextResponse.json({ photos: withUrls, total: count ?? 0 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
