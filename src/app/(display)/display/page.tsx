'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDisplayStateRealtime } from '@/hooks/useDisplayStateRealtime';
import { useActiveMode } from '@/hooks/useActiveMode';
import { useModes } from '@/hooks/useModes';
import { useAutoTheme } from '@/hooks/useAutoTheme';
import { useAutoDim } from '@/hooks/useAutoDim';
import { useClockOverlayConfig } from '@/hooks/useClockOverlayConfig';
import { useSpotifyNowPlaying } from '@/hooks/useSpotifyNowPlaying';
import { MODES } from '@/modes/index';
import type { ModeId } from '@/modes/types';
import type { SpotifyTrack } from '@/lib/spotify/now-playing';
import ClockOverlay from '@/components/display/ClockOverlay';
import SpotifyOverlay from '@/components/display/SpotifyOverlay';
import PairingGate from '@/components/display/PairingGate';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { Input } from '@/components/ui/input';
import { Maximize2, Minimize2, Search, X, Play, Loader2 } from 'lucide-react';

// ─── Spotify modes ────────────────────────────────────────────────────────────

// Modes where Spotify controls (play on TV, search) are shown
const SPOTIFY_MODES = new Set([
  'slideshow-single', 'slideshow-grid', 'pinterest',
  'vinyl', 'coverflow',
]);

// Modes where the corner now-playing overlay is shown
// (vinyl/coverflow are already full music displays — no overlay needed)
const SPOTIFY_OVERLAY_MODES = new Set([
  'slideshow-single', 'slideshow-grid', 'pinterest',
]);

// ─── Fullscreen helpers ───────────────────────────────────────────────────────

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

function getFullscreenElement() {
  const doc = document as FullscreenDocument;
  return document.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement || null;
}

function isFullscreenSupported() {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as FullscreenElement;
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
}

function requestFullscreen() {
  const el = document.documentElement as FullscreenElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  return Promise.resolve(request?.call(el));
}

function exitFullscreen() {
  const doc = document as FullscreenDocument;
  const exit = document.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
  return Promise.resolve(exit?.call(document));
}

// ─── Loading / PIN gate ───────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon.svg"
        alt="FrameTV"
        style={{ width: 96, height: 96, opacity: 0.18, animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
      />
    </div>
  );
}

