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

    const fetchConfig = async () => {
      const res = await fetch('/api/settings?key=clock_overlay');
      if (!res.ok) return;
      const json = await res.json();
      if (json.setting?.value) setConfig({ ...DEFAULT, ...(json.setting.value as Partial<ClockOverlayConfig>) });
    };

    fetchConfig();
    const interval = setInterval(fetchConfig, 5_000);

    const channel = supabase
      .channel('clock_overlay_setting')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        () => fetchConfig()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  return config;
}
