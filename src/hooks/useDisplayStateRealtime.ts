'use client';

import { useEffect, useState } from 'react';
import { getRealtimeClient } from '@/lib/supabase/realtime';
import { useDisplayStore } from '@/store/displayStore';
import type { DisplayState } from '@/types/db';

async function fetchDisplayState(): Promise<DisplayState | null> {
  const res = await fetch('/api/display-state');
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Unable to load display state');
  const json = await res.json();
  return (json.state ?? null) as DisplayState | null;
}

export function useDisplayStateRealtime(): DisplayState | null {
  const { displayState, setDisplayState } = useDisplayStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let userId: string | null = null;
    const supabase = getRealtimeClient();

    fetchDisplayState()
      .then((data) => {
        if (data) {
          userId = (data as DisplayState & { user_id?: string }).user_id ?? null;
          setDisplayState(data);
        }
        setInitialized(true);
      })
      .catch(() => setInitialized(true));

    const channel = supabase
      .channel('display_state_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'display_state',
        },
        (payload) => {
          if (userId && (payload.new as { user_id?: string }).user_id !== userId) return;
          if (payload.new && Object.keys(payload.new).length > 0) {
            setDisplayState(payload.new as DisplayState);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setDisplayState]);

  return initialized ? displayState : null;
}
