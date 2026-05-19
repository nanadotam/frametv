import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const albumId = searchParams.get('albumId');
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const supabase = createServiceClient();

    let query = supabase
      .from('photos')
      .select('*', { count: 'exact' })
      .order('taken_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (albumId) {
      query = query.eq('album_id', albumId);
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
