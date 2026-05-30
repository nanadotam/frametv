import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser, hashPin, verifyPin, verifyPassword } from '@/lib/auth';
import { userSettingKey } from '@/lib/userData';

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const body = await request.json();
  const mode = String(body.mode ?? '');
  const newPin = String(body.new_pin ?? '');

  if (!/^\d{6}$/.test(newPin)) {
    return NextResponse.json({ error: 'New PIN must be exactly 6 digits.' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: user } = await supabase
    .from('app_users')
    .select('pin_hash, password_hash')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  if (mode === 'pin') {
    const oldPin = String(body.old_pin ?? '');
    if (!/^\d{6}$/.test(oldPin)) {
      return NextResponse.json({ error: 'Current PIN must be exactly 6 digits.' }, { status: 400 });
    }
    if (!verifyPin(oldPin, user.pin_hash)) {
      return NextResponse.json({ error: 'Current PIN is incorrect.' }, { status: 401 });
    }
  } else if (mode === 'password') {
    const password = String(body.password ?? '');
    if (!password) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }
    if (!verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Password is incorrect.' }, { status: 401 });
    }
  } else {
    return NextResponse.json({ error: 'Invalid mode. Use "pin" or "password".' }, { status: 400 });
  }

  await Promise.all([
    supabase.from('app_users').update({ pin_hash: hashPin(newPin) }).eq('id', auth.user.id),
    supabase.from('settings').upsert(
      {
        key: userSettingKey(auth.user.id, 'display_pin_plain'),
        user_id: auth.user.id,
        value: newPin,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    ),
  ]);

  return NextResponse.json({ ok: true });
}
