'use client';

import { useEffect, useRef } from 'react';
import { useDisplayStateRealtime } from '@/hooks/useDisplayStateRealtime';
import { useActiveMode } from '@/hooks/useActiveMode';
import { useModes } from '@/hooks/useModes';
import { useAutoTheme } from '@/hooks/useAutoTheme';
import { useAutoDim } from '@/hooks/useAutoDim';
import { useClockOverlayConfig } from '@/hooks/useClockOverlayConfig';
import { MODES } from '@/modes/index';
import type { ModeId } from '@/modes/types';
import ClockOverlay from '@/components/display/ClockOverlay';

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

export default function DisplayPage() {
  const displayState = useDisplayStateRealtime();
  const activeMode = useActiveMode();
  const modes = useModes();
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
