import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServiceClient();

  const [spotifyRes, googleKeyRes] = await Promise.all([
    supabase
      .from('spotify_auth')
      .select('access_token, expires_at')
      .eq('id', 1)
      .maybeSingle(),
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'google_api_key')
      .maybeSingle(),
  ]);

  const spotifyConnected =
    !!spotifyRes.data?.access_token &&
    (spotifyRes.data.expires_at
      ? new Date(spotifyRes.data.expires_at).getTime() > Date.now() - 60 * 60 * 1000
      : true);

  const googleApiKey = googleKeyRes.data?.value ?? null;

  return NextResponse.json({
    spotify_connected: spotifyConnected,
    google_connected: !!googleApiKey,
    unsplash_key_set: !!process.env.UNSPLASH_ACCESS_KEY,
    display_token: process.env.DISPLAY_TOKEN ?? '',
    google_api_key: googleApiKey ?? '',
  });
}
