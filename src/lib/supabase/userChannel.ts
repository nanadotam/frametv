'use client';

import { getRealtimeClient } from './realtime';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * One Broadcast channel per signed-in user, multiplexing every live-update
 * the browser listens for. Database triggers (migration 018) send each
 * changed row to `u:<realtime_key>`; the key is per-user and unguessable,
 * and only handed out by /api/realtime/topic to that user's own sessions.
 *
 * Replaces the old postgres_changes subscriptions, which needed the tables
 * to be readable by the public key.
 */

export type UserTable =
  | 'display_state'
  | 'user_modes'
  | 'reminders'
  | 'flipboard_messages'
  | 'photos'
  | 'schedules'
  | 'settings'
  | 'albums';

type Listener = (row: Record<string, unknown>, op: 'INSERT' | 'UPDATE' | 'DELETE') => void;

const listeners = new Map<UserTable, Set<Listener>>();
let channel: RealtimeChannel | null = null;
let connecting: Promise<void> | null = null;

async function connect() {
  const res = await fetch('/api/realtime/topic', { cache: 'no-store' }).catch(() => null);
  if (!res?.ok) return;
  const { topic } = (await res.json()) as { topic: string | null };
  if (!topic) return;

  channel = getRealtimeClient()
    .channel(topic)
    .on('broadcast', { event: '*' }, ({ event, payload }) => {
      const set = listeners.get(event as UserTable);
      if (!set || !payload) return;
      const { row, op } = payload as { row: Record<string, unknown>; op: 'INSERT' | 'UPDATE' | 'DELETE' };
      set.forEach((fn) => fn(row, op));
    })
    .subscribe();
}

function ensureChannel() {
  if (!channel && !connecting) {
    connecting = connect().finally(() => {
      connecting = null;
    });
  }
}

/** Returns an unsubscribe function. */
export function subscribeUserTable(table: UserTable, listener: Listener): () => void {
  ensureChannel();
  let set = listeners.get(table);
  if (!set) {
    set = new Set();
    listeners.set(table, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}
