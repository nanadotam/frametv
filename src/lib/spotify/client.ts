const SPOTIFY_BASE = 'https://api.spotify.com/v1';

export async function spotifyFetch<T = unknown>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${SPOTIFY_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 204) {
    return null as T;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}
