import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser(_request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const supabase = createServiceClient();

    const { data: album, error } = await supabase
      .from('albums')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ album });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();

    const allowedFields: Record<string, unknown> = {};
    const allowed = ['name', 'is_archived', 'display_order', 'cover_photo_id'];
    for (const key of allowed) {
      if (key in body) allowedFields[key] = body[key];
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: album, error } = await supabase
      .from('albums')
      .update(allowedFields)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ album });
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
    const auth = await requireAdminUser(_request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase.from('albums').delete().eq('id', id).eq('user_id', auth.user.id);

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
