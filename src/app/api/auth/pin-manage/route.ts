import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser, hashPin } from '@/lib/auth';
import { userSettingKey } from '@/lib/userData';

const PIN_SETTING_KEY = 'display_pin_plain';

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', userSettingKey(auth.user.id, PIN_SETTING_KEY))
    .maybeSingle();

  return NextResponse.json({ pin: (data?.value as string) ?? null });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const body = await request.json();
  const pin = String(body.pin ?? '');

  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 6 digits.' }, { status: 400 });
  }

  const supabase = createServiceClient();

  await Promise.all([
    supabase
      .from('app_users')
      .update({ pin_hash: hashPin(pin) })
      .eq('id', auth.user.id),
    supabase
      .from('settings')
      .upsert(
        { key: userSettingKey(auth.user.id, PIN_SETTING_KEY), user_id: auth.user.id, value: pin, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      ),
  ]);

  return NextResponse.json({ ok: true });
}
