'use client';

import { useCallback, useEffect, useState } from 'react';
import { SkipForward, Sun } from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { Card } from '@/components/admin/Card';
import { Badge } from '@/components/admin/Badge';
import type { DisplayState, Album, Mode } from '@/types/db';

const MODES = [
  { id: 'slideshow-single', label: 'Slideshow' },
  { id: 'slideshow-grid', label: 'Grid' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'clock-text', label: 'Clock' },
  { id: 'flipboard', label: 'FlipBoard' },
  { id: 'coverflow', label: 'Cover Flow' },
  { id: 'unsplash-mood', label: 'Mood' },
  { id: 'easel', label: 'Easel' },
];

async function patchDisplayState(patch: Partial<DisplayState>) {
  return fetch('/api/display-state', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export default function NowPlayingPage() {
  const [displayState, setDisplayState] = useState<DisplayState | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [modes, setModes] = useState<Mode[]>([]);
  const [scheduleActive, setScheduleActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [dsRes, albumsRes, modesRes, scheduleRes] = await Promise.all([
        fetch('/api/display-state'),
        fetch('/api/albums'),
        fetch('/api/modes'),
        fetch('/api/schedules/active'),
      ]);
      if (dsRes.ok) setDisplayState(await dsRes.json());
      if (albumsRes.ok) setAlbums(await albumsRes.json());
      if (modesRes.ok) setModes(await modesRes.json());
      if (scheduleRes.ok) {
        const s = await scheduleRes.json();
        setScheduleActive(!!s);
      }
    } catch {
      // silently ignore fetch errors during dev
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const setMode = async (modeId: string) => {
    setLoading(true);
    await patchDisplayState({ active_mode_id: modeId });
    setDisplayState((prev) => prev ? { ...prev, active_mode_id: modeId } : prev);
    setLoading(false);
  };

  const togglePause = async () => {
    if (!displayState) return;
    const next = !displayState.is_paused;
    await patchDisplayState({ is_paused: next });
    setDisplayState((prev) => prev ? { ...prev, is_paused: next } : prev);
  };

  const nextPhoto = async () => {
    await fetch('/api/display-state/next', { method: 'POST' });
  };

  const setBrightness = async (val: number) => {
    setDisplayState((prev) => prev ? { ...prev, brightness: val } : prev);
    await patchDisplayState({ brightness: val });
  };

  const activeModeName =
    MODES.find((m) => m.id === displayState?.active_mode_id)?.label ??
    modes.find((m) => m.id === displayState?.active_mode_id)?.name ??
    'None';

  const activeAlbumNames = albums
    .filter((a) => displayState?.active_album_ids?.includes(a.id))
    .map((a) => a.name);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold font-display text-fg">What&apos;s on the TV</h1>
        {scheduleActive && (
          <Badge variant="success">Schedule active</Badge>
        )}
      </div>

      {/* Current state card */}
      <Card title="Currently showing">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-muted uppercase tracking-wider w-16">Mode</span>
            <Badge variant="accent">{activeModeName}</Badge>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-fg-muted uppercase tracking-wider w-16 pt-0.5">Albums</span>
            <div className="flex flex-wrap gap-1">
              {activeAlbumNames.length > 0 ? (
                activeAlbumNames.map((name) => (
                  <Badge key={name} variant="muted">{name}</Badge>
                ))
              ) : (
                <span className="text-sm text-fg-muted">No albums selected</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Mode chips */}
      <Card title="Switch mode">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => {
            const active = displayState?.active_mode_id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                disabled={loading}
                className={`relative overflow-hidden px-4 py-2 rounded-pill text-sm font-medium transition-colors min-h-[48px] cursor-pointer ${
                  active
                    ? 'bg-accent text-bg'
                    : 'bg-fg/10 text-fg hover:bg-fg/15'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Playback controls */}
      <Card title="Playback">
        <div className="space-y-3">
          <Button
            variant={displayState?.is_paused ? 'primary' : 'secondary'}
            size="lg"
            className="w-full h-14"
            onClick={togglePause}
          >
            {displayState?.is_paused ? '▶ RESUME' : '⏸ PAUSE'}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full h-14"
            onClick={nextPhoto}
          >
            <SkipForward size={18} />
            NEXT PHOTO
          </Button>
        </div>
      </Card>

      {/* Brightness */}
      <Card title="Brightness">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Sun size={16} className="text-fg-muted" />
            <span className="text-sm font-mono text-accent">{displayState?.brightness ?? 80}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            value={displayState?.brightness ?? 80}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full accent-accent h-2 rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-xs text-fg-muted">
            <span>5%</span>
            <span>100%</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
