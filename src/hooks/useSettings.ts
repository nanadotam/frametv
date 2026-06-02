'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

interface Location {
  lat: number;
  lng: number;
}

interface DimWindow {
  startMinute: number;
  endMinute: number;
}

interface SettingsResult {
  location: Location | null;
  dim: DimWindow | null;
  isLoading: boolean;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

async function fetchSettings(): Promise<{ location: Location | null; dim: DimWindow | null }> {
  const res = await fetch('/api/settings?key=app_settings');
  if (!res.ok) return { location: null, dim: null };
  const json = await res.json();
  const appSettings = json.setting?.value as Record<string, unknown> | undefined;

  // Derive location from app_settings (admin UI) or legacy location key
  let location: Location | null = null;
  if (appSettings && typeof appSettings.latitude === 'number' && typeof appSettings.longitude === 'number') {
    location = { lat: appSettings.latitude, lng: appSettings.longitude };
  }

  // Derive dim window: use app_settings when present, else legacy dim key.
  // If night_dim_enabled is explicitly false, return null (no dim).
  let dim: DimWindow | null = null;
  if (appSettings) {
    if (appSettings.night_dim_enabled === false) {
      dim = null;
    } else if (appSettings.night_dim_start && appSettings.night_dim_end) {
      dim = {
        startMinute: parseTimeToMinutes(appSettings.night_dim_start as string),
        endMinute: parseTimeToMinutes(appSettings.night_dim_end as string),
      };
    }
  }

  return { location, dim };
}

export function useSettings(): SettingsResult {
  const { location, dim, setLocation, setDim } = useSettingsStore();

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (data) {
      setLocation(data.location);
      setDim(data.dim);
    }
  }, [data, setLocation, setDim]);

  return {
    location: data ? data.location : location,
    dim: data ? data.dim : dim,
    isLoading,
  };
}
