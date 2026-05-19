'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Photo } from '@/types/db';

async function fetchPhotos(albumIds?: string[]): Promise<Photo[]> {
  const supabase = createClient();
  let query = supabase
    .from('photos')
    .select('*')
    .order('taken_at', { ascending: false });

  if (albumIds && albumIds.length > 0) {
    query = query.in('album_id', albumIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Photo[];
}

export function usePhotos(albumIds?: string[]): Photo[] {
  const { data } = useQuery({
    queryKey: ['photos', albumIds ?? []],
    queryFn: () => fetchPhotos(albumIds),
  });

  return data ?? [];
}
