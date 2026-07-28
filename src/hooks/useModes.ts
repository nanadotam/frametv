'use client';

import { useEffect, useState } from 'react';
import { subscribeModesChanges } from '@/lib/supabase/displayRealtimeChannel';
import type { Mode } from '@/types/db';

// Module-level state shared across all instances (like a mini-store)
let cache: Mode[] | null = null;
const listeners: Set<(modes: Mode[]) => void> = new Set();
let realtimeSubscribed = false;
let browserSyncStarted = false;
let inflight: Promise<void> | null = null;

function notify(modes: Mode[]) {
  cache = modes;
  listeners.forEach((fn) => fn(modes));
}

async function fetchModes() {
  if (inflight) return inflight;
  inflight = fetchModesInner().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function fetchModesInner() {
  const res = await fetch('/api/modes');
  if (!res.ok) return;
  const json = await res.json();
  notify(Array.isArray(json) ? json : (json.modes ?? []));
}

function subscribeRealtime() {
  if (realtimeSubscribed) return;
  realtimeSubscribed = true;

  // Any change to modes/user_modes → re-fetch the full list.
  subscribeModesChanges(() => fetchModes());
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
  setInterval(refetch, 60_000);

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('frametv:modes');
    channel.addEventListener('message', refetch);
  }
}

/**
 * Primes the module-level cache with server-fetched modes so the first
 * render already has data and `useModes()` skips its initial client fetch.
 * Call from the component body (not an effect) so it runs before the
 * `useState(cache ?? [])` below. No-ops if the cache is already populated.
 */
export function primeModesCache(modes: Mode[]) {
  if (cache) return;
  cache = modes;
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
