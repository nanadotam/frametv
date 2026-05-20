import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('flipboard_messages')
      .update(body)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: data });
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
    const { error } = await supabase
      .from('flipboard_messages')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
