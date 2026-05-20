import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireDisplayUser } from '@/lib/auth';
import { ensureUserDefaults } from '@/lib/userData';

export async function GET(request: NextRequest) {
  const auth = await requireDisplayUser(request);
  if (auth.response) return auth.response;

  await ensureUserDefaults(auth.user.id);
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('user_modes')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ modes: data ?? [] });
}
