import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createSessionToken,
  getDeviceInfo,
  hashPassword,
  hashPin,
  hashSessionToken,
  normalizeEmail,
  normalizeUsername,
  recordAuthEvent,
  setSessionCookie,
} from '@/lib/auth';
import { ensureUserDefaults, userSettingKey } from '@/lib/userData';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(String(body.email ?? ''));
    const username = normalizeUsername(String(body.username ?? ''));
    const name = String(body.name ?? '').trim();
    const password = String(body.password ?? '');
    const pin = String(body.pin ?? '');
    const deviceName = String(body.device_name ?? '').trim() || null;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (!username || username.length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 characters.' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters.' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 6 digits.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: user, error } = await supabase
      .from('app_users')
      .insert({
        email,
        username,
        name,
        password_hash: hashPassword(password),
        pin_hash: hashPin(pin),
      })
      .select('id, email, username, name, created_at')
      .single();

    if (error) {
      const duplicate = error.message.toLowerCase().includes('duplicate');
      return NextResponse.json(
        { error: duplicate ? 'Email or username is already in use.' : error.message },
        { status: duplicate ? 409 : 500 }
      );
    }

    await ensureUserDefaults(user.id);

    // Store plaintext PIN so admin can see it on the settings page
    await supabase.from('settings').upsert({
      key: userSettingKey(user.id, 'display_pin_plain'),
      user_id: user.id,
      value: pin,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    const token = createSessionToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await supabase.from('app_sessions').insert({
      user_id: user.id,
      session_hash: hashSessionToken(token),
      kind: 'admin',
      expires_at: expires.toISOString(),
      ...getDeviceInfo(request, deviceName),
    });
    await recordAuthEvent(request, 'signup', { user_id: user.id, email, device_name: deviceName });

    const response = NextResponse.json({ user });
    setSessionCookie(response, 'admin', token, expires);
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
