'use client';

import { useEffect, useState } from 'react';
import { getRealtimeClient } from '@/lib/supabase/realtime';
import type { ClockOverlayConfig } from '@/components/display/ClockOverlay';

const DEFAULT: ClockOverlayConfig = {
  enabled: false,
  position: 'bottom-right',
  font: 'Poppins',
};

export function useClockOverlayConfig(): ClockOverlayConfig {
  const [config, setConfig] = useState<ClockOverlayConfig>(DEFAULT);

  useEffect(() => {
    const supabase = getRealtimeClient();

    // Initial fetch
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'clock_overlay')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setConfig({ ...DEFAULT, ...(data.value as Partial<ClockOverlayConfig>) });
      });

    // Realtime: update whenever clock_overlay setting changes in DB
    const channel = supabase
      .channel('clock_overlay_setting')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.clock_overlay' },
        (payload) => {
          const value = (payload.new as { value?: Partial<ClockOverlayConfig> })?.value;
          if (value) setConfig({ ...DEFAULT, ...value });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return config;
}
