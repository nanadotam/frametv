import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireScreensaverUser } from '@/lib/auth';

// Deliberately narrow: the screensaver's device token can only read modes
// (via /api/modes, already bearer-auth-capable) and flip which one is
// active — nothing else display_state's admin PATCH allows (brightness,
// pause, album selection). Keeps a leaked device token low-blast-radius.
export async function PATCH(request: NextRequest) {
  const auth = await requireScreensaverUser(request);
  if (auth.response) return auth.response;

  const body = await request.json();
  const modeId = String(body.mode_id ?? '').trim();
  if (!modeId) {
    return NextResponse.json({ error: 'mode_id is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: mode } = await supabase
    .from('user_modes')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('id', modeId)
    .maybeSingle();
  if (!mode) {
    return NextResponse.json({ error: 'Unknown mode for this account' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('display_state')
    .update({ active_mode_id: modeId, updated_at: new Date().toISOString() })
    .eq('user_id', auth.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ state: data });
}
