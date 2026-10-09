import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';

// Finds videos the user already uploaded from the same source file, so the
// album page can offer replace / skip / copy before re-encoding it.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const { fingerprint, name } = (await request.json()) as { fingerprint?: string; name?: string };
    if (!fingerprint) {
      return NextResponse.json({ error: 'fingerprint is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const videos = () =>
      supabase
        .from('photos')
        .select('id, album_id, created_at')
        .eq('user_id', auth.user.id)
        .eq('media_type', 'video');

    const [byPrint, byName] = await Promise.all([
      videos().eq('metadata->>fingerprint', fingerprint),
      // Videos uploaded before fingerprinting only have their file name
      name
        ? videos().eq('metadata->>originalName', name).is('metadata->>fingerprint', null)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const queryErr = byPrint.error ?? byName.error;
    if (queryErr) {
      return NextResponse.json({ error: queryErr.message }, { status: 500 });
    }

    const rows = [...(byPrint.data ?? []), ...(byName.data ?? [])];
    if (rows.length === 0) return NextResponse.json({ matches: [] });

    const albumIds = [...new Set(rows.map((r) => r.album_id))];
    const { data: albums } = await supabase
      .from('albums')
      .select('id, name')
      .in('id', albumIds)
      .eq('user_id', auth.user.id);
    const albumName = new Map((albums ?? []).map((a) => [a.id, a.name as string]));

    const matches = rows
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((r) => ({ id: r.id, albumId: r.album_id, albumName: albumName.get(r.album_id) ?? 'another album' }));

    return NextResponse.json({ matches });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
