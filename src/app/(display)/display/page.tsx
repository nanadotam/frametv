'use client';

import { useDisplayStateRealtime } from '@/hooks/useDisplayStateRealtime';
import { useActiveMode } from '@/hooks/useActiveMode';
import { useAutoTheme } from '@/hooks/useAutoTheme';
import { useAutoDim } from '@/hooks/useAutoDim';
import { MODES } from '@/modes/index';
import type { ModeId } from '@/modes/types';

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

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      {ModeComponent ? (
        <ModeComponent
          config={{}}
          theme={theme}
          brightness={brightness}
          isPaused={isPaused}
        />
      ) : (
        <LoadingSkeleton />
      )}

      {/* Dim overlay */}
      {dim && (
        <div className="fixed inset-0 bg-black/40 pointer-events-none" />
      )}
    </div>
  );
}
