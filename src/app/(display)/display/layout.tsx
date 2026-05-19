'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

export default function DisplayLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed silently
      });
    }

    // Request WakeLock
    let wakeLock: WakeLockSentinel | null = null;

    async function acquireWakeLock() {
      if (!('wakeLock' in navigator)) return;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch {
        // WakeLock not granted — continue without it
      }
    }

    acquireWakeLock();

    // Re-acquire on visibility change
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wakeLock?.release().catch(() => {});
    };
  }, []);

  return (
    <html lang="en" className="bg-black overflow-hidden">
      <body className="bg-black overflow-hidden w-screen h-screen">
        {children}
      </body>
    </html>
  );
}
