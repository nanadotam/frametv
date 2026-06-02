'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpotifyPlayerInstance {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (data: unknown) => void): boolean;
  removeListener(event: string): boolean;
  activateElement(): void; // must be called within a user gesture before first play
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

export interface SpotifyPlayerState {
  deviceId: string | null;
  isReady: boolean;
  isConnecting: boolean;
  isPremiumRequired: boolean;
  error: string | null;
}

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

let sdkScriptPromise: Promise<void> | null = null;

function loadSdkScript(): Promise<void> {
  if (sdkScriptPromise) return sdkScriptPromise;
  sdkScriptPromise = new Promise((resolve) => {
    if (document.querySelector(`script[src="${SDK_URL}"]`)) {
      if (window.Spotify) { resolve(); return; }
      const prev = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = () => { prev?.(); resolve(); };
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    document.head.appendChild(script);
  });
  return sdkScriptPromise;
}

export function useSpotifyPlayer(): SpotifyPlayerState & {
  playUri: (uri: string) => Promise<void>;
  activate: () => void;
} {
  const [state, setState] = useState<SpotifyPlayerState>({
    deviceId: null,
    isReady: false,
    isConnecting: true,
    isPremiumRequired: false,
    error: null,
  });

  // Refs allow synchronous access inside click handlers (no stale closure)
  const deviceIdRef = useRef<string | null>(null);
  const activateRef = useRef<(() => void) | null>(null);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      const tokenRes = await fetch('/api/spotify/token').catch(() => null);
      if (!tokenRes?.ok) {
        if (mountedRef.current) setState((s) => ({ ...s, isConnecting: false }));
        return;
      }

      try {
        await loadSdkScript();
      } catch {
        if (mountedRef.current) setState((s) => ({ ...s, isConnecting: false, error: 'Failed to load Spotify SDK' }));
        return;
      }

      if (!window.Spotify || !mountedRef.current) return;

      const player = new window.Spotify.Player({
        name: 'FrameTV',
        getOAuthToken: (cb) => {
          fetch('/api/spotify/token')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.token) cb(d.token); });
        },
        volume: 0.8,
      });

      // Store activateElement bound to this player instance
      activateRef.current = () => {
        try { player.activateElement(); } catch {}
      };

      player.addListener('ready', (data) => {
        const { device_id } = data as { device_id: string };
        if (!mountedRef.current) return;
        deviceIdRef.current = device_id;
        setState({ deviceId: device_id, isReady: true, isConnecting: false, isPremiumRequired: false, error: null });
        fetch('/api/spotify/device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id }),
        }).catch(() => {});
      });

      player.addListener('not_ready', () => {
        if (!mountedRef.current) return;
        deviceIdRef.current = null;
        setState((s) => ({ ...s, isReady: false, isConnecting: true, deviceId: null }));
      });

      player.addListener('initialization_error', (e) => {
        const msg = (e as { message?: string }).message ?? 'Initialization error';
        if (mountedRef.current) setState((s) => ({ ...s, isConnecting: false, error: msg }));
      });

      player.addListener('authentication_error', (e) => {
        const msg = (e as { message?: string }).message ?? 'Authentication error';
        if (mountedRef.current) setState((s) => ({ ...s, isConnecting: false, error: msg }));
      });

      player.addListener('account_error', () => {
        if (mountedRef.current) setState((s) => ({ ...s, isConnecting: false, isPremiumRequired: true, error: null }));
      });

      const connected = await player.connect();
      if (!connected && mountedRef.current) {
        setState((s) => ({ ...s, isConnecting: false, error: 'Could not connect to Spotify' }));
      }

      playerRef.current = player;
    }

    init();

    return () => {
      mountedRef.current = false;
      playerRef.current?.disconnect();
      activateRef.current = null;
    };
  }, []);

  // Call this synchronously inside a click handler before any async play call
  const activate = useCallback(() => {
    activateRef.current?.();
  }, []);

  const playUri = useCallback(async (uri: string) => {
    const id = deviceIdRef.current;
    if (!id) throw new Error('Spotify player not ready yet — wait a moment and try again');

    const res = await fetch('/api/spotify/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'play_track', uri, device_id: id }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? `Playback failed (${res.status})`);
    }
  }, []);

  return { ...state, playUri, activate };
}
