'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { subscribeUserTable } from '@/lib/supabase/userChannel';
import { FALLBACK_POLL_MS } from '@/lib/polling';
import type { Photo } from '@/types/db';

/** 'all' mixes stills and videos (multimodal Pinterest/Grid). */
export type MediaType = 'image' | 'video' | 'all';

async function fetchPhotos(albumIds: string[] | undefined, mediaType: MediaType): Promise<Photo[]> {
  const params = new URLSearchParams();
  params.set('limit', '1000');
  if (albumIds?.length) params.set('albumIds', albumIds.join(','));
  if (mediaType !== 'image') params.set('mediaType', mediaType);
  const res = await fetch(`/api/photos?${params.toString()}`);
  if (!res.ok) throw new Error('Unable to load photos');
  const json = await res.json();
  return (json.photos ?? []) as Photo[];
}


export function usePhotos(albumIds?: string[], mediaType: MediaType = 'image'): Photo[] {
  const queryClient = useQueryClient();
  const albumKey = albumIds?.join(',') ?? '';
  const queryKey = ['photos', albumKey, mediaType] as const;
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchPhotos(albumIds, mediaType),
    staleTime: 30_000,
    refetchInterval: FALLBACK_POLL_MS,
  });

  useEffect(() => {
    return subscribeUserTable('photos', () => {
      queryClient.invalidateQueries({ queryKey: ['photos', albumKey] });
    });
  }, [albumKey, queryClient]);

  return data ?? [];
}
