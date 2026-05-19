import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data: albums, error } = await supabase
      .from('albums')
      .select('*')
      .eq('is_archived', false)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ albums: albums ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
