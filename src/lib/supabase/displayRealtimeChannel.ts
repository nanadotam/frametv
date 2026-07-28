'use client';

import { getRealtimeClient } from './realtime';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Single shared Realtime channel for the /display route, multiplexing
 * display_state + modes/user_modes postgres_changes over one subscription
 * instead of two independent channels (useDisplayStateRealtime,
 * useModes previously each opened their own).
 */

type DisplayStateListener = (row: Record<string, unknown>) => void;
type ModesListener = () => void;

const displayStateListeners = new Set<DisplayStateListener>();
const modesListeners = new Set<ModesListener>();
let channel: RealtimeChannel | null = null;

function ensureChannel(): RealtimeChannel {
  if (channel) return channel;

  const supabase = getRealtimeClient();
  channel = supabase
    .channel('display_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'display_state' },
      (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          displayStateListeners.forEach((fn) => fn(payload.new as Record<string, unknown>));
        }
      }
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'modes' }, () => {
      modesListeners.forEach((fn) => fn());
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_modes' }, () => {
      modesListeners.forEach((fn) => fn());
    })
    .subscribe();

  return channel;
}

/** Returns an unsubscribe function. */
export function subscribeDisplayState(listener: DisplayStateListener): () => void {
  ensureChannel();
  displayStateListeners.add(listener);
  return () => displayStateListeners.delete(listener);
}

/** Returns an unsubscribe function. */
export function subscribeModesChanges(listener: ModesListener): () => void {
  ensureChannel();
  modesListeners.add(listener);
  return () => modesListeners.delete(listener);
}
