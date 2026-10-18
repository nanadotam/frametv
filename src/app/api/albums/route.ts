import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const supabase = createServiceClient();
    const { data: albums, error } = await supabase
      .from('albums')
      .select('*')
      .eq('user_id', auth.user.id)
      .eq('is_archived', false)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Attach each cover's rotation so thumbnails can be shown upright.
    const coverIds = (albums ?? []).map((a) => a.cover_photo_id).filter(Boolean);
    const rotations = new Map<string, number>();
    if (coverIds.length) {
      const { data: covers } = await supabase.from('photos').select('id, metadata').in('id', coverIds);
      for (const c of covers ?? []) {
        const r = (c.metadata as Record<string, unknown> | null)?.rotation;
        if (typeof r === 'number') rotations.set(c.id, ((r % 360) + 360) % 360);
      }
    }

    return NextResponse.json({
      albums: (albums ?? []).map((a) => ({ ...a, cover_rotation: rotations.get(a.cover_photo_id) ?? 0 })),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { name, source_type, drive_folder_id, display_order } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!source_type || !['drive', 'picker', 'upload'].includes(source_type)) {
      return NextResponse.json(
        { error: 'source_type must be one of: drive, picker, upload' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: album, error } = await supabase
      .from('albums')
      .insert({
        name,
        user_id: auth.user.id,
        source_type,
        drive_folder_id: drive_folder_id ?? null,
        display_order: display_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ album }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
