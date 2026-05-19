'use client';

import { useEffect, useRef, useState } from 'react';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  albumArtUrl: string;
  albumName: string;
  durationMs: number;
  progressMs: number;
}

interface NowPlayingResult {
  current: SpotifyTrack | null;
  queue: SpotifyTrack[];
  isPlaying: boolean;
}

interface NowPlayingApiResponse {
  current?: SpotifyTrack | null;
  queue?: SpotifyTrack[];
  isPlaying?: boolean;
}

const POLL_ACTIVE_MS = 5_000;
const POLL_PAUSED_MS = 30_000;

export function useSpotifyNowPlaying(): NowPlayingResult {
  const [state, setState] = useState<NowPlayingResult>({
    current: null,
    queue: [],
    isPlaying: false,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/spotify/now-playing');
        if (res.ok) {
          const data: NowPlayingApiResponse = await res.json();
          if (!cancelled) {
            setState({
              current: data.current ?? null,
              queue: data.queue ?? [],
              isPlaying: data.isPlaying ?? false,
            });
          }
        }
      } catch {
        // network error — keep stale state
      }

      if (!cancelled) {
        const delay = state.isPlaying ? POLL_ACTIVE_MS : POLL_PAUSED_MS;
        timerRef.current = setTimeout(poll, delay);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
