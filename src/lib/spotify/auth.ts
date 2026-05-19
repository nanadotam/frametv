import { createServiceClient } from '@/lib/supabase/server';

const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';

const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
].join(' ');

export function getSpotifyAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    scope: SCOPES,
    show_dialog: 'true',
  });
  return `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<void> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
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
