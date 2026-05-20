import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  const config = await request.json();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('user_modes')
    .update({ config })
    .eq('user_id', auth.user.id)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mode: data });
}
