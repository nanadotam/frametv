'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SkipForward, SkipBack, Pause, Play, Tv, Sun, Radio, Clock,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Send, Zap,
  CalendarDays, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { invalidateModes } from '@/hooks/useModes';
import type { DisplayState, Album, Schedule, Mode } from '@/types/db';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES = [
  { id: 'slideshow-single', label: 'Slideshow',  emoji: '🖼️' },
  { id: 'slideshow-grid',   label: 'Grid',       emoji: '🔲' },
  { id: 'pinterest',        label: 'Pinterest',  emoji: '📌' },
  { id: 'clock-text',       label: 'Clock',      emoji: '🕐' },
  { id: 'flipboard',        label: 'FlipBoard',  emoji: '🔤' },
  { id: 'coverflow',        label: 'Cover Flow', emoji: '🎵' },
  { id: 'unsplash-mood',    label: 'Mood',       emoji: '🌄' },
  { id: 'easel',            label: 'Easel',      emoji: '✍️' },
  { id: 'eisenhower',       label: 'Eisenhower', emoji: '🧩' },
];

const INTERVAL_OPTIONS = [
  { label: '30s',  value: 30 },
  { label: '1m',   value: 60 },
  { label: '2m',   value: 120 },
  { label: '3m',   value: 180 },
  { label: '5m',   value: 300 },
  { label: '10m',  value: 600 },
  { label: '15m',  value: 900 },
  { label: '30m',  value: 1800 },
];

const MODES_WITH_SETTINGS = new Set([
  'slideshow-single', 'slideshow-grid', 'pinterest',
  'clock-text', 'flipboard', 'unsplash-mood', 'easel',
]);

// ─── Chip Row ─────────────────────────────────────────────────────────────────

