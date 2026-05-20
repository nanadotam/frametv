import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { requireAdminUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const albumId = formData.get('albumId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!albumId) {
      return NextResponse.json({ error: 'albumId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify album exists
    const { data: album, error: albumErr } = await supabase
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (albumErr || !album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uuid = randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `photos/${albumId}/${uuid}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from('photos')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: photo, error: insertErr } = await supabase
      .from('photos')
      .insert({
        album_id: albumId,
        user_id: auth.user.id,
        source_type: 'upload',
        source_id: null,
        storage_path: storagePath,
        mime_type: file.type || null,
        bytes: file.size,
        metadata: { originalName: file.name },
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ photo }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
