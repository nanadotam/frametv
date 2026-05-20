'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDisplayStateRealtime } from '@/hooks/useDisplayStateRealtime';
import { useActiveMode } from '@/hooks/useActiveMode';
import { useModes } from '@/hooks/useModes';
import { useAutoTheme } from '@/hooks/useAutoTheme';
import { useAutoDim } from '@/hooks/useAutoDim';
import { useClockOverlayConfig } from '@/hooks/useClockOverlayConfig';
import { MODES } from '@/modes/index';
import type { ModeId } from '@/modes/types';
import ClockOverlay from '@/components/display/ClockOverlay';
import { Input } from '@/components/ui/input';

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

function DisplayPinGate({ onUnlock }: { onUnlock: () => void }) {
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
      </form>
    </div>
  );
}

function useCinemaMode() {
  const [cinema, setCinema] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const enter = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    setCinema(true);
    showToast('Cinema Mode');
  }, [showToast]);

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setCinema(false);
    showToast('Exiting Cinema Mode');
  }, [showToast]);

  const toggle = useCallback(() => {
    if (cinema) exit(); else enter();
  }, [cinema, enter, exit]);

  // Sync state when the user presses Escape (browser exits fullscreen automatically)
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && cinema) {
        setCinema(false);
        showToast('Exiting Cinema Mode');
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [cinema, showToast]);

  // F key shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return { cinema, toast, toggle };
}

export default function DisplayPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [locked, setLocked] = useState(false);
  const [clockOn, setClockOn] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

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
  const { cinema, toast, toggle: toggleCinema } = useCinemaMode();

  // Sync local toggle with the persisted config on first load
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

  // Dispatch skip events when photo_skip changes in DB
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
    const direction = delta > 0 ? 'next' : 'prev';
    const steps = Math.abs(delta);
    for (let i = 0; i < steps; i++) {
      window.dispatchEvent(new CustomEvent('frametv:skip', { detail: { direction } }));
    }
  }, [displayState?.photo_skip]);

  if (authChecked && locked) {
    return <DisplayPinGate onUnlock={() => { setLocked(false); window.location.reload(); }} />;
  }

  if (!displayState) {
    return (
      <div className="w-screen h-screen bg-black overflow-hidden">
        <LoadingSkeleton />
      </div>
    );
  }

  const modeId = activeMode.modeId as ModeId | null;
  const ModeComponent = modeId && MODES[modeId] ? MODES[modeId] : null;

  const brightness: number = (displayState.brightness as number) ?? 100;
  const isPaused: boolean = (displayState.is_paused as boolean) ?? false;
  // Look up the mode's config from the modes table (keyed by modeId)
  const modeRow = modes.find((m) => m.id === modeId);
  const config: Record<string, unknown> = (modeRow?.config as Record<string, unknown>) ?? {};

  return (
    <div
      className="w-screen h-screen bg-black overflow-hidden relative"
      style={{ cursor: cinema ? 'none' : undefined }}
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

      {/* Clock overlay — shown when toggled on; visible even in cinema mode */}
      <ClockOverlay config={{ ...clockConfig, enabled: clockConfig.enabled && clockOn }} />

      {/* Dim overlay — hidden in cinema mode */}
      {!cinema && dim && (
        <div className="fixed inset-0 bg-black/40 pointer-events-none" />
      )}

      {/* Floating controls — bottom-left, hidden in cinema mode */}
      {!cinema && (
        <div
          style={{
            position: 'fixed',
            bottom: '28px',
            left: '28px',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {/* Clock toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setClockOn((v) => !v); }}
            onDoubleClick={(e) => e.stopPropagation()}
            title={clockOn ? 'Hide clock' : 'Show clock'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 16px',
              borderRadius: '999px',
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: clockOn ? '#fff' : 'rgba(255,255,255,0.35)',
              fontSize: '0.78rem',
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              opacity: 0.35,
              transition: 'opacity 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.35')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {clockOn ? 'Clock on' : 'Clock off'}
          </button>

          {/* Log out of display */}
          <button
            onClick={(e) => { e.stopPropagation(); logoutDisplay(); }}
            onDoubleClick={(e) => e.stopPropagation()}
            disabled={loggingOut}
            title="Log out of display"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 16px',
              borderRadius: '999px',
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: loggingOut ? 'wait' : 'pointer',
              opacity: 0.35,
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.35')}
          >
            {/* Door/exit icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {loggingOut ? 'Logging out…' : 'Log out of display'}
          </button>
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
