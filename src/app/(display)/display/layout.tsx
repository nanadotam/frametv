'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  Poppins,
  Oswald,
  JetBrains_Mono,
  Pacifico,
  Playfair_Display,
  Dancing_Script,
  Bebas_Neue,
  Syne,
} from 'next/font/google';

// All clock overlay fonts downloaded at build time and self-hosted.
// This replaces the Google Fonts CDN <link> tag which was unreliable in Safari,
// blocked on some networks, and used the deprecated next/head API.
const poppins       = Poppins({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-clock-poppins',   display: 'swap', preload: false });
const oswald        = Oswald({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-clock-oswald',    display: 'swap', preload: false });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-clock-jetbrains', display: 'swap', preload: false });
const pacifico      = Pacifico({ subsets: ['latin'], weight: ['400'],        variable: '--font-clock-pacifico',  display: 'swap', preload: false });
const playfair      = Playfair_Display({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-clock-playfair',  display: 'swap', preload: false });
const dancing       = Dancing_Script({ subsets: ['latin'], weight: ['700'],        variable: '--font-clock-dancing',   display: 'swap', preload: false });
const bebasNeue     = Bebas_Neue({ subsets: ['latin'], weight: ['400'],        variable: '--font-clock-bebas',     display: 'swap', preload: false });
const syne          = Syne({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-clock-syne',       display: 'swap', preload: false });

// All variable class names joined — applied to the wrapper so every descendant
// (ClockOverlay, mode components) can reference these CSS custom properties.
const clockFontVars = [
  poppins.variable,
  oswald.variable,
  jetbrainsMono.variable,
  pacifico.variable,
  playfair.variable,
  dancing.variable,
  bebasNeue.variable,
  syne.variable,
].join(' ');

export default function DisplayLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Request WakeLock to prevent screen from dimming
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

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') acquireWakeLock();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wakeLock?.release().catch(() => {});
    };
  }, []);

  return (
    <div className={`bg-black overflow-hidden w-screen h-screen ${clockFontVars}`}>
      {children}
    </div>
  );
}
