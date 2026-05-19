'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Schedule } from '@/types/db';

async function fetchSchedules(): Promise<Schedule[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('is_enabled', true)
    .order('priority', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Schedule[];
}

export function useSchedules(): Schedule[] {
  const { data } = useQuery({
    queryKey: ['schedules'],
    queryFn: fetchSchedules,
  });

  return data ?? [];
}
