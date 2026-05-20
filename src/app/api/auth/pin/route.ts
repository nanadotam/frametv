import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createSessionToken,
  getDeviceInfo,
  hashSessionToken,
  normalizeEmail,
  recordAuthEvent,
  setSessionCookie,
  verifyPin,
} from '@/lib/auth';
import { ensureUserDefaults } from '@/lib/userData';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailOrUsername = String(body.emailOrUsername ?? body.email ?? '').trim();
    const pin = String(body.pin ?? '');
    const deviceName = String(body.device_name ?? '').trim() || null;

    if (!emailOrUsername || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'Enter your email/username and six-digit PIN.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const normalizedEmail = normalizeEmail(emailOrUsername);
    const normalizedUsername = emailOrUsername.toLowerCase();
    let userQuery = supabase
      .from('app_users')
      .select('id, email, username, name, pin_hash, created_at');
    userQuery = emailOrUsername.includes('@')
      ? userQuery.eq('email', normalizedEmail)
      : userQuery.eq('username', normalizedUsername);
    const { data: user } = await userQuery.maybeSingle();

    if (!user || !verifyPin(pin, user.pin_hash)) {
      await recordAuthEvent(request, 'failed_pin', { email: normalizedEmail, device_name: deviceName });
      return NextResponse.json({ error: 'Invalid account or PIN.' }, { status: 401 });
    }

    await ensureUserDefaults(user.id);

    const token = createSessionToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);
    await supabase.from('app_sessions').insert({
      user_id: user.id,
      session_hash: hashSessionToken(token),
      kind: 'display',
      expires_at: expires.toISOString(),
      ...getDeviceInfo(request, deviceName),
    });
    await recordAuthEvent(request, 'pin_unlock', { user_id: user.id, email: user.email, device_name: deviceName });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        created_at: user.created_at,
      },
    });
    setSessionCookie(response, 'display', token, expires);
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
