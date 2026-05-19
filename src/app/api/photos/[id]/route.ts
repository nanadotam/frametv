import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Only allow specific fields to be updated
    const allowedFields: Record<string, unknown> = {};
    if (typeof body.is_favorite === 'boolean') {
      allowedFields.is_favorite = body.is_favorite;
    }
    if (typeof body.show_on_board === 'boolean') {
      allowedFields.show_on_board = body.show_on_board;
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('photos')
      .update(allowedFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ photo: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Fetch storage path first so we can clean up storage
    const { data: photo } = await supabase
      .from('photos')
      .select('storage_path, thumbnail_path')
      .eq('id', id)
      .maybeSingle();

    // Delete from storage if there's a path
    if (photo?.storage_path) {
      await supabase.storage.from('photos').remove([photo.storage_path]);
    }
    if (photo?.thumbnail_path) {
      await supabase.storage.from('photos').remove([photo.thumbnail_path]);
    }

    const { error } = await supabase.from('photos').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