function ChipRow<T extends string | number>({
  options, value, onSelect,
}: {
  options: { label: string; value: T }[];
  value: T;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onSelect(o.value)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
            value === o.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card border-border text-muted-foreground hover:border-primary/50'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Quick Settings Components ────────────────────────────────────────────────

type Cfg = Record<string, unknown>;

function SlideshowQuickSettings({ cfg, onChange }: { cfg: Cfg; onChange: (c: Cfg) => void }) {
  const intervalSec = (cfg.intervalSeconds as number) ?? (cfg.interval as number) ?? 300;
  const closest = INTERVAL_OPTIONS.reduce((p, c) =>
    Math.abs(c.value - intervalSec) < Math.abs(p.value - intervalSec) ? c : p
  );
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Interval</p>
        <ChipRow
          options={INTERVAL_OPTIONS}
          value={closest.value}
          onSelect={(v) => onChange({ ...cfg, intervalSeconds: v, interval: undefined })}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Transition</p>
        <ChipRow
          options={[
            { label: 'Fade', value: 'fade' },
            { label: 'Slide', value: 'slide' },
            { label: 'Blur', value: 'blur' },
            { label: 'Pixelate', value: 'pixelate' },
          ]}
          value={(cfg.transition as string) ?? 'fade'}
          onSelect={(v) => onChange({ ...cfg, transition: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Shuffle</span>
        <Switch
          checked={(cfg.shuffle as boolean) ?? true}
          onCheckedChange={(v) => onChange({ ...cfg, shuffle: v })}
        />
      </div>
    </div>
  );
}

function PinterestQuickSettings({ cfg, onChange }: { cfg: Cfg; onChange: (c: Cfg) => void }) {
  const speedNum = typeof cfg.speed === 'number'
    ? cfg.speed
    : typeof cfg.speed === 'string' ? parseFloat(cfg.speed as string) || 1 : 1;
  const direction = typeof cfg.direction === 'string'
    ? cfg.direction
    : (cfg.reverse_direction ? 'right' : 'left');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Scroll speed</p>
        <ChipRow
          options={[
            { label: '0.25×', value: 0.25 },
            { label: '0.5×',  value: 0.5 },
            { label: '1×',    value: 1 },
            { label: '2×',    value: 2 },
          ]}
          value={speedNum}
          onSelect={(v) => onChange({ ...cfg, speed: v, reverse_direction: undefined })}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Rows</p>
        <ChipRow
          options={[{ label: '2 rows', value: 2 }, { label: '3 rows', value: 3 }, { label: '4 rows', value: 4 }]}
          value={(cfg.rows as number) ?? 3}
          onSelect={(v) => onChange({ ...cfg, rows: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Reverse direction</span>
        <Switch
          checked={direction === 'right'}
          onCheckedChange={(v) => onChange({ ...cfg, direction: v ? 'right' : 'left', reverse_direction: undefined })}
        />
      </div>
    </div>
  );
}

function ClockQuickSettings({ cfg, onChange }: { cfg: Cfg; onChange: (c: Cfg) => void }) {
  const fontSize = (cfg.font_size as number) ?? 80;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Theme</p>
        <ChipRow
          options={[
            { label: 'Dark', value: 'dark' },
            { label: 'Light', value: 'light' },
            { label: 'Nude', value: 'nude' },
            { label: 'Cream', value: 'cream' },
          ]}
          value={(cfg.theme as string) ?? 'dark'}
          onSelect={(v) => onChange({ ...cfg, theme: v })}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Font size</p>
          <span className="text-sm font-bold text-primary">{fontSize}px</span>
        </div>
        <Slider
          min={40} max={200} step={4}
          value={[fontSize]}
          onValueChange={(v) => onChange({ ...cfg, font_size: Number(Array.isArray(v) ? v[0] : v) })}
          className="w-full"
        />
      </div>
    </div>
  );
}

function FlipboardQuickCompose() {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch('/api/flipboard/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim().toUpperCase() }),
      });
      setText('');
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Post to board</p>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value.toUpperCase())}
          placeholder="TYPE A MESSAGE…"
          className="font-mono tracking-widest text-sm uppercase h-11"
          maxLength={120}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <Button
          onClick={send}
          disabled={!text.trim() || sending}
          className={cn('shrink-0 h-11 px-3', sent && 'bg-green-600 hover:bg-green-500')}
        >
          {sent
            ? <CheckCircle2 size={16} />
            : sending
            ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}

function MoodQuickSettings({ cfg, onChange }: { cfg: Cfg; onChange: (c: Cfg) => void }) {
  const intervalSec = (cfg.intervalSeconds as number) ?? 120;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Mood / keywords</p>
        <Input
          value={(cfg.mood as string) ?? ''}
          onChange={(e) => onChange({ ...cfg, mood: e.target.value })}
          placeholder="nature, minimal, cozy…"
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Interval</p>
          <span className="text-sm font-bold text-primary">{Math.round(intervalSec / 60)} min</span>
        </div>
        <Slider
          min={120} max={1800} step={60}
          value={[intervalSec]}
          onValueChange={(v) => onChange({ ...cfg, intervalSeconds: Number(Array.isArray(v) ? v[0] : v) })}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>2 min</span><span>30 min</span>
        </div>
      </div>
    </div>
  );
}

function EaselQuickSettings({ cfg, onChange }: { cfg: Cfg; onChange: (c: Cfg) => void }) {
  const mins = (cfg.interval_minutes as number) ?? 5;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Interval</p>
        <span className="text-sm font-bold text-primary">{mins} min</span>
      </div>
      <Slider
        min={1} max={60} step={1}
        value={[mins]}
        onValueChange={(v) => onChange({ ...cfg, interval_minutes: Number(Array.isArray(v) ? v[0] : v) })}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>1 min</span><span>60 min</span>
      </div>
    </div>
  );
}

function QuickSettingsContent({
  modeId, cfg, onChange,
}: {
  modeId: string;
  cfg: Cfg;
  onChange: (c: Cfg) => void;
}) {
  switch (modeId) {
    case 'slideshow-single':
    case 'slideshow-grid':
      return <SlideshowQuickSettings cfg={cfg} onChange={onChange} />;
    case 'pinterest':
      return <PinterestQuickSettings cfg={cfg} onChange={onChange} />;
    case 'clock-text':
      return <ClockQuickSettings cfg={cfg} onChange={onChange} />;
    case 'flipboard':
      return <FlipboardQuickCompose />;
    case 'unsplash-mood':
      return <MoodQuickSettings cfg={cfg} onChange={onChange} />;
    case 'easel':
      return <EaselQuickSettings cfg={cfg} onChange={onChange} />;
    case 'coverflow':
    case 'eisenhower':
      return (
        <p className="text-sm text-muted-foreground italic">
          {modeId === 'eisenhower' ? 'Tasks are managed in the FlipBoard tab.' : 'No quick settings for this mode.'}
        </p>
      );
    default:
      return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ClockConfig = { enabled: boolean; position: string; font: string };

async function patchDisplayState(patch: Partial<DisplayState>) {
  return fetch('/api/display-state', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export default function NowPlayingPage() {
  const [displayState, setDisplayState]     = useState<DisplayState | null>(null);
  const [albums, setAlbums]                 = useState<Album[]>([]);
  const [schedules, setSchedules]           = useState<Schedule[]>([]);
  const [clockConfig, setClockConfig]       = useState<ClockConfig>({ enabled: false, position: 'bottom-right', font: 'Poppins' });
  const [modes, setModes]                   = useState<Mode[]>([]);
  const [modeConfig, setModeConfig]         = useState<Cfg>({});
  const [loading, setLoading]               = useState(false);
  const [fetchError, setFetchError]         = useState<string | null>(null);
  const [brightness, setBrightnessLocal]    = useState(100);
  const [lastUpdated, setLastUpdated]       = useState<Date | null>(null);
  const [quickOpen, setQuickOpen]           = useState(false);

  const modeConfigTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [dsRes, albumsRes, scheduleRes, clockRes, modesRes] = await Promise.all([
        fetch('/api/display-state'),
        fetch('/api/albums'),
        fetch('/api/schedules'),
        fetch('/api/settings?key=clock_overlay'),
        fetch('/api/modes'),
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
        const list: Schedule[] = Array.isArray(json) ? json : (json.schedules ?? []);
        setSchedules(list);
      }

      if (clockRes.ok) {
        const json = await clockRes.json();
        if (json.setting?.value) setClockConfig((p) => ({ ...p, ...json.setting.value }));
      }

      if (modesRes.ok) {
        const json = await modesRes.json();
        setModes(Array.isArray(json) ? json : (json.modes ?? []));
      }
    } catch {
      setFetchError('Network error — is the dev server running?');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Sync modeConfig when active mode or modes list changes
  useEffect(() => {
    const activeModeId = displayState?.active_mode_id;
    if (!activeModeId) return;
    const found = modes.find((m) => m.id === activeModeId);
    if (found) setModeConfig((found.config as Cfg) ?? {});
    setQuickOpen(MODES_WITH_SETTINGS.has(activeModeId));
  }, [displayState?.active_mode_id, modes]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const setMode = async (modeId: string) => {
    setLoading(true);
    await patchDisplayState({ active_mode_id: modeId });
    setDisplayState((p) => p ? { ...p, active_mode_id: modeId } : p);
    setLoading(false);
  };

  const togglePause = async () => {
    if (!displayState) return;
    const next = !displayState.is_paused;
    await patchDisplayState({ is_paused: next });
    setDisplayState((p) => p ? { ...p, is_paused: next } : p);
  };

  const nextPhoto = () => fetch('/api/display-state/next', { method: 'POST' });
  const prevPhoto = () => fetch('/api/display-state/prev', { method: 'POST' });

  const commitBrightness = (val: number) => patchDisplayState({ brightness: val });

  const toggleAlbum = async (id: string) => {
    if (!displayState) return;
    const next = displayState.active_album_ids.includes(id)
      ? displayState.active_album_ids.filter((x) => x !== id)
      : [...displayState.active_album_ids, id];
    await patchDisplayState({ active_album_ids: next });
    setDisplayState((p) => p ? { ...p, active_album_ids: next } : p);
  };

  const toggleClock = async () => {
    const next = { ...clockConfig, enabled: !clockConfig.enabled };
    setClockConfig(next);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'clock_overlay', value: next }),
    });
  };

  const toggleSchedule = async (s: Schedule) => {
    const next = !s.is_enabled;
    setSchedules((p) => p.map((x) => x.id === s.id ? { ...x, is_enabled: next } : x));
    await fetch(`/api/schedules/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: next }),
    });
  };

  const handleModeConfigChange = useCallback((cfg: Cfg) => {
    setModeConfig(cfg);
    const activeModeId = displayState?.active_mode_id;
    if (!activeModeId) return;
    if (modeConfigTimer.current) clearTimeout(modeConfigTimer.current);
    modeConfigTimer.current = setTimeout(async () => {
      await fetch(`/api/modes/${activeModeId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      invalidateModes();
    }, 400);
  }, [displayState?.active_mode_id]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeMode   = MODES.find((m) => m.id === displayState?.active_mode_id);
  const activeAlbums = albums.filter((a) => displayState?.active_album_ids?.includes(a.id));
  const visibleAlbums = albums.filter((a) => !a.is_archived);
  const isPaused     = displayState?.is_paused ?? false;
  const isConnected  = displayState !== null && fetchError === null;
  const enabledSchedules = schedules.filter((s) => s.is_enabled);
  const nextSchedule = enabledSchedules[0] ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Remote</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Control what&apos;s on the TV</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1.5">
          {isConnected
            ? <><CheckCircle2 size={12} className="text-green-500" /> Live</>
            : <><AlertCircle size={12} className="text-yellow-500" /> No DB</>}
        </div>
      </div>

      {/* ── Connection warning ── */}
      {fetchError && (
        <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-yellow-400" />
          <div>
            <p className="font-medium">Not connected to database</p>
            <p className="text-xs text-yellow-300/80 mt-0.5">{fetchError}</p>
          </div>
        </div>
      )}

      {/* ── Status Card ── */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tv size={15} className="text-primary" />
              Currently on the TV
            </CardTitle>
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
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Mode + Albums */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Mode</p>
              {activeMode ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg">{activeMode.emoji}</span>
                  <span className="font-semibold text-sm">{activeMode.label}</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground italic">None</span>
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

          <Separator />

          {/* Clock overlay shortcut */}
          <div className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium">Clock overlay</span>
            </div>
            <Switch
              checked={clockConfig.enabled}
              onCheckedChange={toggleClock}
              disabled={!isConnected}
            />
          </div>

          {/* Schedule shortcut */}
          {schedules.length > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarDays size={14} className="text-muted-foreground shrink-0" />
                  {nextSchedule ? (
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">{nextSchedule.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {nextSchedule.start_time}–{nextSchedule.end_time}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No active schedule</span>
                  )}
                </div>
                {nextSchedule && (
                  <Switch
                    checked={nextSchedule.is_enabled}
                    onCheckedChange={() => toggleSchedule(nextSchedule)}
                  />
                )}
              </div>
            </>
          )}

          {lastUpdated && (
            <p className="text-xs text-muted-foreground/50 text-right">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Album Quick-Toggle ── */}
      {visibleAlbums.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">
            Source Albums
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
            {visibleAlbums.map((album) => {
              const isActive = displayState?.active_album_ids?.includes(album.id) ?? false;
              return (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => toggleAlbum(album.id)}
                  disabled={!displayState}
                  className={cn(
                    'flex items-center gap-1.5 shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all border',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {isActive && <Star size={11} fill="currentColor" />}
                  {album.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Mode Switcher ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Switch Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
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

      {/* ── Quick Settings Drawer ── */}
      {activeMode && (
        <Card>
          <button
            type="button"
            onClick={() => setQuickOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-primary" />
              <span className="text-sm font-semibold">Quick Settings</span>
              <span className="text-xs text-muted-foreground">· {activeMode.label}</span>
            </div>
            {quickOpen
              ? <ChevronUp size={16} className="text-muted-foreground" />
              : <ChevronDown size={16} className="text-muted-foreground" />}
          </button>
          {quickOpen && (
            <CardContent className="pt-0 pb-5 px-5">
              <Separator className="mb-4" />
              <QuickSettingsContent
                modeId={activeMode.id}
                cfg={modeConfig}
                onChange={handleModeConfigChange}
              />
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Playback + Brightness ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Playback */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Playback</CardTitle>
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
                <SkipBack size={16} /> Prev
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 gap-2"
                onClick={nextPhoto}
                disabled={!displayState || isPaused}
              >
                <SkipForward size={16} /> Next
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Brightness */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Brightness</CardTitle>
              <div className="flex items-center gap-1.5 bg-primary/15 rounded-full px-3 py-1">
                <Sun size={13} className="text-primary" />
                <span className="text-sm font-bold text-primary">{brightness}%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Slider
              min={5} max={100} step={1}
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
            <div
              className="w-full h-2 rounded-full bg-gradient-to-r from-zinc-800 to-yellow-300 opacity-80"
              style={{ clipPath: `inset(0 ${100 - brightness}% 0 0 round 999px)` }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 pb-4">
        <a
          href="/display"
          target="_blank"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Tv size={12} /> Open display ↗
        </a>
      </div>
    </div>
  );
}
