'use client';

import { subscribeUserTable } from './userChannel';

/**
 * Display-route live updates: display_state rows and mode changes, both
 * carried on the signed-in user's private Broadcast channel.
 */

/** Returns an unsubscribe function. */
export function subscribeDisplayState(listener: (row: Record<string, unknown>) => void): () => void {
  return subscribeUserTable('display_state', (row, op) => {
    if (op !== 'DELETE' && Object.keys(row).length > 0) listener(row);
  });
}

/** Returns an unsubscribe function. */
export function subscribeModesChanges(listener: () => void): () => void {
  return subscribeUserTable('user_modes', () => listener());
}
