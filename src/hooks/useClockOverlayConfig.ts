'use client';

import { useEffect, useState } from 'react';
import type { ClockOverlayConfig } from '@/components/display/ClockOverlay';

const DEFAULT: ClockOverlayConfig = {
  enabled: false,
  position: 'bottom-right',
  font: 'Poppins',
};

export function useClockOverlayConfig(): ClockOverlayConfig {
  const [config, setConfig] = useState<ClockOverlayConfig>(DEFAULT);

  useEffect(() => {
    fetch('/api/settings?key=clock_overlay')
      .then((r) => r.json())
      .then((json) => {
        if (json.setting?.value) {
          setConfig({ ...DEFAULT, ...(json.setting.value as Partial<ClockOverlayConfig>) });
        }
      })
      .catch(() => {});
  }, []);

  return config;
}
