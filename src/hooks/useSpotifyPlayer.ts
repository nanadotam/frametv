'use client';

import { useEffect, useRef, useState } from 'react';

// Minimal types for the Spotify Web Playback SDK
interface SpotifyPlayerInstance {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (data: unknown) => void): boolean;
  removeListener(event: string): boolean;
}

declare global {
  interface Window {
    Spotify: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifyPlayerState {
  deviceId: string | null;
  isReady: boolean;
  isPremiumRequired: boolean;
}

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

export function useSpotifyPlayer(): SpotifyPlayerState {
  const [state, setState] = useState<SpotifyPlayerState>({
    deviceId: null,
    isReady: false,
    isPremiumRequired: false,
  });
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      // Fetch token — 401 means Spotify not connected, skip SDK
      const res = await fetch('/api/spotify/token').catch(() => null);
      if (!res?.ok) return;

      const initPlayer = () => {
        if (!window.Spotify || !mountedRef.current) return;

        const player = new window.Spotify.Player({
          name: 'FrameTV',
          getOAuthToken: (cb) => {
            fetch('/api/spotify/token')
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => { if (d?.token) cb(d.token); });
          },
          volume: 0.7,
        });

        player.addListener('ready', (data) => {
          const { device_id } = data as { device_id: string };
          if (!mountedRef.current) return;
          setState({ deviceId: device_id, isReady: true, isPremiumRequired: false });
          // Register device ID on server so admin can target it
          fetch('/api/spotify/device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id }),
          }).catch(() => {});
        });

        player.addListener('not_ready', () => {
          if (mountedRef.current) setState((s) => ({ ...s, isReady: false }));
        });

        // Premium required error
        player.addListener('initialization_error', (e) => {
          console.warn('[SpotifySDK] init error', e);
        });
        player.addListener('authentication_error', (e) => {
          console.warn('[SpotifySDK] auth error', e);
        });
        player.addListener('account_error', () => {
          // Non-Premium account
          if (mountedRef.current) setState((s) => ({ ...s, isPremiumRequired: true }));
        });

        player.connect();
        playerRef.current = player;
      };

      // SDK requires onSpotifyWebPlaybackSDKReady to be set before script loads
      window.onSpotifyWebPlaybackSDKReady = initPlayer;

      if (window.Spotify) {
        // Script already loaded (e.g., hot reload)
        initPlayer();
      } else if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
        const script = document.createElement('script');
        script.src = SDK_URL;
        script.async = true;
        document.head.appendChild(script);
      }
    }

    init();

    return () => {
      mountedRef.current = false;
      playerRef.current?.disconnect();
    };
  }, []);

  return state;
}
