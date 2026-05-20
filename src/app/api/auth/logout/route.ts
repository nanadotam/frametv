import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  ADMIN_SESSION_COOKIE,
  DISPLAY_SESSION_COOKIE,
  clearSessionCookies,
  hashSessionToken,
  recordAuthEvent,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const hashes = [ADMIN_SESSION_COOKIE, DISPLAY_SESSION_COOKIE]
    .map((name) => request.cookies.get(name)?.value)
    .filter(Boolean)
    .map((token) => hashSessionToken(token as string));

  if (hashes.length) {
    await supabase
      .from('app_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .in('session_hash', hashes);
  }
  await recordAuthEvent(request, 'logout');

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
