'use client';

/**
 * Polling budget for always-on screens.
 *
 * Live updates arrive over the Supabase broadcast channel (userChannel.ts),
 * so polls are only a safety net for broadcasts missed while the socket was
 * reconnecting. Every poll is a billed function invocation, and a display
 * runs 24/7 — keep these slow.
 */
export const FALLBACK_POLL_MS = 10 * 60_000;

/** How often a screen reports itself to /api/display-devices. */
export const HEARTBEAT_MS = 5 * 60_000;

/** A screen counts as live if it checked in within this window. */
export const LIVE_WINDOW_MS = HEARTBEAT_MS + 60_000;

export function isPageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/**
 * setInterval that skips ticks while the page is hidden, and runs once as
 * soon as it becomes visible again so the screen catches up immediately.
 * Returns a cleanup function.
 */
export function visibleInterval(fn: () => void, ms: number): () => void {
  const id = window.setInterval(() => {
    if (isPageVisible()) fn();
  }, ms);
  const onVisibilityChange = () => {
    if (isPageVisible()) fn();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    window.clearInterval(id);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
