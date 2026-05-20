'use client';

import { useEffect, useState } from 'react';
import { getRealtimeClient } from '@/lib/supabase/realtime';
import type { Mode } from '@/types/db';

// Module-level state shared across all instances (like a mini-store)
let cache: Mode[] | null = null;
const listeners: Set<(modes: Mode[]) => void> = new Set();
let realtimeSubscribed = false;
let browserSyncStarted = false;

function notify(modes: Mode[]) {
  cache = modes;
  listeners.forEach((fn) => fn(modes));
}

async function fetchModes() {
  const res = await fetch('/api/modes');
  if (!res.ok) return;
  const json = await res.json();
  notify(Array.isArray(json) ? json : (json.modes ?? []));
}

function subscribeRealtime() {
  if (realtimeSubscribed) return;
  realtimeSubscribed = true;

  const supabase = getRealtimeClient();
  supabase
    .channel('modes_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'modes' }, () => {
      // Any change to any mode row → re-fetch the full list
      fetchModes();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_modes' }, () => {
      fetchModes();
    })
    .subscribe();
}

function subscribeBrowserSync() {
  if (browserSyncStarted || typeof window === 'undefined') return;
  browserSyncStarted = true;

  const refetch = () => fetchModes();
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') refetch();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === 'frametv:modes-invalidated') refetch();
  };

  window.addEventListener('focus', refetch);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('storage', onStorage);
  setInterval(refetch, 5_000);

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('frametv:modes');
    channel.addEventListener('message', refetch);
  }
}

export function useModes(): Mode[] {
  const [modes, setModes] = useState<Mode[]>(cache ?? []);

  useEffect(() => {
    listeners.add(setModes);

    if (!cache) fetchModes();

    // Start realtime subscription once globally
    subscribeRealtime();
    subscribeBrowserSync();

    return () => { listeners.delete(setModes); };
  }, []);

  return modes;
}

/** Call this after saving a mode config to eagerly refresh the cache. */
export function invalidateModes() {
  fetchModes();
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('frametv:modes-invalidated', String(Date.now()));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('frametv:modes');
    channel.postMessage('invalidate');
    channel.close();
  }
}
