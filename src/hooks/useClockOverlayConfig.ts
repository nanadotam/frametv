'use client';

import { useEffect, useState } from 'react';
import { subscribeUserTable } from '@/lib/supabase/userChannel';
import { FALLBACK_POLL_MS, visibleInterval } from '@/lib/polling';
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
    const stopPolling = visibleInterval(fetchConfig, FALLBACK_POLL_MS);

    const unsubscribe = subscribeUserTable('settings', () => fetchConfig());

    return () => {
      stopPolling();
      unsubscribe();
    };
  }, []);

  return config;
}
