import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser, requireDisplayUser } from '@/lib/auth';
import { userSettingKey } from '@/lib/userData';

const DEFAULT_APP_SETTINGS = {
  latitude: 5.6037,
  longitude: -0.187,
  auto_theme: false,
  night_dim_enabled: false,
  night_dim_start: '22:00',
  night_dim_end: '07:00',
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDisplayUser(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const scopedKey = key ? userSettingKey(auth.user.id, key) : null;
    const supabase = createServiceClient();

    if (key) {
      // Return single named setting
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', scopedKey)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ setting: data ? { ...data, key } : null });
    }

    // No key → return the app_settings value directly (what the settings page expects)
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', userSettingKey(auth.user.id, 'app_settings'))
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data?.value ?? DEFAULT_APP_SETTINGS);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { key, value } = body;
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
    if (value === undefined) return NextResponse.json({ error: 'value is required' }, { status: 400 });

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('settings')
      .upsert({ key: userSettingKey(auth.user.id, key), user_id: auth.user.id, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ setting: { ...data, key } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH: save the full body as app_settings value
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('settings')
      .upsert(
        { key: userSettingKey(auth.user.id, 'app_settings'), user_id: auth.user.id, value: body, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ setting: { ...data, key: 'app_settings' } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
