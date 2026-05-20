import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  DISPLAY_SESSION_COOKIE,
  hashSessionToken,
  recordAuthEvent,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const token = request.cookies.get(DISPLAY_SESSION_COOKIE)?.value;

  if (token) {
    await supabase
      .from('app_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('session_hash', hashSessionToken(token));
  }

  await recordAuthEvent(request, 'logout');

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DISPLAY_SESSION_COOKIE, '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
  return response;
}
