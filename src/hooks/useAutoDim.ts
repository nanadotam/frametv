'use client';

import { useEffect, useState } from 'react';
import { useSettings } from './useSettings';

export function useAutoDim(): boolean {
  const settings = useSettings();
  const [dim, setDim] = useState(false);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const dimStart = settings.dim?.startMinute ?? 23 * 60; // 23:00 default
      const dimEnd = settings.dim?.endMinute ?? 6 * 60;       // 06:00 default

      // Handle overnight wrap (e.g. 23:00–06:00)
      const inWindow =
        dimStart > dimEnd
          ? cur >= dimStart || cur < dimEnd
          : cur >= dimStart && cur < dimEnd;

      setDim(inWindow);
    };

    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [settings.dim]);

  return dim;
}
