import { NextRequest, NextResponse } from 'next/server';
import { requireDisplayUser } from '@/lib/auth';
import { getAccessToken } from '@/lib/spotify/auth';
import { spotifyFetch } from '@/lib/spotify/client';
import { createServiceClient } from '@/lib/supabase/server';
import { userSettingKey } from '@/lib/userData';

type Action = 'play' | 'pause' | 'next' | 'prev' | 'play_track' | 'volume' | 'transfer';

interface PlayerBody {
  action: Action;
  uri?: string;
  device_id?: string;
  volume?: number;
}

async function getStoredDeviceId(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', userSettingKey(userId, 'spotify_device_id'))
    .maybeSingle();
  return (data?.value as string) ?? null;
}

function spotifyErrorResponse(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('403') || msg.includes('PREMIUM_REQUIRED')) {
    return NextResponse.json({ error: 'Spotify Premium is required for browser playback', code: 'premium_required' }, { status: 403 });
  }
  if (msg.includes('404') || msg.includes('NO_ACTIVE_DEVICE')) {
    return NextResponse.json({ error: 'Device not found — is the browser tab still open?', code: 'device_not_found' }, { status: 404 });
  }
  if (msg.includes('502') || msg.includes('503')) {
    return NextResponse.json({ error: 'Spotify service unavailable, try again', code: 'spotify_unavailable' }, { status: 502 });
  }
  return NextResponse.json({ error: msg }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const auth = await requireDisplayUser(request);
  if (auth.response) return auth.response;

  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Spotify not connected' }, { status: 401 });

  const body: PlayerBody = await request.json();
  const { action } = body;

  const deviceId = body.device_id ?? await getStoredDeviceId(auth.user.id);
  const deviceParam = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';

  try {
    switch (action) {
      case 'play':
        await spotifyFetch(`/me/player/play${deviceParam}`, token, { method: 'PUT' });
        break;

      case 'pause':
        await spotifyFetch(`/me/player/pause${deviceParam}`, token, { method: 'PUT' });
        break;

      case 'next':
        await spotifyFetch(`/me/player/next${deviceParam}`, token, { method: 'POST' });
        break;

      case 'prev':
        await spotifyFetch(`/me/player/previous${deviceParam}`, token, { method: 'POST' });
        break;

      case 'play_track': {
        if (!body.uri) return NextResponse.json({ error: 'uri required' }, { status: 400 });
        if (!deviceId) return NextResponse.json({ error: 'No device registered — open the display or music page first', code: 'no_device' }, { status: 400 });
        await spotifyFetch(`/me/player/play${deviceParam}`, token, {
          method: 'PUT',
          body: JSON.stringify({ uris: [body.uri] }),
        });
        break;
      }

      case 'volume': {
        const vol = Math.min(100, Math.max(0, body.volume ?? 50));
        await spotifyFetch(
          `/me/player/volume?volume_percent=${vol}${deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''}`,
          token,
          { method: 'PUT' }
        );
        break;
      }

      case 'transfer': {
        if (!deviceId) return NextResponse.json({ error: 'No device registered', code: 'no_device' }, { status: 400 });
        await spotifyFetch('/me/player', token, {
          method: 'PUT',
          body: JSON.stringify({ device_ids: [deviceId], play: true }),
        });
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    return spotifyErrorResponse(err);
  }

  return NextResponse.json({ ok: true });
}
