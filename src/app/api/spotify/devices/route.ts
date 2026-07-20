import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getAccessToken } from '@/lib/spotify/auth';
import { spotifyFetch } from '@/lib/spotify/client';
import { createServiceClient } from '@/lib/supabase/server';
import { userSettingKey } from '@/lib/userData';

export interface SpotifyDevice {
  id: string;
  is_active: boolean;
  name: string;
  type: string;
  volume_percent: number | null;
  supports_volume: boolean;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const token = await getAccessToken(auth.user.id);
  if (!token) return NextResponse.json({ error: 'Spotify not connected' }, { status: 401 });

  const supabase = createServiceClient();
  const [devicesData, settingRow] = await Promise.all([
    spotifyFetch<{ devices: SpotifyDevice[] }>('/me/player/devices', token),
    supabase
      .from('settings')
      .select('value')
      .eq('key', userSettingKey(auth.user.id, 'spotify_device_id'))
      .maybeSingle(),
  ]);

  return NextResponse.json({
    devices: devicesData?.devices ?? [],
    frameTvDeviceId: (settingRow.data?.value as string) ?? null,
  });
}
