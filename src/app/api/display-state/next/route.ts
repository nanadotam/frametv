import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const supabase = createServiceClient();

  const { data: current } = await supabase
    .from('display_state')
    .select('photo_skip')
    .eq('user_id', auth.user.id)
    .single();

  const { data, error } = await supabase
    .from('display_state')
    .update({ photo_skip: (current?.photo_skip ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq('user_id', auth.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ state: data });
}
