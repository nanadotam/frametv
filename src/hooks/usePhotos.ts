'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRealtimeClient } from '@/lib/supabase/realtime';
import { fetchLocalPhotos, LOCAL_ALBUM_ID } from '@/lib/localPhotos';
import type { Photo } from '@/types/db';
import type { RealtimeChannel } from '@supabase/supabase-js';

async function fetchPhotos(albumIds?: string[]): Promise<Photo[]> {
  if (albumIds?.length === 1 && albumIds[0] === LOCAL_ALBUM_ID) {
    return fetchLocalPhotos();
  }
  const params = new URLSearchParams();
  params.set('limit', '1000');
  if (albumIds?.length) params.set('albumIds', albumIds.join(','));
  const res = await fetch(`/api/photos?${params.toString()}`);
  if (!res.ok) throw new Error('Unable to load photos');
  const json = await res.json();
  return (json.photos ?? []) as Photo[];
}

// Supabase dedupes `channel()` calls by topic name and returns the same
// channel instance for a repeat topic. If two usePhotos consumers ever share
// an albumKey at once, calling `.on()` on a channel that's already
// `.subscribe()`d throws. So subscriptions per topic are reference-counted
// here and shared instead.
const channelRegistry = new Map<
  string,
  { channel: RealtimeChannel; refCount: number; listeners: Set<() => void> }
>();

function subscribeToPhotoChanges(albumKey: string, onChange: () => void): () => void {
  const supabase = getRealtimeClient();
  let entry = channelRegistry.get(albumKey);
  if (!entry) {
    const listeners = new Set<() => void>();
    const channel = supabase
      .channel(`photos_changes_${albumKey || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, () => {
        listeners.forEach((cb) => cb());
      })
      .subscribe();
    entry = { channel, refCount: 0, listeners };
    channelRegistry.set(albumKey, entry);
  }
  entry.refCount += 1;
  entry.listeners.add(onChange);

  return () => {
    const current = channelRegistry.get(albumKey);
    if (!current) return;
    current.refCount -= 1;
    current.listeners.delete(onChange);
    if (current.refCount <= 0) {
      supabase.removeChannel(current.channel);
      channelRegistry.delete(albumKey);
    }
  };
}

export function usePhotos(albumIds?: string[]): Photo[] {
  const queryClient = useQueryClient();
  const albumKey = albumIds?.join(',') ?? '';
  const queryKey = ['photos', albumKey] as const;
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchPhotos(albumIds),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    // Local photos never change via Supabase Realtime — there's no `photos`
    // row for this sentinel album id to watch.
    if (albumKey === LOCAL_ALBUM_ID) return;
    return subscribeToPhotoChanges(albumKey, () => {
      queryClient.invalidateQueries({ queryKey: ['photos', albumKey] });
    });
  }, [albumKey, queryClient]);

  return data ?? [];
}
