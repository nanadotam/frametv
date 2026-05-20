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

    return NextResponse.json({ photos: photos ?? [], total: count ?? 0 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
