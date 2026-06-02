import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createSessionToken, hashSessionToken, setSessionCookie, getDeviceInfo } from '@/lib/auth';
import { ensureUserDefaults } from '@/lib/userData';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!/^[a-zA-Z0-9]{8}$/.test(token)) {
    return NextResponse.redirect(new URL('/display', request.url));
  }

  const supabase = createServiceClient();

  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', `share:${token}`)
    .maybeSingle();

  const userId = data?.value as string | undefined;
  if (!userId) {
    return NextResponse.redirect(new URL('/display', request.url));
  }

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

  const response = NextResponse.redirect(new URL('/display', request.url));
  setSessionCookie(response, 'display', sessionToken, expires);
  return response;
}
