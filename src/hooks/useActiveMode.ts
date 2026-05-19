'use client';

import { useMemo } from 'react';
import { useDisplayStore } from '@/store/displayStore';
import { useSchedules } from './useSchedules';
import { findActiveSchedule } from '@/lib/scheduler/resolve';

interface ActiveMode {
  modeId: string | null;
  albumIds: string[];
  source: 'override' | 'schedule' | 'default';
}

export function useActiveMode(): ActiveMode {
  const displayState = useDisplayStore((s) => s.displayState);
  const schedules = useSchedules();

  return useMemo(() => {
    if (!displayState) {
      return { modeId: null, albumIds: [], source: 'default' };
    }

    // Manual override wins
    if (
      displayState.override_until &&
      new Date(displayState.override_until) > new Date()
    ) {
      return {
        modeId: displayState.active_mode_id,
        albumIds: displayState.active_album_ids,
        source: 'override',
      };
    }

    // Otherwise, check schedule
    const sched = findActiveSchedule(schedules);
    if (sched) {
      return {
        modeId: sched.mode_id,
        albumIds: sched.album_ids,
        source: 'schedule',
      };
    }

    // Default from display_state
    return {
      modeId: displayState.active_mode_id,
      albumIds: displayState.active_album_ids,
      source: 'default',
    };
  }, [displayState, schedules]);
}
