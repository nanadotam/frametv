'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import Head from 'next/head';

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
    <>
      {/* Google Fonts for clock overlay */}
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&family=Oswald:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Pacifico&family=Playfair+Display:wght@400;700&family=Dancing+Script:wght@700&family=Bebas+Neue&family=Syne:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="bg-black overflow-hidden w-screen h-screen">
        {children}
      </div>
    </>
  );
}
