'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
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
import { Button } from '@/components/ui/button';

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
  const [deviceName, setDeviceName] = useState('');
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
        body: JSON.stringify({ emailOrUsername, pin, device_name: deviceName }),
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
    <div className="w-screen h-screen bg-black text-white flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">📺</div>
          <h1 className="text-2xl font-semibold">Unlock FrameTV</h1>
          <p className="text-sm text-white/60">Enter your account and six-digit display PIN.</p>
        </div>
        <Input
          className="bg-white/10 border-white/15 text-white placeholder:text-white/35"
          value={emailOrUsername}
          onChange={(e) => setEmailOrUsername(e.target.value)}
          placeholder="Email or username"
          required
        />
        <Input
          className="bg-white/10 border-white/15 text-white text-center tracking-[0.5em] text-xl placeholder:text-white/35"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          required
        />
        <Input
          className="bg-white/10 border-white/15 text-white placeholder:text-white/35"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="Device name, e.g. Living room TV"
        />
        {error && <p className="text-sm text-red-300 text-center">{error}</p>}
        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? 'Unlocking…' : 'Unlock display'}
        </Button>
      </form>
    </div>
  );
}

export default function DisplayPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [locked, setLocked] = useState(false);
  const displayState = useDisplayStateRealtime();
  const activeMode = useActiveMode();
  const modes = useModes();
  const theme = useAutoTheme();
  const dim = useAutoDim();
  const clockConfig = useClockOverlayConfig();

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
    <div className="w-screen h-screen bg-black overflow-hidden relative">
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

      {/* Clock overlay */}
      <ClockOverlay config={clockConfig} />

      {/* Dim overlay */}
      {dim && (
        <div className="fixed inset-0 bg-black/40 pointer-events-none" />
      )}
    </div>
  );
}
