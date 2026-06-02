import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser, createSessionToken, hashSessionToken, setSessionCookie, getDeviceInfo } from '@/lib/auth';
import { userSettingKey } from '@/lib/userData';

function generateToken(): string {
  const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('');
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', userSettingKey(auth.user.id, 'share_token'))
    .maybeSingle();

  const token = data?.value as string | null;
  return NextResponse.json({ token: token ?? null });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const supabase = createServiceClient();

  // Revoke any previous token for this user
  const { data: existing } = await supabase
    .from('settings')
    .select('value')
    .eq('key', userSettingKey(auth.user.id, 'share_token'))
    .maybeSingle();

  if (existing?.value) {
    await supabase
      .from('settings')
      .delete()
      .eq('key', `share:${existing.value}`);
  }

  const token = generateToken();

  await Promise.all([
    // User-scoped entry: for admin display
    supabase.from('settings').upsert(
      { key: userSettingKey(auth.user.id, 'share_token'), user_id: auth.user.id, value: token, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    ),
    // Global lookup entry: for /s/[token] redemption
    supabase.from('settings').upsert(
      { key: `share:${token}`, value: auth.user.id, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    ),
  ]);

  return NextResponse.json({ token });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', userSettingKey(auth.user.id, 'share_token'))
    .maybeSingle();

  if (data?.value) {
    await Promise.all([
      supabase.from('settings').delete().eq('key', `share:${data.value}`),
      supabase.from('settings').delete().eq('key', userSettingKey(auth.user.id, 'share_token')),
    ]);
  }

  return NextResponse.json({ ok: true });
}
