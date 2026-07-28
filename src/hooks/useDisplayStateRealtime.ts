'use client';

import { useEffect, useRef, useState } from 'react';
import { subscribeDisplayState } from '@/lib/supabase/displayRealtimeChannel';
import { useDisplayStore } from '@/store/displayStore';
import type { DisplayState } from '@/types/db';

async function fetchDisplayState(): Promise<DisplayState | null> {
  const res = await fetch('/api/display-state');
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Unable to load display state');
  const json = await res.json();
  return (json.state ?? null) as DisplayState | null;
}

/**
 * @param initialState When provided (e.g. fetched server-side alongside the
 * page shell), skips the initial client fetch entirely — only the realtime
 * subscription is set up. Pass `undefined` (the default) to fetch as before.
 */
export function useDisplayStateRealtime(initialState?: DisplayState | null): DisplayState | null {
  const { displayState, setDisplayState } = useDisplayStore();
  const [initialized, setInitialized] = useState(initialState !== undefined);
  const userIdRef = useRef<string | null>(
    (initialState as (DisplayState & { user_id?: string }) | null | undefined)?.user_id ?? null
  );

  useEffect(() => {
    if (initialState !== undefined) {
      if (initialState) {
        userIdRef.current = (initialState as DisplayState & { user_id?: string }).user_id ?? null;
        setDisplayState(initialState);
      }
    } else {
      fetchDisplayState()
        .then((data) => {
          if (data) {
            userIdRef.current = (data as DisplayState & { user_id?: string }).user_id ?? null;
            setDisplayState(data);
          }
          setInitialized(true);
        })
        .catch(() => setInitialized(true));
    }

    return subscribeDisplayState((row) => {
      if (userIdRef.current && row.user_id !== userIdRef.current) return;
      setDisplayState(row as unknown as DisplayState);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDisplayState]);

  return initialized ? displayState : null;
}