function DisplayPinGate({ onUnlock, onUsePairing }: { onUnlock: () => void; onUsePairing: () => void }) {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername, pin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to unlock display.');
      onUnlock();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to unlock display.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen bg-black text-white flex items-center justify-center px-8">
      <form onSubmit={submit} className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center text-4xl">📺</div>
          <h1 className="text-5xl font-bold tracking-tight">FrameTV</h1>
          <p className="text-xl text-white/50">Enter your username and display PIN</p>
        </div>

        <div className="space-y-4">
          <Input
            className="bg-white/10 border-white/15 text-white placeholder:text-white/35 h-16 text-2xl px-6 rounded-2xl focus:border-white/40"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            placeholder="Username or email"
            autoComplete="off"
            required
          />
          <Input
            className="bg-white/10 border-white/15 text-white text-center tracking-[0.6em] text-4xl placeholder:text-white/25 h-20 rounded-2xl focus:border-white/40"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="——————"
            required
          />
        </div>

        {error && (
          <p className="text-lg text-red-300 text-center font-medium">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            height: '72px',
            borderRadius: '16px',
            background: loading
              ? 'rgba(255,255,255,0.15)'
              : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
            border: 'none',
            color: '#fff',
            fontSize: '1.5rem',
            fontWeight: 700,
            letterSpacing: '0.03em',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s ease, transform 0.1s ease',
            boxShadow: loading ? 'none' : '0 8px 32px rgba(139,92,246,0.4)',
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = 'scale(1.02)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {loading ? 'Unlocking…' : '▶  View Display'}
        </button>

        <button
          type="button"
          onClick={onUsePairing}
          className="block w-full text-center text-sm font-medium uppercase tracking-[0.1em] text-white/45 hover:text-white transition-colors"
        >
          Pair with a code instead
        </button>
      </form>
    </div>
  );
}

// ─── Cinema mode ──────────────────────────────────────────────────────────────

function useCinemaMode() {
  const [cinema, setCinema] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const enter = useCallback(() => {
    if (!isFullscreenSupported()) {
      setSupported(false);
      showToast('Use your TV browser menu to enter fullscreen');
      return;
    }
    requestFullscreen().catch(() => {
      showToast('Use your TV browser menu to enter fullscreen');
    });
    setCinema(true);
    showToast('Cinema Mode');
  }, [showToast]);

  const exit = useCallback(() => {
    if (getFullscreenElement()) exitFullscreen().catch(() => {});
    setCinema(false);
    showToast('Exiting Cinema Mode');
  }, [showToast]);

  const toggle = useCallback(() => {
    if (cinema) exit(); else enter();
  }, [cinema, enter, exit]);

  useEffect(() => {
    setSupported(isFullscreenSupported());
    const onFsChange = () => {
      if (!getFullscreenElement() && cinema) {
        setCinema(false);
        showToast('Exiting Cinema Mode');
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('MSFullscreenChange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('MSFullscreenChange', onFsChange);
    };
  }, [cinema, showToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return { cinema, toast, toggle, enter, supported };
}

// ─── Fullscreen prompt ────────────────────────────────────────────────────────

function useFullscreenPrompt(enabled: boolean) {
  const storageKey = 'frametv:display-fullscreen-prompt-dismissed';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch {
      // Keep the prompt visible if storage is unavailable.
    }
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      try { localStorage.setItem(storageKey, '1'); } catch {}
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(storageKey, '1'); } catch {}
  }, []);

  return { visible, dismiss };
}

// ─── Device heartbeat ─────────────────────────────────────────────────────────

function getDisplayClientId() {
  const key = 'frametv:display-device-id';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, next);
    return next;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function useDisplayDeviceHeartbeat(activeModeId: string | null, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const send = () => {
      fetch('/api/display-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: getDisplayClientId(),
          route: '/display',
          renderer: 'react',
          active_mode_id: activeModeId,
          viewport_width: window.innerWidth,
          viewport_height: window.innerHeight,
          screen_width: window.screen?.width,
          screen_height: window.screen?.height,
          device_pixel_ratio: window.devicePixelRatio,
          fullscreen_supported: Boolean(document.documentElement.requestFullscreen),
          fullscreen_active: Boolean(document.fullscreenElement),
          visibility_state: document.visibilityState,
        }),
      }).catch(() => {});
    };
    const sendAfterResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(send, 500);
    };

    send();
    const interval = window.setInterval(send, 30_000);
    document.addEventListener('fullscreenchange', send);
    document.addEventListener('visibilitychange', send);
    window.addEventListener('resize', sendAfterResize);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.clearInterval(interval);
      document.removeEventListener('fullscreenchange', send);
      document.removeEventListener('visibilitychange', send);
      window.removeEventListener('resize', sendAfterResize);
    };
  }, [activeModeId, enabled]);
}

// ─── Spotify search panel ─────────────────────────────────────────────────────

