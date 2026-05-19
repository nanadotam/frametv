import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createServiceClient();

  const { data: current } = await supabase
    .from('display_state')
    .select('photo_skip')
    .eq('id', 1)
    .single();

  const { data, error } = await supabase
    .from('display_state')
    .update({ photo_skip: (current?.photo_skip ?? 0) - 1, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ state: data });
}
