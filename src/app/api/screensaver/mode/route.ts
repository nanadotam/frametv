import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireScreensaverUser } from '@/lib/auth';

// Deliberately narrow: the screensaver's device token can only read modes
// (via /api/modes, already bearer-auth-capable) and flip which one is
// active — nothing else display_state's admin PATCH allows (brightness,
// pause, arbitrary album selection). `active_album_ids` is accepted here
// too, but only ever `[]` or `["local"]` — the sentinel the screensaver's
// own frametv-local:// scheme handler resolves against this device's local
// photo folder. That keeps a leaked device token low-blast-radius: it can
// point the display at this Mac's own local photos, never at an arbitrary
// real album.
export async function PATCH(request: NextRequest) {
  const auth = await requireScreensaverUser(request);
  if (auth.response) return auth.response;

  const body = await request.json();
  const modeId = String(body.mode_id ?? '').trim();
  if (!modeId) {
    return NextResponse.json({ error: 'mode_id is required' }, { status: 400 });
  }

  let albumIds: string[] | undefined;
  if ('active_album_ids' in body) {
    const raw = body.active_album_ids;
    const isValid =
      Array.isArray(raw) && (raw.length === 0 || (raw.length === 1 && raw[0] === 'local'));
    if (!isValid) {
      return NextResponse.json(
        { error: 'active_album_ids must be [] or ["local"]' },
        { status: 400 }
      );
    }
    albumIds = raw;
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
    .update({
      active_mode_id: modeId,
      updated_at: new Date().toISOString(),
      // Without this, an active schedule's own album_ids wins over what we
      // just set here (see useActiveMode's override_until check) — a
      // schedule-less setup would look fine and this would silently no-op
      // whenever a schedule is running. Matches setMode()'s 30-minute
      // manual-override convention.
      override_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      ...(albumIds !== undefined ? { active_album_ids: albumIds } : {}),
    })
    .eq('user_id', auth.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ state: data });
}
