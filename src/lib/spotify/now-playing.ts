// Spotify now-playing + queue resolver
import { spotifyFetch } from './client';

// Raw shape returned by Spotify Web API
interface RawSpotifyTrack {
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

// Mapped shape consumed by the client hook and UI
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  albumArtUrl: string;
  albumName: string;
  durationMs: number;
  progressMs: number;
}

function mapTrack(raw: RawSpotifyTrack, progressMs = 0): SpotifyTrack {
  return {
    id: raw.id,
    name: raw.name,
    artists: raw.artists.map((a) => a.name),
    albumArtUrl: raw.album?.images?.[0]?.url ?? '',
    albumName: raw.album?.name ?? '',
    durationMs: raw.duration_ms,
    progressMs,
  };
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
  item: RawSpotifyTrack | null;
}

interface QueueResponse {
  currently_playing: RawSpotifyTrack | null;
  queue: RawSpotifyTrack[];
}

export async function getNowPlayingWithQueue(
  accessToken: string
): Promise<NowPlayingResult | null> {
  // Fetch playback state and queue in parallel
  const [playback, queueData] = await Promise.all([
    spotifyFetch<PlaybackState | null>('/me/player', accessToken),
    spotifyFetch<QueueResponse | null>('/me/player/queue', accessToken).catch(() => null),
  ]);

  if (!playback?.item) return null;

  // Use up to 10 upcoming tracks from the real queue endpoint
  const rawQueue: RawSpotifyTrack[] = queueData?.queue?.slice(0, 10) ?? [];

  return {
    current: mapTrack(playback.item, playback.progress_ms ?? 0),
    queue: rawQueue.map((t) => mapTrack(t)),
    isPlaying: playback.is_playing,
    progressMs: playback.progress_ms,
  };
}
