'use client';

import { useCallback, useEffect, useState } from 'react';
import { SkipForward, SkipBack, Pause, Play, Tv, Sun, Radio, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { DisplayState, Album } from '@/types/db';

const MODES = [
  { id: 'slideshow-single', label: 'Slideshow',  emoji: '🖼️' },
  { id: 'slideshow-grid',   label: 'Grid',       emoji: '🔲' },
  { id: 'pinterest',        label: 'Pinterest',  emoji: '📌' },
  { id: 'clock-text',       label: 'Clock',      emoji: '🕐' },
  { id: 'flipboard',        label: 'FlipBoard',  emoji: '🔤' },
  { id: 'coverflow',        label: 'Cover Flow', emoji: '🎵' },
  { id: 'unsplash-mood',    label: 'Mood',       emoji: '🌄' },
  { id: 'easel',            label: 'Easel',      emoji: '✍️' },
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
  const [scheduleActive, setScheduleActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [brightness, setBrightnessLocal] = useState(100);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [dsRes, albumsRes, scheduleRes] = await Promise.all([
        fetch('/api/display-state'),
        fetch('/api/albums'),
        fetch('/api/schedules'),
      ]);
      if (dsRes.ok) {
        const json = await dsRes.json();
        const ds = json.state ?? json;
        setDisplayState(ds);
        setBrightnessLocal(ds?.brightness ?? 100);
        setFetchError(null);
        setLastUpdated(new Date());
      } else {
        setFetchError('Could not reach Supabase — add your keys to .env.local');
      }
      if (albumsRes.ok) {
        const json = await albumsRes.json();
        setAlbums(Array.isArray(json) ? json : (json.albums ?? []));
      }
      if (scheduleRes.ok) {
        const json = await scheduleRes.json();
        const list = Array.isArray(json) ? json : (json.schedules ?? []);
        setScheduleActive(list.some((s: { is_enabled: boolean }) => s.is_enabled));
      }
    } catch {
      setFetchError('Network error — is the dev server running?');
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

  const prevPhoto = async () => {
    await fetch('/api/display-state/prev', { method: 'POST' });
  };

  const commitBrightness = async (val: number) => {
    await patchDisplayState({ brightness: val });
  };

  const activeMode = MODES.find((m) => m.id === displayState?.active_mode_id);
  const activeAlbums = albums.filter((a) => displayState?.active_album_ids?.includes(a.id));
  const isPaused = displayState?.is_paused ?? false;
  const isConnected = displayState !== null && fetchError === null;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Now Playing</h1>
          <p className="text-sm text-muted-foreground mt-1">Control what&apos;s showing on the TV</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1.5">
          {isConnected ? (
            <><CheckCircle2 size={12} className="text-green-500" /> Live</>
          ) : (
            <><AlertCircle size={12} className="text-yellow-500" /> No DB</>
          )}
        </div>
      </div>

      {/* Connection warning */}
      {fetchError && (
        <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-yellow-400" />
          <div>
            <p className="font-medium">Not connected to database</p>
            <p className="text-xs text-yellow-300/80 mt-0.5">{fetchError}</p>
          </div>
        </div>
      )}

      {/* Status card — what's on right now */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Tv size={16} className="text-primary" />
              Currently on the TV
            </CardTitle>
            <div className="flex items-center gap-2">
              {scheduleActive && (
                <Badge variant="outline" className="text-xs gap-1 border-blue-500/50 text-blue-400">
                  <Clock size={10} /> Scheduled
                </Badge>
              )}
              <Badge
                className={cn(
                  'text-xs gap-1',
                  isPaused
                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                    : 'bg-green-500/20 text-green-300 border-green-500/30'
                )}
                variant="outline"
              >
                <Radio size={10} className={isPaused ? '' : 'animate-pulse'} />
                {isPaused ? 'Paused' : 'Playing'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Mode</p>
              {activeMode ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg">{activeMode.emoji}</span>
                  <span className="font-semibold text-sm">{activeMode.label}</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground italic">None selected</span>
              )}
            </div>
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Albums</p>
              {activeAlbums.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {activeAlbums.map((a) => (
                    <Badge key={a.id} variant="secondary" className="text-xs">{a.name}</Badge>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground italic">None</span>
              )}
            </div>
          </div>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground/60 text-right">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Mode switcher */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Switch Mode</CardTitle>
          <CardDescription>Tap a mode to switch the display immediately</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {MODES.map((m) => {
              const active = displayState?.active_mode_id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  disabled={loading}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer',
                    'hover:scale-[1.03] active:scale-[0.97]',
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25 ring-2 ring-primary/30'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent'
                  )}
                >
                  <span className="text-xl">{m.emoji}</span>
                  {m.label}
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/80" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Playback + Brightness side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Playback */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Playback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              size="lg"
              className={cn(
                'w-full h-14 text-base font-semibold gap-2 transition-all',
                isPaused
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-yellow-600 hover:bg-yellow-500 text-white'
              )}
              onClick={togglePause}
              disabled={!displayState}
            >
              {isPaused ? <><Play size={18} /> Resume</> : <><Pause size={18} /> Pause</>}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="lg"
                className="h-12 gap-2"
                onClick={prevPhoto}
                disabled={!displayState || isPaused}
              >
                <SkipBack size={16} />
                Prev
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 gap-2"
                onClick={nextPhoto}
                disabled={!displayState || isPaused}
              >
                <SkipForward size={16} />
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Brightness */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Brightness</CardTitle>
              <div className="flex items-center gap-1.5 bg-primary/15 rounded-full px-3 py-1">
                <Sun size={13} className="text-primary" />
                <span className="text-sm font-bold text-primary">{brightness}%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Slider
              min={5}
              max={100}
              step={1}
              value={[brightness]}
              onValueChange={(vals) => setBrightnessLocal(Number(Array.isArray(vals) ? vals[0] : vals))}
              onValueCommitted={(vals) => commitBrightness(Number(Array.isArray(vals) ? vals[0] : vals))}
              className="w-full"
              disabled={!displayState}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Dim (5%)</span>
              <span>Full (100%)</span>
            </div>
            {/* Visual brightness preview */}
            <div
              className="w-full h-2 rounded-full bg-gradient-to-r from-zinc-800 to-yellow-300 opacity-80"
              style={{ clipPath: `inset(0 ${100 - brightness}% 0 0 round 999px)` }}
            />
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap pb-4">
        <a
          href="/display"
          target="_blank"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Tv size={12} /> Open display in new tab ↗
        </a>
      </div>
    </div>
  );
}