function SpotifySearchPanel({
  onClose,
  onPlay,
}: {
  onClose: () => void;
  onPlay: (uri: string, name: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults((await res.json()).tracks ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handlePlay = async (track: SpotifyTrack) => {
    setPlayingUri(track.uri);
    await onPlay(track.uri, track.name);
    setPlayingUri(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 88,
        left: 28,
        width: 360,
        maxHeight: 320,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.12)',
        overflow: 'hidden',
        zIndex: 61,
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* Search input row */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <Search size={14} color="rgba(255,255,255,0.45)" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Spotify…"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        />
        {searching && <Loader2 size={13} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />}
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            color: 'rgba(255,255,255,0.4)',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Results */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {results.map((track) => (
          <button
            key={track.id}
            onClick={() => handlePlay(track)}
            disabled={playingUri !== null}
            style={{
              width: '100%',
              padding: '9px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'transparent',
              border: 'none',
              cursor: playingUri ? 'wait' : 'pointer',
              color: '#fff',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ position: 'relative', flexShrink: 0, width: 36, height: 36, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
              {track.albumArtUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={track.albumArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
              {playingUri === track.uri && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={14} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.name}</p>
              <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artists.join(', ')}</p>
            </div>
            <Play size={13} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />
          </button>
        ))}

        {!searching && query.trim() && results.length === 0 && (
          <p style={{ padding: '18px 14px', color: 'rgba(255,255,255,0.38)', fontSize: '0.82rem', textAlign: 'center', margin: 0 }}>
            No results for &ldquo;{query}&rdquo;
          </p>
        )}

        {!query && (
          <p style={{ padding: '18px 14px', color: 'rgba(255,255,255,0.38)', fontSize: '0.82rem', textAlign: 'center', margin: 0 }}>
            Type to search Spotify
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Button base style ────────────────────────────────────────────────────────

const BTN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  padding: '7px 14px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: '0.75rem',
  fontWeight: 500,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  opacity: 1,
  transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
};

function resetBtn(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
  e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DisplayPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [locked, setLocked] = useState(false);
  const [usePinGate, setUsePinGate] = useState(false);
  const [clockOn, setClockOn] = useState(true);
  const [spotifyOn, setSpotifyOn] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const logoutDisplay = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/display-logout', { method: 'POST' });
    } finally {
      setLoggingOut(false);
      setLocked(true);
    }
  }, []);

  const displayState = useDisplayStateRealtime();
  const activeMode = useActiveMode();
  const modes = useModes();
  const theme = useAutoTheme();
  const dim = useAutoDim();
  const clockConfig = useClockOverlayConfig();
  const { cinema, toast, toggle: toggleCinema, enter: enterCinema, supported: fullscreenSupported } = useCinemaMode();
  const fullscreenPrompt = useFullscreenPrompt(authChecked && !locked);
  const { deviceId, isReady: spotifyReady, isConnecting: spotifyConnecting, isPremiumRequired, error: spotifyError, playUri, activate: activateSpotify } = useSpotifyPlayer();

  // Unlock Web Audio on any first tap — required for autoplay policy on TVs/Xbox
  const handlePageInteraction = useCallback(() => {
    if (audioUnlocked) return;
    activateSpotify();
    // Also directly resume any suspended AudioContext
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        setTimeout(() => ctx.close().catch(() => {}), 500);
      }
    } catch {}
    setAudioUnlocked(true);
  }, [audioUnlocked, activateSpotify]);
  const spotifyNow = useSpotifyNowPlaying();

  useEffect(() => {
    setClockOn(clockConfig.enabled);
  }, [clockConfig.enabled]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        setLocked(!res.ok);
        setAuthChecked(true);
      })
      .catch(() => {
        setLocked(true);
        setAuthChecked(true);
      });
  }, []);

  const prevSkipRef = useRef<number | null>(null);
  useEffect(() => {
    const skip = displayState?.photo_skip ?? 0;
    if (prevSkipRef.current === null) {
      prevSkipRef.current = skip;
      return;
    }
    const delta = skip - prevSkipRef.current;
    prevSkipRef.current = skip;
    if (delta === 0) return;
    if (Math.abs(delta) >= 1000) {
      window.dispatchEvent(new CustomEvent('frametv:reshuffle'));
      return;
    }
    const direction = delta > 0 ? 'next' : 'prev';
    const steps = Math.abs(delta);
    for (let i = 0; i < steps; i++) {
      window.dispatchEvent(new CustomEvent('frametv:skip', { detail: { direction } }));
    }
  }, [displayState?.photo_skip]);

  const modeId = activeMode.modeId as ModeId | null;
  useDisplayDeviceHeartbeat(modeId, authChecked && !locked);

  // Transfer current Spotify session here, or play last known track.
  // activate() MUST be called synchronously before any await — it needs the user gesture context.
  const handlePlayOnTV = useCallback(async () => {
    if (transferring) return;
    activateSpotify(); // unlock AudioContext within the click gesture
    setTransferring(true);
    try {
      if (spotifyNow.isPlaying) {
        await fetch('/api/spotify/player', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'transfer', ...(deviceId ? { device_id: deviceId } : {}) }),
        });
      } else if (spotifyNow.current?.uri) {
        await playUri(spotifyNow.current.uri);
      }
    } catch {
      // Silently fail on display page
    } finally {
      setTransferring(false);
    }
  }, [deviceId, transferring, spotifyNow.isPlaying, spotifyNow.current, playUri, activateSpotify]);

  // Play a searched track in this browser — activate() first for AudioContext
  const handlePlayTrack = useCallback(async (uri: string, _name: string) => {
    activateSpotify();
    await playUri(uri);
  }, [playUri, activateSpotify]);

  if (authChecked && locked) {
    const onUnlock = () => { setLocked(false); window.location.reload(); };
    return usePinGate
      ? <DisplayPinGate onUnlock={onUnlock} onUsePairing={() => setUsePinGate(false)} />
      : <PairingGate onUnlock={onUnlock} onUsePin={() => setUsePinGate(true)} />;
  }

  if (!displayState) {
    return (
      <div className="w-screen h-screen bg-black overflow-hidden">
        <LoadingSkeleton />
      </div>
    );
  }

  const ModeComponent = modeId && MODES[modeId] ? MODES[modeId] : null;
  const brightness: number = (displayState.brightness as number) ?? 100;
  const isPaused: boolean = (displayState.is_paused as boolean) ?? false;
  const modeRow = modes.find((m) => m.id === modeId);
  const config: Record<string, unknown> = (modeRow?.config as Record<string, unknown>) ?? {};

  const isSpotifyMode = Boolean(modeId && SPOTIFY_MODES.has(modeId));
  const hasSpotifyTrack = Boolean(spotifyNow.current);
  const showPlayOnTV = spotifyOn && isSpotifyMode && hasSpotifyTrack;
  const playOnTVLabel = spotifyNow.isPlaying
    ? (transferring ? 'Sending…' : 'Play here')
    : (hasSpotifyTrack ? 'Play last' : null);

  return (
    <div
      className="w-screen h-screen bg-black overflow-hidden relative"
      style={{ cursor: cinema ? 'none' : undefined }}
      onClick={handlePageInteraction}
      onDoubleClick={toggleCinema}
    >
      {ModeComponent ? (
        <ModeComponent
          config={config}
          theme={theme}
          brightness={brightness}
          isPaused={isPaused}
          albumIds={activeMode.albumIds}
        />
      ) : (
        <LoadingSkeleton />
      )}

      <ClockOverlay config={{ ...clockConfig, enabled: clockConfig.enabled && clockOn }} />

      {spotifyOn && modeId && SPOTIFY_OVERLAY_MODES.has(modeId) && (
        <SpotifyOverlay
          clockPosition={clockConfig.position}
          current={spotifyNow.current}
          queue={spotifyNow.queue}
          history={spotifyNow.history}
          isPlaying={spotifyNow.isPlaying}
          onPlayPause={() => {
            activateSpotify(); // within user gesture
            fetch('/api/spotify/player', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: spotifyNow.isPlaying ? 'pause' : 'play',
                ...(deviceId ? { device_id: deviceId } : {}),
              }),
            }).catch(() => {});
          }}
          onNext={() => {
            activateSpotify(); // within user gesture
            fetch('/api/spotify/player', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'next',
                ...(deviceId ? { device_id: deviceId } : {}),
              }),
            }).catch(() => {});
          }}
        />
      )}

      {!cinema && dim && (
        <div className="fixed inset-0 bg-black/40 pointer-events-none" />
      )}

      {!cinema && fullscreenPrompt.visible && (
        <div
          className="fixed inset-0 z-[90] pointer-events-none flex items-center justify-center p-8"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div
            className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-black/65 p-5 text-center text-white shadow-2xl backdrop-blur-xl"
            style={{ WebkitBackdropFilter: 'blur(20px)' }}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <Maximize2 size={22} />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Enter fullscreen</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              This display looks best without the browser frame.
            </p>
            {fullscreenSupported ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fullscreenPrompt.dismiss();
                  enterCinema();
                }}
                className="mt-5 h-12 w-full rounded-xl bg-white text-sm font-bold uppercase tracking-[0.08em] text-black transition-transform active:translate-y-px"
              >
                Enter fullscreen
              </button>
            ) : (
              <p className="mt-5 rounded-xl bg-white/10 px-4 py-3 text-sm text-white/70">
                Fullscreen is not exposed by this browser. Use the TV browser menu if it has a fullscreen option.
              </p>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fullscreenPrompt.dismiss();
              }}
              className="mt-3 text-xs font-medium uppercase tracking-[0.1em] text-white/45 hover:text-white"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Spotify search panel — above the controls bar */}
      {searchOpen && isSpotifyMode && (
        <SpotifySearchPanel
          onClose={() => setSearchOpen(false)}
          onPlay={handlePlayTrack}
        />
      )}

      {/* Bottom scrim — gradient starts exactly at the screen edge */}
      {!cinema && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 120,
            background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)',
            zIndex: 58,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Floating controls */}
      {!cinema && (
        <div
          style={{
            position: 'fixed',
            bottom: '22px',
            left: '24px',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {/* Fullscreen */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleCinema(); }}
            onDoubleClick={(e) => e.stopPropagation()}
            title={cinema ? 'Exit fullscreen' : 'Enter fullscreen'}
            style={BTN}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(124,58,237,0.22)';
              e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)';
            }}
            onMouseLeave={resetBtn}
          >
            {cinema ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {cinema ? 'Exit full' : 'Fullscreen'}
          </button>

          {/* Clock */}
          <button
            onClick={(e) => { e.stopPropagation(); setClockOn((v) => !v); }}
            onDoubleClick={(e) => e.stopPropagation()}
            title={clockOn ? 'Hide clock' : 'Show clock'}
            style={{
              ...BTN,
              color: clockOn ? '#fff' : 'rgba(255,255,255,0.35)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(14,165,233,0.18)';
              e.currentTarget.style.borderColor = 'rgba(14,165,233,0.5)';
            }}
            onMouseLeave={resetBtn}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {clockOn ? 'Clock on' : 'Clock off'}
          </button>

          {/* Music toggle — only on Spotify modes */}
          {isSpotifyMode && (
            <button
              onClick={(e) => { e.stopPropagation(); setSpotifyOn((v) => !v); if (searchOpen) setSearchOpen(false); }}
              onDoubleClick={(e) => e.stopPropagation()}
              title={
                isPremiumRequired ? 'Spotify Premium required for browser playback'
                : spotifyReady ? 'Player ready — music will play in this browser'
                : spotifyConnecting ? 'Connecting to Spotify player…'
                : spotifyOn ? 'Hide music overlay' : 'Show music overlay'
              }
              style={{ ...BTN, color: spotifyOn ? '#fff' : 'rgba(255,255,255,0.35)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(29,185,84,0.18)';
                e.currentTarget.style.borderColor = 'rgba(29,185,84,0.5)';
              }}
              onMouseLeave={resetBtn}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              {spotifyOn ? 'Music on' : 'Music off'}
              {/* SDK status dot */}
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                flexShrink: 0,
                background: isPremiumRequired ? '#eab308'
                  : spotifyReady ? '#1db954'
                  : spotifyConnecting ? 'rgba(255,255,255,0.3)'
                  : 'rgba(255,100,100,0.7)',
              }} />
            </button>
          )}

          {/* Play on TV / Play last */}
          {showPlayOnTV && playOnTVLabel && (
            <button
              onClick={(e) => { e.stopPropagation(); handlePlayOnTV(); }}
              onDoubleClick={(e) => e.stopPropagation()}
              disabled={transferring}
              title="Play on this TV"
              style={{
                ...BTN,
                color: '#1db954',
                borderColor: 'rgba(29,185,84,0.25)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(29,185,84,0.22)';
                e.currentTarget.style.borderColor = 'rgba(29,185,84,0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.borderColor = 'rgba(29,185,84,0.25)';
              }}
            >
              {transferring
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Play size={14} fill="currentColor" />}
              {playOnTVLabel}
            </button>
          )}

          {/* Search — only when music is on */}
          {spotifyOn && isSpotifyMode && (
            <button
              onClick={(e) => { e.stopPropagation(); setSearchOpen((v) => !v); }}
              onDoubleClick={(e) => e.stopPropagation()}
              title="Search Spotify"
              style={{
                ...BTN,
                padding: '7px 12px',
                color: searchOpen ? '#fff' : undefined,
                background: searchOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                borderColor: searchOpen ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.14)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = searchOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
                e.currentTarget.style.borderColor = searchOpen ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.14)';
              }}
            >
              {searchOpen ? <X size={14} /> : <Search size={14} />}
            </button>
          )}

          {/* Log out */}
          <button
            onClick={(e) => { e.stopPropagation(); logoutDisplay(); }}
            onDoubleClick={(e) => e.stopPropagation()}
            disabled={loggingOut}
            title="Log out of display"
            style={{ ...BTN, cursor: loggingOut ? 'wait' : 'pointer' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(220,38,38,0.2)';
              e.currentTarget.style.borderColor = 'rgba(220,38,38,0.55)';
              e.currentTarget.style.color = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      )}

      {/* Spotify SDK debug strip — visible on Spotify modes so you can diagnose from the TV */}
      {!cinema && isSpotifyMode && (
        <div style={{
          position: 'fixed',
          bottom: 8,
          right: 12,
          zIndex: 55,
          fontSize: '0.6rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: spotifyError || isPremiumRequired
            ? 'rgba(239,68,68,0.7)'
            : spotifyReady
            ? 'rgba(29,185,84,0.6)'
            : 'rgba(255,255,255,0.25)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          {isPremiumRequired ? '⚠ Spotify Premium required'
            : spotifyError ? `⚠ SDK: ${spotifyError}`
            : spotifyReady ? `● Spotify ready · ${deviceId?.slice(0, 8)}`
            : spotifyConnecting ? '○ Spotify connecting…'
            : '○ Spotify not connected'}
        </div>
      )}

      {/* Cinema mode toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-x-0 top-8 flex justify-center pointer-events-none z-[999]"
          >
            <div
              style={{
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '999px',
                color: '#fff',
                fontSize: '0.9rem',
                letterSpacing: '0.08em',
                padding: '10px 24px',
                fontWeight: 500,
                textTransform: 'uppercase',
              }}
            >
              {cinema ? '⬛  Cinema Mode  —  Double-click or F to exit' : toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
