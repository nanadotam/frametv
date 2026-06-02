'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeClient } from '@/lib/supabase/realtime';
import type { Schedule } from '@/types/db';

async function fetchSchedules(): Promise<Schedule[]> {
  const res = await fetch('/api/schedules');
  if (!res.ok) throw new Error('Unable to load schedules');
  const json = await res.json();
  return (json.schedules ?? []) as Schedule[];
}

export function useSchedules(): Schedule[] {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['schedules'],
    queryFn: fetchSchedules,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const supabase = getRealtimeClient();
    const channel = supabase
      .channel('schedules_changes_client')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
        queryClient.invalidateQueries({ queryKey: ['schedules'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return data ?? [];
}
