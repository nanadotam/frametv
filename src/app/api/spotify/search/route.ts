import { NextRequest, NextResponse } from 'next/server';
import { requireDisplayUser } from '@/lib/auth';
import { getAccessToken } from '@/lib/spotify/auth';
import { spotifyFetch } from '@/lib/spotify/client';

interface RawTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; images: { url: string; width: number; height: number }[] };
}

interface SearchResponse {
  tracks: { items: RawTrack[] };
}

export async function GET(request: NextRequest) {
  const auth = await requireDisplayUser(request);
  if (auth.response) return auth.response;

  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ tracks: [] });

  const token = await getAccessToken(auth.user.id);
  if (!token) return NextResponse.json({ error: 'Spotify not connected' }, { status: 401 });

  const data = await spotifyFetch<SearchResponse>(
    `/search?q=${encodeURIComponent(q)}&type=track&limit=20`,
    token
  );

  return NextResponse.json({
    tracks: (data?.tracks?.items ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      uri: t.uri,
      artists: t.artists.map((a) => a.name),
      albumArtUrl: t.album?.images?.[0]?.url ?? '',
      albumName: t.album?.name ?? '',
      durationMs: t.duration_ms,
      progressMs: 0,
    })),
  });
}
