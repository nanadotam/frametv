import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createSessionToken, hashSessionToken, setSessionCookie, getDeviceInfo } from '@/lib/auth';
import { ensureUserDefaults } from '@/lib/userData';
import { getUserIdForShareToken } from '@/lib/shareToken';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Per-device screensaver link: the token *is* that Mac's screensaver
  // session, so it's reused as the display cookie (no new session row per
  // launch) and revoking the device from Devices kills the link.
  if (/^[A-Za-z0-9_-]{40,}$/.test(token)) {
    const supabase = createServiceClient();
    const { data: session } = await supabase
      .from('app_sessions')
      .select('id, expires_at')
      .eq('session_hash', hashSessionToken(token))
      .eq('kind', 'screensaver')
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!session) return NextResponse.redirect(new URL('/display', request.url));

    const response = NextResponse.redirect(new URL('/display?kiosk=1', request.url));
    setSessionCookie(response, 'display', token, new Date(session.expires_at));
    return response;
  }

  if (!/^[a-zA-Z0-9]{8}$/.test(token)) {
    return NextResponse.redirect(new URL('/display', request.url));
  }

  const userId = await getUserIdForShareToken(token);
  if (!userId) {
    return NextResponse.redirect(new URL('/display', request.url));
  }

  const supabase = createServiceClient();

  const { data: user } = await supabase
    .from('app_users')
    .select('id, email, username, name, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (!user) {
    return NextResponse.redirect(new URL('/display', request.url));
  }

  await ensureUserDefaults(user.id);

  const sessionToken = createSessionToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);
  await supabase.from('app_sessions').insert({
    user_id: user.id,
    session_hash: hashSessionToken(sessionToken),
    kind: 'display',
    expires_at: expires.toISOString(),
    ...getDeviceInfo(request),
  });

  const response = NextResponse.redirect(new URL('/display?kiosk=1', request.url));
  setSessionCookie(response, 'display', sessionToken, expires);
  return response;
}
