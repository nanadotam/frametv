'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import {
  SkipForward, SkipBack, Pause, Play, Tv, Sun, Radio, Clock,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Send, Zap,
  CalendarDays, Star, Shuffle, MonitorSmartphone, Loader2, Info,
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
import type { DisplayState, Album, Schedule, Mode, DisplayDevice } from '@/types/db';
import PageGuide from '@/components/admin/PageGuide';
import { MODE_CATEGORIES, MODE_CATEGORY_BY_ID, MODE_METADATA, MODE_ORDER } from '@/lib/modeMetadata';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES = MODE_ORDER.map((id) => MODE_METADATA[id]);

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
  'vinyl', 'scripture',
]);

const TV_SAFE_MODES = new Set([
  'slideshow-single',
  'slideshow-grid',
  'pinterest',
  'clock-text',
  'vinyl',
  'coverflow',
  'scripture',
]);

type QuickSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type PlaybackAction = 'pause' | 'prev' | 'next' | 'shuffle';

function rendererLabel(renderer: string | null | undefined) {
  if (renderer === 'html-tv') return 'TV-safe renderer';
  if (renderer === 'react') return 'Full renderer';
  return 'Display renderer';
}

function shortDeviceLabel(device: DisplayDevice) {
  return device.label || device.device_name || `${device.browser ?? 'Browser'} on ${device.os ?? 'Unknown OS'}`;
}

