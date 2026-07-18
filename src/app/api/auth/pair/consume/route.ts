import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createSessionToken,
  getDeviceInfo,
  hashSessionToken,
  normalizePairingCode,
  recordAuthEvent,
  setSessionCookie,
} from '@/lib/auth';
import { ensureUserDefaults } from '@/lib/userData';

// POST /api/auth/pair/consume — called by the TV once it sees status
// "approved" from /api/auth/pair/status. Atomically claims the code
// (single-use) and mints the display session cookie.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const code = normalizePairingCode(String(body.code ?? ''));
  if (!code) {
    return NextResponse.json({ error: 'Missing code.' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: claimed, error } = await supabase
    .from('tv_pairing_codes')
    .update({ status: 'consumed' })
    .eq('code', code)
    .eq('status', 'approved')
    .select('user_id')
    .maybeSingle();

  if (error || !claimed?.user_id) {
    return NextResponse.json({ error: 'Not approved yet.' }, { status: 400 });
  }

  const { data: user } = await supabase
    .from('app_users')
    .select('id, email, username, name, created_at')
    .eq('id', claimed.user_id)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  await ensureUserDefaults(user.id);

  const token = createSessionToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);
  await supabase.from('app_sessions').insert({
    user_id: user.id,
    session_hash: hashSessionToken(token),
    kind: 'display',
    expires_at: expires.toISOString(),
    ...getDeviceInfo(request),
  });
  await recordAuthEvent(request, 'tv_pair_consumed', { user_id: user.id, email: user.email });

  const response = NextResponse.json({ user });
  setSessionCookie(response, 'display', token, expires);
  return response;
}
