'use client';

import { useEffect, useState } from 'react';
import { useSettings } from './useSettings';
import { getThemeFor, getNextThemeFlip } from '@/lib/theme/sun';

// Default location: Accra, Ghana
const DEFAULT_LAT = 5.6037;
const DEFAULT_LNG = -0.187;

export function useAutoTheme(): 'light' | 'dark' {
  const settings = useSettings();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const lat = settings.location?.lat ?? DEFAULT_LAT;
    const lng = settings.location?.lng ?? DEFAULT_LNG;

    const apply = () => {
      const t = getThemeFor(new Date(), lat, lng);
      setTheme(t);
    };

    apply();

    // Schedule the exact next flip — no polling needed
    const nextFlip = getNextThemeFlip(new Date(), lat, lng);
    const ms = nextFlip.getTime() - Date.now();
    const timer = setTimeout(apply, ms);
    return () => clearTimeout(timer);
  }, [settings.location, theme]);

  return theme;
}
