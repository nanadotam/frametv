'use client';

import { useEffect, useState } from 'react';
import { subscribeUserTable } from '@/lib/supabase/userChannel';
import type { ClockOverlayConfig } from '@/components/display/ClockOverlay';

const DEFAULT: ClockOverlayConfig = {
  enabled: false,
  position: 'bottom-right',
  font: 'Poppins',
};

export function useClockOverlayConfig(): ClockOverlayConfig {
  const [config, setConfig] = useState<ClockOverlayConfig>(DEFAULT);

  useEffect(() => {
    const fetchConfig = async () => {
      const res = await fetch('/api/settings?key=clock_overlay');
      if (!res.ok) return;
      const json = await res.json();
      if (json.setting?.value) setConfig({ ...DEFAULT, ...(json.setting.value as Partial<ClockOverlayConfig>) });
    };

    fetchConfig();
    const interval = setInterval(fetchConfig, 60_000);

    const unsubscribe = subscribeUserTable('settings', () => fetchConfig());

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return config;
}
