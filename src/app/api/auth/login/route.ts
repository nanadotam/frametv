import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createSessionToken,
  getDeviceInfo,
  hashSessionToken,
  normalizeEmail,
  recordAuthEvent,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth';
import { ensureUserDefaults } from '@/lib/userData';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(String(body.email ?? ''));
    const password = String(body.password ?? '');
    const deviceName = String(body.device_name ?? '').trim() || null;

    const supabase = createServiceClient();
    const { data: user } = await supabase
      .from('app_users')
      .select('id, email, username, name, password_hash, created_at')
      .eq('email', email)
      .maybeSingle();

    if (!user || !verifyPassword(password, user.password_hash)) {
      await recordAuthEvent(request, 'failed_login', { email, device_name: deviceName });
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    await ensureUserDefaults(user.id);

    const token = createSessionToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await supabase.from('app_sessions').insert({
      user_id: user.id,
      session_hash: hashSessionToken(token),
      kind: 'admin',
      expires_at: expires.toISOString(),
      ...getDeviceInfo(request, deviceName),
    });
    await recordAuthEvent(request, 'login', { user_id: user.id, email, device_name: deviceName });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        created_at: user.created_at,
      },
    });
    setSessionCookie(response, 'admin', token, expires);
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
