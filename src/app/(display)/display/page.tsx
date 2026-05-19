'use client';

import { useEffect, useRef } from 'react';
import { useDisplayStateRealtime } from '@/hooks/useDisplayStateRealtime';
import { useActiveMode } from '@/hooks/useActiveMode';
import { useAutoTheme } from '@/hooks/useAutoTheme';
import { useAutoDim } from '@/hooks/useAutoDim';
import { useClockOverlayConfig } from '@/hooks/useClockOverlayConfig';
import { MODES } from '@/modes/index';
import type { ModeId } from '@/modes/types';
import ClockOverlay from '@/components/display/ClockOverlay';

function LoadingSkeleton() {
  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-white/10 animate-pulse" />
        <div className="w-32 h-3 rounded bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}

export default function DisplayPage() {
  const displayState = useDisplayStateRealtime();
  const activeMode = useActiveMode();
  const theme = useAutoTheme();
  const dim = useAutoDim();
  const clockConfig = useClockOverlayConfig();

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
  const config: Record<string, unknown> = (activeMode as { config?: Record<string, unknown> }).config ?? {};

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      {ModeComponent ? (
        <ModeComponent
          config={config}
          theme={theme}
          brightness={brightness}
          isPaused={isPaused}
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
