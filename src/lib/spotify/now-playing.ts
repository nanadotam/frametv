// Spotify now-playing + queue resolver — PRD §10.3
import { spotifyFetch } from './client';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  duration_ms: number;
  uri: string;
}

export interface NowPlayingResult {
  current: SpotifyTrack;
  queue: SpotifyTrack[];
  isPlaying: boolean;
  progressMs: number | null;
}

interface PlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  item: SpotifyTrack | null;
  context?: {
    type: 'album' | 'playlist' | 'artist' | 'show';
    uri: string;
    href: string;
  } | null;
}

interface AlbumTracksResponse {
  items: SpotifyTrack[];
  next: string | null;
}

interface PlaylistTracksResponse {
  items: { track: SpotifyTrack }[];
  next: string | null;
}

export async function getNowPlayingWithQueue(
  accessToken: string
): Promise<NowPlayingResult | null> {
  const playback = await spotifyFetch<PlaybackState | null>(
    '/me/player',
    accessToken
  );

  if (!playback?.item) return null;

  const current = playback.item;
  let queue: SpotifyTrack[] = [];

  if (playback.context?.type === 'album') {
    try {
      const albumId = playback.context.uri.split(':').pop();
      const albumTracks = await spotifyFetch<AlbumTracksResponse>(
        `/albums/${albumId}/tracks?limit=50`,
        accessToken
      );
      const idx = albumTracks.items.findIndex((t) => t.id === current.id);
      queue = albumTracks.items.slice(idx + 1, idx + 6);
    } catch {
      // Queue resolution is best-effort — don't fail the whole request
      queue = [];
    }
  } else if (playback.context?.type === 'playlist') {
    try {
      const playlistId = playback.context.uri.split(':').pop();
      const playlistTracks = await spotifyFetch<PlaylistTracksResponse>(
        `/playlists/${playlistId}/tracks?limit=50&fields=items(track(id,name,artists,album,duration_ms,uri))`,
        accessToken
      );
      const idx = playlistTracks.items.findIndex(
        (it) => it.track?.id === current.id
      );
      queue = playlistTracks.items
        .slice(idx + 1, idx + 6)
        .map((it) => it.track)
        .filter(Boolean);
    } catch {
      queue = [];
    }
  }

  return {
    current,
    queue,
    isPlaying: playback.is_playing,
    progressMs: playback.progress_ms,
  };
}
