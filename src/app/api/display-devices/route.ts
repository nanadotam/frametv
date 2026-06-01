import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getDeviceInfo, requireAdminUser, requireDisplayUser } from '@/lib/auth';

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function stringOrNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 500) : null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('display_devices')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('last_seen_at', { ascending: false })
      .limit(25);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ devices: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDisplayUser(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const clientId = stringOrNull(body.client_id);
    if (!clientId) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const device = getDeviceInfo(request, stringOrNull(body.label));
    const now = new Date().toISOString();

    const row = {
      user_id: auth.user.id,
      client_id: clientId,
      label: stringOrNull(body.label),
      route: stringOrNull(body.route),
      renderer: stringOrNull(body.renderer),
      active_mode_id: stringOrNull(body.active_mode_id),
      viewport_width: numberOrNull(body.viewport_width),
      viewport_height: numberOrNull(body.viewport_height),
      screen_width: numberOrNull(body.screen_width),
      screen_height: numberOrNull(body.screen_height),
      device_pixel_ratio: numberOrNull(body.device_pixel_ratio),
      fullscreen_supported: typeof body.fullscreen_supported === 'boolean' ? body.fullscreen_supported : null,
      fullscreen_active: typeof body.fullscreen_active === 'boolean' ? body.fullscreen_active : null,
      visibility_state: stringOrNull(body.visibility_state),
      last_seen_at: now,
      ...device,
    };

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('display_devices')
      .upsert(row, {
        onConflict: 'user_id,client_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ device: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
