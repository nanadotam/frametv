import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';
import { userSettingKey } from '@/lib/userData';

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const supabase = createServiceClient();

  const [spotifyRes, googleKeyRes, spotifyProfileRes] = await Promise.all([
    supabase
      .from('spotify_auth')
      .select('access_token, expires_at')
      .eq('user_id', auth.user.id)
      .maybeSingle(),
    supabase
      .from('settings')
      .select('value')
      .eq('key', userSettingKey(auth.user.id, 'google_api_key'))
      .maybeSingle(),
    supabase
      .from('settings')
      .select('value')
      .eq('key', userSettingKey(auth.user.id, 'spotify_profile'))
      .maybeSingle(),
  ]);

  const spotifyConnected =
    !!spotifyRes.data?.access_token &&
    (spotifyRes.data.expires_at
      ? new Date(spotifyRes.data.expires_at).getTime() > Date.now() - 60 * 60 * 1000
      : true);

  const googleApiKey = googleKeyRes.data?.value ?? null;
  const spotifyProfile = spotifyProfileRes.data?.value ?? null;

  return NextResponse.json({
    spotify_connected: spotifyConnected,
    spotify_profile: spotifyProfile,
    google_connected: !!googleApiKey,
    unsplash_key_set: !!process.env.UNSPLASH_ACCESS_KEY,
    display_token: process.env.DISPLAY_TOKEN ?? '',
    google_api_key: googleApiKey ?? '',
  });
}
