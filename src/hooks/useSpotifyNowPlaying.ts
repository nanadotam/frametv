'use client';

import { useEffect, useRef, useState } from 'react';

export type { SpotifyTrack } from '@/lib/spotify/now-playing';
import type { SpotifyTrack } from '@/lib/spotify/now-playing';

interface NowPlayingResult {
  current: SpotifyTrack | null;
  queue: SpotifyTrack[];
  history: SpotifyTrack[];
  isPlaying: boolean;
}

interface NowPlayingApiResponse {
  current?: SpotifyTrack | null;
  queue?: SpotifyTrack[];
  isPlaying?: boolean;
}

const POLL_ACTIVE_MS = 3_000;
const POLL_PAUSED_MS = 15_000;
const HISTORY_KEY = 'frametv:spotify:history';
const MAX_HISTORY = 20;

function loadHistory(): SpotifyTrack[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveHistory(tracks: SpotifyTrack[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(tracks.slice(-MAX_HISTORY)));
  } catch {
    // localStorage may be unavailable
  }
}

export function useSpotifyNowPlaying(): NowPlayingResult {
  const [state, setState] = useState<NowPlayingResult>({
    current: null,
    queue: [],
    history: loadHistory(),
    isPlaying: false,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);
  const prevTrackIdRef = useRef<string | null>(null);
  const historyRef = useRef<SpotifyTrack[]>(loadHistory());
  // Hold the latest current in a ref so history can access it inside setState
  const currentRef = useRef<SpotifyTrack | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/spotify/now-playing');
        if (res.ok) {
          const data: NowPlayingApiResponse = await res.json();
          if (!cancelled) {
            const newCurrent = data.current ?? null;
            const newId = newCurrent?.id ?? null;
            const prevId = prevTrackIdRef.current;

            if (newId && prevId && newId !== prevId) {
              // Track changed — push the old track into history
              const prev = currentRef.current;
              if (prev) {
                const tail = historyRef.current[historyRef.current.length - 1];
                if (tail?.id !== prev.id) {
                  const updated = [...historyRef.current, prev].slice(-MAX_HISTORY);
                  historyRef.current = updated;
                  saveHistory(updated);
                  currentRef.current = newCurrent;
                  prevTrackIdRef.current = newId;
                  isPlayingRef.current = data.isPlaying ?? false;
                  setState({
                    current: newCurrent,
                    queue: data.queue ?? [],
                    history: updated,
                    isPlaying: data.isPlaying ?? false,
                  });
                  // fall through to schedule next poll
                } else {
                  currentRef.current = newCurrent;
                  prevTrackIdRef.current = newId;
                  isPlayingRef.current = data.isPlaying ?? false;
                  setState((s) => ({
                    ...s,
                    current: newCurrent,
                    queue: data.queue ?? [],
                    isPlaying: data.isPlaying ?? false,
                  }));
                }
              } else {
                currentRef.current = newCurrent;
                prevTrackIdRef.current = newId;
                isPlayingRef.current = data.isPlaying ?? false;
                setState((s) => ({
                  ...s,
                  current: newCurrent,
                  queue: data.queue ?? [],
                  isPlaying: data.isPlaying ?? false,
                }));
              }
            } else {
              // Same track or no current — just update queue/playing state
              if (newId && !prevId) prevTrackIdRef.current = newId;
              currentRef.current = newCurrent;
              isPlayingRef.current = data.isPlaying ?? false;
              setState((s) => ({
                ...s,
                current: newCurrent,
                queue: data.queue ?? [],
                isPlaying: data.isPlaying ?? false,
              }));
            }
          }
        }
      } catch {
        // network error — keep stale state
      }

      // Always schedule next poll — this was missing before and caused polling to stop on track change
      if (!cancelled) {
        const delay = isPlayingRef.current ? POLL_ACTIVE_MS : POLL_PAUSED_MS;
        timerRef.current = setTimeout(poll, delay);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
