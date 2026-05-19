'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
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

async function fetchSettings(): Promise<{ location: Location | null; dim: DimWindow | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['location', 'dim']);

  if (error) throw error;

  const map = Object.fromEntries(
    (data ?? []).map((row: { key: string; value: unknown }) => [row.key, row.value])
  );

  return {
    location: (map['location'] as Location) ?? null,
    dim: (map['dim'] as DimWindow) ?? null,
  };
}

export function useSettings(): SettingsResult {
  const { location, dim, setLocation, setDim } = useSettingsStore();

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (data) {
      setLocation(data.location);
      setDim(data.dim);
    }
  }, [data, setLocation, setDim]);

  return {
    location: data?.location ?? location,
    dim: data?.dim ?? dim,
    isLoading,
  };
}
