'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeUserTable } from '@/lib/supabase/userChannel';
import { FALLBACK_POLL_MS } from '@/lib/polling';
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
    refetchInterval: FALLBACK_POLL_MS,
  });

  useEffect(() => {
    return subscribeUserTable('schedules', () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    });
  }, [queryClient]);

  return data ?? [];
}
