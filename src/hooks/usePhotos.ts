'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRealtimeClient } from '@/lib/supabase/realtime';
import type { Photo } from '@/types/db';

async function fetchPhotos(albumIds?: string[]): Promise<Photo[]> {
  const params = new URLSearchParams();
  params.set('limit', '1000');
  if (albumIds?.length) params.set('albumIds', albumIds.join(','));
  const res = await fetch(`/api/photos?${params.toString()}`);
  if (!res.ok) throw new Error('Unable to load photos');
  const json = await res.json();
  return (json.photos ?? []) as Photo[];
}

export function usePhotos(albumIds?: string[]): Photo[] {
  const queryClient = useQueryClient();
  const albumKey = albumIds?.join(',') ?? '';
  const queryKey = ['photos', albumKey] as const;
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchPhotos(albumIds),
    refetchInterval: 5_000,
  });

  useEffect(() => {
    const supabase = getRealtimeClient();
    const channel = supabase
      .channel(`photos_changes_${albumKey || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, () => {
        queryClient.invalidateQueries({ queryKey: ['photos', albumKey] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [albumKey, queryClient]);

  return data ?? [];
}
