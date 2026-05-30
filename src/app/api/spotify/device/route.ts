import { NextRequest, NextResponse } from 'next/server';
import { requireDisplayUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { userSettingKey } from '@/lib/userData';

// Called by the display page when the Web Playback SDK registers a device.
export async function POST(request: NextRequest) {
  const auth = await requireDisplayUser(request);
  if (auth.response) return auth.response;

  const { device_id } = await request.json();
  if (!device_id) return NextResponse.json({ error: 'device_id required' }, { status: 400 });

  const supabase = createServiceClient();
  await supabase.from('settings').upsert({
    key: userSettingKey(auth.user.id, 'spotify_device_id'),
    user_id: auth.user.id,
    value: device_id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  return NextResponse.json({ ok: true });
}