function timeAgo(ts: string, now: number) {
  const diff = Math.max(0, now - new Date(ts).getTime());
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

function ModeIcon({ mode, className, size = 18 }: { mode: { icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }; className?: string; size?: number }) {
  const Icon = mode.icon;
  return <Icon size={size} className={className} />;
}

function modeTone(modeId: string | null | undefined) {
  const category = modeId ? MODE_CATEGORY_BY_ID[MODE_METADATA[modeId]?.category] : null;
  return category?.tone ?? MODE_CATEGORY_BY_ID.photos.tone;
}

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

function VinylQuickSettings({ cfg, onChange }: { cfg: Cfg; onChange: (c: Cfg) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Background</p>
      <ChipRow
        options={[
          { label: 'Color gradient', value: 'gradient' },
          { label: 'Pure black',     value: 'black' },
        ]}
        value={(cfg.background as string) ?? 'gradient'}
        onSelect={(v) => onChange({ ...cfg, background: v })}
      />
    </div>
  );
}

function ScriptureQuickSettings({ cfg, onChange }: { cfg: Cfg; onChange: (c: Cfg) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Translation</p>
        <ChipRow
          options={[
            { label: 'KJV',  value: 'KJV'  },
            { label: 'NIV',  value: 'NIV'  },
            { label: 'ESV',  value: 'ESV'  },
            { label: 'NKJV', value: 'NKJV' },
          ]}
          value={(cfg.translation as string) ?? 'KJV'}
          onSelect={(v) => onChange({ ...cfg, translation: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Highlight sacred words</span>
        <Switch
          checked={(cfg.highlightSacredWords as boolean) ?? true}
          onCheckedChange={(v) => onChange({ ...cfg, highlightSacredWords: v })}
        />
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
    case 'vinyl':
      return <VinylQuickSettings cfg={cfg} onChange={onChange} />;
    case 'scripture':
      return <ScriptureQuickSettings cfg={cfg} onChange={onChange} />;
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
  const [displayDevices, setDisplayDevices] = useState<DisplayDevice[]>([]);
  const [deviceNow, setDeviceNow]           = useState(0);
  const [modeConfig, setModeConfig]         = useState<Cfg>({});
  const [loading, setLoading]               = useState(false);
  const [fetchError, setFetchError]         = useState<string | null>(null);
  const [actionError, setActionError]       = useState<string | null>(null);
  const [brightness, setBrightnessLocal]    = useState(100);
  const [brightnessSync, setBrightnessSync] = useState<QuickSaveStatus>('idle');
  const [lastUpdated, setLastUpdated]       = useState<Date | null>(null);
  const [quickOpen, setQuickOpen]           = useState(false);
  const [quickSaveStatus, setQuickSaveStatus] = useState<QuickSaveStatus>('idle');
  const [pendingModeId, setPendingModeId]   = useState<string | null>(null);
  const [pendingAlbumIds, setPendingAlbumIds] = useState<Set<string>>(new Set());
  const [playbackPending, setPlaybackPending] = useState<PlaybackAction | null>(null);
  const [devicesOpen, setDevicesOpen]       = useState(false);

  const modeConfigTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brightnessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brightnessSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [dsRes, albumsRes, scheduleRes, clockRes, modesRes, devicesRes] = await Promise.all([
        fetch('/api/display-state'),
        fetch('/api/albums'),
        fetch('/api/schedules'),
        fetch('/api/settings?key=clock_overlay'),
        fetch('/api/modes'),
        fetch('/api/display-devices'),
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

      if (devicesRes.ok) {
        const json = await devicesRes.json();
        setDisplayDevices(json.devices ?? []);
        setDeviceNow(Date.now());
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

  useEffect(() => {
    return () => {
      if (modeConfigTimer.current) clearTimeout(modeConfigTimer.current);
      if (brightnessTimer.current) clearTimeout(brightnessTimer.current);
      if (brightnessSavedTimer.current) clearTimeout(brightnessSavedTimer.current);
      if (quickSavedTimer.current) clearTimeout(quickSavedTimer.current);
    };
  }, []);

  // Sync modeConfig when active mode or modes list changes
  useEffect(() => {
    const activeModeId = displayState?.active_mode_id;
    if (!activeModeId) return;
    const found = modes.find((m) => m.id === activeModeId);
    if (found) setModeConfig((found.config as Cfg) ?? {});
    setQuickOpen(MODES_WITH_SETTINGS.has(activeModeId));
  }, [displayState?.active_mode_id, modes]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const failAction = useCallback((message: string) => {
    setActionError(message);
    window.setTimeout(() => setActionError(null), 4500);
  }, []);

  const setMode = async (modeId: string) => {
    if (!displayState || pendingModeId) return;
    const previous = displayState;
    setActionError(null);
    setPendingModeId(modeId);
    setLoading(true);
    setDisplayState({ ...previous, active_mode_id: modeId });
    try {
      const res = await patchDisplayState({ active_mode_id: modeId });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Could not switch mode.');
      if (json?.state) setDisplayState(json.state);
    } catch (err) {
      setDisplayState(previous);
      failAction(err instanceof Error ? err.message : 'Could not switch mode.');
    } finally {
      setPendingModeId(null);
      setLoading(false);
    }
  };

  const togglePause = async () => {
    if (!displayState || playbackPending) return;
    const previous = displayState;
    const next = !displayState.is_paused;
    setActionError(null);
    setPlaybackPending('pause');
    setDisplayState({ ...previous, is_paused: next });
    try {
      const res = await patchDisplayState({ is_paused: next });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Could not update playback.');
      if (json?.state) setDisplayState(json.state);
    } catch (err) {
      setDisplayState(previous);
      failAction(err instanceof Error ? err.message : 'Could not update playback.');
    } finally {
      setPlaybackPending(null);
    }
  };

  const runPlaybackAction = async (action: Exclude<PlaybackAction, 'pause'>, url: string) => {
    if (playbackPending) return;
    setActionError(null);
    setPlaybackPending(action);
    try {
      const res = await fetch(url, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Could not send command to TV.');
      if (json?.state) setDisplayState(json.state);
    } catch (err) {
      failAction(err instanceof Error ? err.message : 'Could not send command to TV.');
    } finally {
      setPlaybackPending(null);
    }
  };

  const nextPhoto = () => runPlaybackAction('next', '/api/display-state/next');
  const prevPhoto = () => runPlaybackAction('prev', '/api/display-state/prev');
  const reshufflePhotos = () => runPlaybackAction('shuffle', '/api/display-state/reshuffle');

  const commitBrightness = async (val: number) => {
    if (brightnessTimer.current) {
      clearTimeout(brightnessTimer.current);
      brightnessTimer.current = null;
    }
    setBrightnessSync('saving');
    try {
      const res = await patchDisplayState({ brightness: val });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Could not sync brightness.');
      if (json?.state) setDisplayState(json.state);
      setBrightnessSync('saved');
      if (brightnessSavedTimer.current) clearTimeout(brightnessSavedTimer.current);
      brightnessSavedTimer.current = setTimeout(() => setBrightnessSync('idle'), 1200);
    } catch (err) {
      setBrightnessSync('error');
      failAction(err instanceof Error ? err.message : 'Could not sync brightness.');
    }
  };

  const scheduleBrightness = (val: number) => {
    setBrightnessLocal(val);
    setDisplayState((p) => p ? { ...p, brightness: val } : p);
    if (brightnessTimer.current) clearTimeout(brightnessTimer.current);
    brightnessTimer.current = setTimeout(() => commitBrightness(val), 220);
  };

  const toggleAlbum = async (id: string) => {
    if (!displayState || pendingAlbumIds.has(id)) return;
    const previous = displayState;
    const next = displayState.active_album_ids.includes(id)
      ? displayState.active_album_ids.filter((x) => x !== id)
      : [...displayState.active_album_ids, id];
    setActionError(null);
    setPendingAlbumIds((prev) => new Set(prev).add(id));
    setDisplayState({ ...previous, active_album_ids: next });
    try {
      const res = await patchDisplayState({ active_album_ids: next });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Could not sync albums.');
      if (json?.state) setDisplayState(json.state);
    } catch (err) {
      setDisplayState(previous);
      failAction(err instanceof Error ? err.message : 'Could not sync albums.');
    } finally {
      setPendingAlbumIds((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    }
  };

  const toggleClock = async () => {
    const previous = clockConfig;
    const next = { ...clockConfig, enabled: !clockConfig.enabled };
    setClockConfig(next);
    setActionError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'clock_overlay', value: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Could not update clock overlay.');
    } catch (err) {
      setClockConfig(previous);
      failAction(err instanceof Error ? err.message : 'Could not update clock overlay.');
    }
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
    if (quickSavedTimer.current) clearTimeout(quickSavedTimer.current);
    setQuickSaveStatus('saving');
    modeConfigTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/modes/${activeModeId}/config`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cfg),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? 'Could not save quick settings.');
        setModes((prev) => prev.map((mode) => mode.id === activeModeId ? { ...mode, config: cfg } : mode));
        invalidateModes();
        setQuickSaveStatus('saved');
        quickSavedTimer.current = setTimeout(() => setQuickSaveStatus('idle'), 1200);
      } catch (err) {
        setQuickSaveStatus('error');
        failAction(err instanceof Error ? err.message : 'Could not save quick settings.');
      }
    }, 400);
  }, [displayState?.active_mode_id, failAction]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeMode   = MODES.find((m) => m.id === displayState?.active_mode_id);
  const activeAlbums = albums.filter((a) => displayState?.active_album_ids?.includes(a.id));
  const visibleAlbums = albums.filter((a) => !a.is_archived);
  const isPaused     = displayState?.is_paused ?? false;
  const isConnected  = displayState !== null && fetchError === null;
  const enabledSchedules = schedules.filter((s) => s.is_enabled);
  const nextSchedule = enabledSchedules[0] ?? null;
  const activeDevices = displayDevices.filter((d) => deviceNow - new Date(d.last_seen_at).getTime() < 90_000);
  const liveDevice = activeDevices[0] ?? displayDevices[0] ?? null;
  const htmlTvUnsupportedMode =
    liveDevice?.renderer === 'html-tv' &&
    Boolean(displayState?.active_mode_id) &&
    !TV_SAFE_MODES.has(displayState?.active_mode_id ?? '');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">

      <PageGuide
        pageKey="remote"
        icon={<Tv size={18} className="text-primary" />}
        title="Remote"
        about="This is your TV remote. Switch between display modes, toggle albums active, adjust brightness, and control playback — all from any device on your network."
        steps={[
          'Select a Mode to change what your TV shows (slideshow, grid, clock, etc.).',
          'Toggle Albums to choose which photo collections appear.',
          'Use Playback to pause, skip, or resume.',
          'Adjust Brightness to dim the display at night.',
          'Click "Quick Settings" to fine-tune the active mode.',
        ]}
      />

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

      {actionError && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Command did not sync</p>
            <p className="text-xs mt-0.5 opacity-80">{actionError}</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Mode</p>
              {activeMode ? (
                <div className="flex items-center gap-2">
                  <span className={cn('flex size-8 items-center justify-center rounded-lg border', modeTone(activeMode.id).iconBg, modeTone(activeMode.id).iconBorder, modeTone(activeMode.id).text)}>
                    <ModeIcon mode={activeMode} size={16} />
                  </span>
                  <span className="font-semibold text-sm">{activeMode.label}</span>
                  {pendingModeId && <Loader2 size={13} className="animate-spin text-primary" />}
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
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Live device</p>
              {liveDevice ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', activeDevices.includes(liveDevice) ? 'bg-green-500' : 'bg-muted-foreground/40')} />
                    <span className="font-semibold text-sm truncate">{shortDeviceLabel(liveDevice)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{rendererLabel(liveDevice.renderer)}</p>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground italic">No device yet</span>
              )}
            </div>
          </div>

          {htmlTvUnsupportedMode && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-200">
              <Info size={15} className="mt-0.5 shrink-0 text-yellow-300" />
              <p className="text-xs leading-relaxed">
                This TV is using the TV-safe renderer. {activeMode?.label ?? 'This mode'} is not supported there yet, so the TV will show a compatibility message instead of silently changing modes.
              </p>
            </div>
          )}

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

      {/* ── Display Devices ── */}
      <Card>
        <button
          type="button"
          onClick={() => setDevicesOpen((open) => !open)}
          className="w-full px-5 py-4 text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MonitorSmartphone size={15} className="text-primary" />
              Display devices / diagnostics
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {activeDevices.length} active
              </Badge>
              {devicesOpen
                ? <ChevronUp size={16} className="text-muted-foreground" />
                : <ChevronDown size={16} className="text-muted-foreground" />}
            </div>
          </div>
          {liveDevice && !devicesOpen && (
            <p className="mt-2 text-xs text-muted-foreground truncate">
              {shortDeviceLabel(liveDevice)} · {rendererLabel(liveDevice.renderer)} · seen {timeAgo(liveDevice.last_seen_at, deviceNow)}
            </p>
          )}
        </button>
        {devicesOpen && (
          <CardContent className="space-y-2 pt-0">
            <Separator className="mb-3" />
            {displayDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Open the display on a TV or browser to register a device heartbeat.
              </p>
            ) : (
              displayDevices.slice(0, 6).map((device) => {
                const active = deviceNow - new Date(device.last_seen_at).getTime() < 90_000;
                const unsupported = device.renderer === 'html-tv' && Boolean(device.active_mode_id) && !TV_SAFE_MODES.has(device.active_mode_id ?? '');
                return (
                  <div
                    key={device.id}
                    className={cn(
                      'flex items-start justify-between gap-3 bg-background rounded-lg border p-3',
                      unsupported ? 'border-yellow-500/30' : 'border-border'
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full', active ? 'bg-green-500' : 'bg-muted-foreground/40')} />
                        <p className="text-sm font-semibold truncate">{shortDeviceLabel(device)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {rendererLabel(device.renderer)} · {device.active_mode_id ?? 'unknown mode'} · {device.browser ?? 'Unknown browser'} · {device.os ?? 'Unknown OS'}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {device.viewport_width ?? '?'}×{device.viewport_height ?? '?'} viewport
                        {device.fullscreen_active ? ' · fullscreen' : device.fullscreen_supported === false ? ' · fullscreen unsupported' : ''}
                      </p>
                      {unsupported && (
                        <p className="text-xs text-yellow-300 mt-1">
                          This mode needs the full renderer on this device.
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {timeAgo(device.last_seen_at, deviceNow)}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        )}
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
              const pending = pendingAlbumIds.has(album.id);
              return (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => toggleAlbum(album.id)}
                  disabled={!displayState}
                  className={cn(
                    'flex items-center gap-1.5 shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all border',
                    isActive
                      ? 'bg-emerald-500/18 text-emerald-100 border-emerald-400/55 shadow-sm shadow-emerald-500/10'
                      : 'bg-card border-border text-muted-foreground hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-100'
                  )}
                >
                  {pending
                    ? <Loader2 size={11} className="animate-spin" />
                    : isActive && <Star size={11} fill="currentColor" />}
                  {album.name}
                </button>
              );
            })}
          </div>
          {pendingAlbumIds.size > 0 && (
            <p className="text-xs text-primary px-1">Syncing album selection to TV...</p>
          )}
        </div>
      )}

      {/* ── Mode Switcher ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Switch Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {MODE_CATEGORIES.map((category) => {
            const CategoryIcon = category.icon;
            const categoryModes = MODES.filter((mode) => mode.category === category.id);
            if (categoryModes.length === 0) return null;
            return (
              <div key={category.id} className="space-y-2.5">
                <div className="flex items-center gap-2 px-1">
                  <span className={cn('flex size-7 items-center justify-center rounded-lg border', category.tone.iconBg, category.tone.iconBorder)}>
                    <CategoryIcon size={14} className={category.tone.text} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{category.label}</p>
                    <p className="text-[11px] text-muted-foreground">{category.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {categoryModes.map((m) => {
                    const active = displayState?.active_mode_id === m.id;
                    const pending = pendingModeId === m.id;
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        disabled={loading && !pending}
                        className={cn(
                          'flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all cursor-pointer',
                          'hover:scale-[1.03] active:scale-[0.97]',
                          active
                            ? cn(category.tone.active, 'shadow-md ring-2')
                            : cn('bg-card border-border text-muted-foreground hover:text-foreground', category.tone.hover)
                        )}
                      >
                        <span className={cn('flex size-10 items-center justify-center rounded-xl border', active ? 'border-current/25 bg-white/10' : cn(category.tone.iconBg, category.tone.iconBorder, category.tone.text))}>
                          <Icon size={22} strokeWidth={active ? 2.6 : 2} />
                        </span>
                        <span className="leading-tight text-center">{m.label}</span>
                        {pending
                          ? <Loader2 size={12} className="animate-spin" />
                          : active && <span className="w-1.5 h-1.5 rounded-full bg-current/80" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
              <span className="text-sm font-semibold">Quick settings for current mode</span>
              <span className="text-xs text-muted-foreground">· {activeMode.label}</span>
              {quickSaveStatus === 'saving' && (
                <span className="text-xs text-primary flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" /> Saving
                </span>
              )}
              {quickSaveStatus === 'saved' && <span className="text-xs text-green-500">Saved</span>}
              {quickSaveStatus === 'error' && <span className="text-xs text-destructive">Could not save</span>}
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
              disabled={!displayState || Boolean(playbackPending)}
            >
              {playbackPending === 'pause'
                ? <><Loader2 size={18} className="animate-spin" /> Syncing</>
                : isPaused ? <><Play size={18} /> Resume</> : <><Pause size={18} /> Pause</>}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="lg"
                className="h-12 gap-2"
                onClick={prevPhoto}
                disabled={!displayState || isPaused || Boolean(playbackPending)}
              >
                {playbackPending === 'prev' ? <Loader2 size={16} className="animate-spin" /> : <SkipBack size={16} />}
                Prev
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 gap-2"
                onClick={nextPhoto}
                disabled={!displayState || isPaused || Boolean(playbackPending)}
              >
                {playbackPending === 'next' ? <Loader2 size={16} className="animate-spin" /> : <SkipForward size={16} />}
                Next
              </Button>
            </div>
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 gap-2 border-violet-500/40 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 hover:border-violet-400 transition-all"
              onClick={reshufflePhotos}
              disabled={!displayState || Boolean(playbackPending)}
            >
              {playbackPending === 'shuffle' ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
              Shuffle Photos
            </Button>
          </CardContent>
        </Card>

        {/* Brightness */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Brightness</CardTitle>
              <div className="flex items-center gap-1.5 bg-primary/15 rounded-full px-3 py-1">
                {brightnessSync === 'saving'
                  ? <Loader2 size={13} className="text-primary animate-spin" />
                  : <Sun size={13} className="text-primary" />}
                <span className="text-sm font-bold text-primary">{brightness}%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Slider
              min={5} max={100} step={1}
              value={[brightness]}
              onValueChange={(vals) => scheduleBrightness(Number(Array.isArray(vals) ? vals[0] : vals))}
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
            <p className={cn(
              'text-xs min-h-4',
              brightnessSync === 'error' ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {brightnessSync === 'saving'
                ? 'Syncing to TV...'
                : brightnessSync === 'saved'
                ? 'Brightness saved'
                : brightnessSync === 'error'
                ? 'Could not sync brightness'
                : ' '}
            </p>
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
