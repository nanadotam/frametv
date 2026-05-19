'use client';

import { useEffect, useState } from 'react';
import { getRealtimeClient } from '@/lib/supabase/realtime';
import { useDisplayStore } from '@/store/displayStore';
import type { DisplayState } from '@/types/db';

export function useDisplayStateRealtime(): DisplayState | null {
  const { displayState, setDisplayState } = useDisplayStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const supabase = getRealtimeClient();

    // Initial fetch
    supabase
      .from('display_state')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) setDisplayState(data as DisplayState);
        setInitialized(true);
      });

    // Realtime subscription
    const channel = supabase
      .channel('display_state_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'display_state',
          filter: 'id=eq.1',
        },
        (payload) => {
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
