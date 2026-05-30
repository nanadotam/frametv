import { createServiceClient } from '@/lib/supabase/server';

const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';

const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
  'streaming',
  'user-modify-playback-state',
  'user-read-private',
  'user-read-email',
].join(' ');

export function buildRedirectUri(origin: string): string {
  return `${origin}/api/auth/spotify/callback`;
}

export function getSpotifyAuthUrl(origin: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: buildRedirectUri(origin),
    scope: SCOPES,
    show_dialog: 'true',
  });
  return `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string, origin: string, userId?: string): Promise<void> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: buildRedirectUri(origin),
  });

  const res = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token exchange failed: ${res.status} — ${text}`);
  }

  const tokens = await res.json();
  await saveSpotifyTokens(tokens);

  if (userId) {
    try {
      const profileRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profileRes.ok) {
        const p = await profileRes.json();
        const { userSettingKey } = await import('@/lib/userData');
        const supabase = createServiceClient();
        await supabase.from('settings').upsert(
          {
            key: userSettingKey(userId, 'spotify_profile'),
            user_id: userId,
            value: {
              display_name: p.display_name ?? null,
              email: p.email ?? null,
              image_url: (p.images as Array<{ url: string }>)?.[0]?.url ?? null,
              spotify_id: p.id ?? null,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );
      }
    } catch {
      // Profile fetch is non-critical — tokens are already saved
    }
  }
}

async function saveSpotifyTokens(tokens: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error } = await supabase.from('spotify_auth').upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: expiresAt,
    scope: tokens.scope ?? SCOPES,
  });
  if (error) throw new Error(`Failed to save Spotify tokens: ${error.message}`);
}

export async function getAccessToken(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('spotify_auth')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data?.access_token) return null;

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt - Date.now() < fiveMinutes && data.refresh_token) {
    try {
      const newToken = await refreshToken(data.refresh_token);
      return newToken;
    } catch {
      return null;
    }
  }

  return data.access_token;
}

export async function refreshToken(refreshTokenValue: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
  });

  const res = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token refresh failed: ${res.status} — ${text}`);
  }

  const tokens = await res.json();

  // Save refreshed tokens
  const supabase = createServiceClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabase.from('spotify_auth').upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? refreshTokenValue,
    expires_at: expiresAt,
    scope: tokens.scope,
  });

  return tokens.access_token;
}
