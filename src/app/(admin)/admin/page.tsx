'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import {
  SkipForward, SkipBack, Pause, Play, Tv, Sun, Radio, Clock,
  CheckCircle2, AlertCircle, Send, Zap,
  CalendarDays, Star, Shuffle, MonitorSmartphone, Loader2, Info,
  Link2, Copy, RefreshCw, Trash2, Wifi, MapPin, Monitor, QrCode,
  Minus, Plus, Settings, SlidersHorizontal,
} from 'lucide-react';
import ModePickerSheet from '@/components/admin/ModePickerSheet';
import AccordionSection from '@/components/admin/AccordionSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { invalidateModes } from '@/hooks/useModes';
import type { DisplayState, Album, Schedule, Mode, DisplayDevice } from '@/types/db';
import PageGuide from '@/components/admin/PageGuide';
import PairTvForm from '@/components/admin/PairTvForm';
import { SCRAPBOOK_BACKGROUNDS } from '@/modes/scrapbook/ScrapbookMode';
import { Modal } from '@/components/admin/Modal';
import { MODE_CATEGORY_BY_ID, MODE_METADATA, MODE_ORDER } from '@/lib/modeMetadata';

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

// Grid mode cycles individual cells rather than dwelling on one full-screen
// photo, so much shorter intervals read naturally — hence its own scale.
const GRID_INTERVAL_OPTIONS = [
  { label: '5s',  value: 5 },
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1m',  value: 60 },
  { label: '2m',  value: 120 },
  { label: '5m',  value: 300 },
];

const GRID_CELL_OPTIONS = [
  { label: '3',  value: 3 },
  { label: '6',  value: 6 },
  { label: '8',  value: 8 },
  { label: '9',  value: 9 },
  { label: '12', value: 12 },
];

const MODES_WITH_SETTINGS = new Set([
  'slideshow-single', 'slideshow-grid', 'pinterest', 'scrapbook',
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

function smartDeviceLabel(device: DisplayDevice) {
  if (device.label) return device.label;
  if (device.device_name) return device.device_name;
  const browser = device.browser && device.browser !== 'Unknown' ? device.browser : null;
  const os = device.os && device.os !== 'Unknown' ? device.os : null;
  if (browser && os) return `${os} · ${browser}`;
  return browser ?? os ?? 'Unknown Device';
}

function timeAgo(ts: string, now: number) {
  const diff = Math.max(0, now - new Date(ts).getTime());
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

function watchDuration(firstSeenAt: string | null | undefined, now: number) {
  if (!firstSeenAt) return null;
  const ms = Math.max(0, now - new Date(firstSeenAt).getTime());
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function deviceTypeIcon(device: DisplayDevice) {
  const t = device.device_type;
  if (t === 'tv') return <Tv size={14} className="shrink-0" />;
  if (t === 'mobile') return <MonitorSmartphone size={14} className="shrink-0" />;
  return <Monitor size={14} className="shrink-0" />;
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

function GridQuickSettings({ cfg, onChange }: { cfg: Cfg; onChange: (c: Cfg) => void }) {
  const intervalSec = (cfg.cellIntervalSeconds as number) ?? (cfg.intervalSeconds as number) ?? 30;
  const closest = GRID_INTERVAL_OPTIONS.reduce((p, c) =>
    Math.abs(c.value - intervalSec) < Math.abs(p.value - intervalSec) ? c : p
  );
  const maxCells = (cfg.maxCells as number) ?? 6;
  const closestCells = GRID_CELL_OPTIONS.reduce((p, c) =>
    Math.abs(c.value - maxCells) < Math.abs(p.value - maxCells) ? c : p
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Cell interval</p>
        <ChipRow
          options={GRID_INTERVAL_OPTIONS}
          value={closest.value}
          onSelect={(v) => onChange({ ...cfg, cellIntervalSeconds: v, intervalSeconds: undefined })}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Photos on screen</p>
        <ChipRow
          options={GRID_CELL_OPTIONS}
          value={closestCells.value}
          onSelect={(v) => onChange({ ...cfg, maxCells: v })}
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

function ScrapbookQuickSettings({ cfg, onChange }: { cfg: Cfg; onChange: (c: Cfg) => void }) {
  const intervalSec = (cfg.intervalSeconds as number) ?? 6;
  const maxOnScreen = (cfg.maxOnScreen as number) ?? 7;
  const tapeFrequency = typeof cfg.tapeFrequency === 'number' ? cfg.tapeFrequency : 0.35;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Toss interval</p>
        <ChipRow
          options={[
            { label: '1s', value: 1 },
            { label: '2s', value: 2 },
            { label: '3s', value: 3 },
            { label: '6s', value: 6 },
            { label: '10s', value: 10 },
            { label: '20s', value: 20 },
          ]}
          value={intervalSec}
          onSelect={(v) => onChange({ ...cfg, intervalSeconds: v })}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Polaroids on screen</p>
        <ChipRow
          options={[
            { label: '4', value: 4 },
            { label: '7', value: 7 },
            { label: '10', value: 10 },
            { label: '14', value: 14 },
            { label: '20', value: 20 },
            { label: '25', value: 25 },
            { label: '30', value: 30 },
          ]}
          value={maxOnScreen}
          onSelect={(v) => onChange({ ...cfg, maxOnScreen: v })}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Washi tape</p>
        <ChipRow
          options={[
            { label: 'None', value: 0 },
            { label: 'A little', value: 0.2 },
            { label: 'Some', value: 0.35 },
            { label: 'Lots', value: 0.6 },
          ]}
          value={tapeFrequency}
          onSelect={(v) => onChange({ ...cfg, tapeFrequency: v })}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Background</p>
        <ChipRow
          options={Object.entries(SCRAPBOOK_BACKGROUNDS).map(([value, meta]) => ({ label: meta.label, value }))}
          value={(cfg.background as string) ?? 'plain'}
          onSelect={(v) => onChange({ ...cfg, background: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Show date caption</span>
        <Switch
          checked={(cfg.showDate as boolean) ?? true}
          onCheckedChange={(v) => onChange({ ...cfg, showDate: v })}
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
      return <SlideshowQuickSettings cfg={cfg} onChange={onChange} />;
    case 'slideshow-grid':
      return <GridQuickSettings cfg={cfg} onChange={onChange} />;
    case 'pinterest':
      return <PinterestQuickSettings cfg={cfg} onChange={onChange} />;
    case 'scrapbook':
      return <ScrapbookQuickSettings cfg={cfg} onChange={onChange} />;
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

// ─── Share Live Link ──────────────────────────────────────────────────────────

function ShareLinkCard({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [token, setToken]         = useState<string | null | undefined>(undefined);
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const copiedTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/share').then((r) => r.json()).then((j) => setToken(j.token ?? null));
    return () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); };
  }, []);

  const shareUrl = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${token}` : null;

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/share', { method: 'POST' });
      const json = await res.json();
      setToken(json.token ?? null);
    } finally {
      setLoading(false);
    }
  };

  const revoke = async () => {
    setLoading(true);
    try {
      await fetch('/api/share', { method: 'DELETE' });
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AccordionSection
      icon={<Link2 size={14} className="text-primary shrink-0" />}
      label="Share Live Link"
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Anyone with this link can view your display live — no sign-in needed.
        </p>

        {token === undefined ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        ) : token ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-2 font-mono text-xs text-muted-foreground truncate select-all">
              {shareUrl}
            </div>
            <Button
              size="sm"
              variant="outline"
              className={cn('shrink-0 gap-1.5', copied && 'border-green-500/40 text-green-400')}
              onClick={copy}
            >
              {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={generate}
              disabled={loading}
              title="Regenerate link (old link will stop working)"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
              onClick={revoke}
              disabled={loading}
              title="Revoke link"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ) : null}

        {token && (
          <a href="/screensaver/authorize" target="_blank" rel="noopener noreferrer" className="block">
            <Button size="sm" variant="ghost" className="w-full gap-1.5 text-muted-foreground">
              <Monitor size={13} />
              Set up Mac Screensaver
            </Button>
          </a>
        )}

        {token === null && (
          <Button size="sm" onClick={generate} disabled={loading} className="gap-2">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
            Generate live link
          </Button>
        )}
      </div>
    </AccordionSection>
  );
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
  const [myClientId, setMyClientId]         = useState<string | null>(null);
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
  const [statusOpen, setStatusOpen]         = useState(false);
  const [pairOpen, setPairOpen]             = useState(false);
  const [shareOpen, setShareOpen]           = useState(false);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [brightnessFineOpen, setBrightnessFineOpen] = useState(false);

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

  // ── Admin device heartbeat ─────────────────────────────────────────────────
  useEffect(() => {
    let clientId = localStorage.getItem('frametv_admin_client_id');
    if (!clientId) {
      clientId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('frametv_admin_client_id', clientId);
    }
    setMyClientId(clientId);

    const sendBeat = () => {
      fetch('/api/display-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          route: 'admin',
          renderer: 'admin-ui',
          viewport_width: window.innerWidth,
          viewport_height: window.innerHeight,
          screen_width: window.screen.width,
          screen_height: window.screen.height,
          device_pixel_ratio: window.devicePixelRatio,
          visibility_state: document.visibilityState,
        }),
      }).catch(() => {});
    };

    sendBeat();
    const interval = setInterval(sendBeat, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Sync modeConfig when active mode or modes list changes. Quick Settings
  // stays collapsed by default (it's Setup, not a Transport control) — it
  // no longer force-opens on every mode change, only explicitly right
  // after the user picks a new mode from the picker (see setMode below).
  useEffect(() => {
    const activeModeId = displayState?.active_mode_id;
    if (!activeModeId) return;
    const found = modes.find((m) => m.id === activeModeId);
    if (found) setModeConfig((found.config as Cfg) ?? {});
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
      // Picking a mode from the picker is the one moment it's worth
      // surfacing its settings — everywhere else Quick Settings stays
      // collapsed (it's Setup, not a control you touch every visit).
      setModePickerOpen(false);
      setQuickOpen(MODES_WITH_SETTINGS.has(modeId));
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
  // Separate display viewers from admin browsers
  const viewerDevices = displayDevices.filter((d) => d.route !== 'admin');
  const activeViewers = viewerDevices.filter((d) => deviceNow - new Date(d.last_seen_at).getTime() < 90_000);
  const liveDevice = activeViewers[0] ?? viewerDevices[0] ?? activeDevices[0] ?? displayDevices[0] ?? null;
  const htmlTvUnsupportedMode =
    liveDevice?.renderer === 'html-tv' &&
    Boolean(displayState?.active_mode_id) &&
    !TV_SAFE_MODES.has(displayState?.active_mode_id ?? '');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">

      <PageGuide
        pageKey="remote"
        icon={<Tv size={18} className="text-primary" />}
        title="Remote"
        about="This is your TV remote, laid out like one: Play/Pause and skip first, brightness next, then what's on screen — all reachable without scrolling. Setup (quick settings, devices, share link) lives collapsed below."
        steps={[
          'Play/Pause, Prev/Next, and Shuffle are always right at the top.',
          'Use the brightness rocker to dim the display at night.',
          'Tap the mode card\'s "Change" to open the full mode picker.',
          'Tap an album pill to toggle it active without leaving this page.',
          'Quick Settings, Devices, and Share Link are one tap away, collapsed by default.',
        ]}
      />

      {/* ── Sticky status strip ── */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-2.5 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3">
        {activeMode ? (
          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg border', modeTone(activeMode.id).iconBg, modeTone(activeMode.id).iconBorder, modeTone(activeMode.id).text)}>
            <ModeIcon mode={activeMode} size={14} />
          </span>
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <Tv size={13} className="text-muted-foreground" />
          </span>
        )}
        <p className="flex-1 min-w-0 text-sm font-semibold truncate">
          {activeMode?.label ?? 'No mode'}
          {pendingModeId && <Loader2 size={11} className="inline ml-1.5 animate-spin text-primary" />}
        </p>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-xs gap-1',
            isPaused
              ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
              : 'bg-green-500/20 text-green-300 border-green-500/30'
          )}
        >
          <Radio size={9} className={isPaused ? '' : 'animate-pulse'} />
          {isPaused ? 'Paused' : 'Playing'}
        </Badge>
        {!isConnected && (
          <span className="shrink-0 flex items-center gap-1 text-xs text-yellow-400">
            <AlertCircle size={12} /> No DB
          </span>
        )}
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-bold tracking-tight">Remote</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPairOpen(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1.5 hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <QrCode size={11} /> Pair a TV
          </button>
          <a
            href="/display"
            target="_blank"
            className="flex items-center gap-1 text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1.5 hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Tv size={11} /> Open ↗
          </a>
        </div>
      </div>

      <Modal open={pairOpen} onOpenChange={setPairOpen} title="Pair a TV">
        <PairTvForm />
      </Modal>

      {/* ── Error banners ── */}
      {fetchError && (
        <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-sm text-yellow-200">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-yellow-400" />
          <div>
            <p className="font-medium text-xs">Not connected to database</p>
            <p className="text-xs text-yellow-300/80 mt-0.5">{fetchError}</p>
          </div>
        </div>
      )}
      {actionError && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-sm text-destructive">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <p className="text-xs">{actionError}</p>
        </div>
      )}

      {/* ── 1. Transport ── */}
      <Card>
        <CardContent className="pt-5 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Transport</p>
            {activeMode && MODES_WITH_SETTINGS.has(activeMode.id) && (
              <button
                type="button"
                onClick={() => setQuickOpen((o) => !o)}
                title={`Settings · ${activeMode.label}`}
                className="flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Settings size={15} />
              </button>
            )}
          </div>
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
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="lg" className="h-12 gap-1.5" onClick={prevPhoto}
              disabled={!displayState || isPaused || Boolean(playbackPending)}>
              {playbackPending === 'prev' ? <Loader2 size={16} className="animate-spin" /> : <SkipBack size={16} />}
              Prev
            </Button>
            <Button variant="outline" size="lg" className="h-12 gap-1.5" onClick={nextPhoto}
              disabled={!displayState || isPaused || Boolean(playbackPending)}>
              {playbackPending === 'next' ? <Loader2 size={16} className="animate-spin" /> : <SkipForward size={16} />}
              Next
            </Button>
            <Button variant="outline" size="lg"
              className="h-12 gap-1.5 border-violet-500/40 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 hover:border-violet-400"
              onClick={reshufflePhotos}
              disabled={!displayState || Boolean(playbackPending)}>
              {playbackPending === 'shuffle' ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
              Shuffle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Level (brightness rocker) ── */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-2">
            <Sun size={16} className="text-primary shrink-0" />
            <Button
              variant="outline" size="icon" className="size-9 shrink-0 rounded-full"
              onClick={() => scheduleBrightness(Math.max(5, brightness - 5))}
              disabled={!displayState || brightness <= 5}
            >
              <Minus size={15} />
            </Button>
            <div className="flex-1 text-center">
              <span className="text-base font-bold text-primary tabular-nums">{brightness}%</span>
            </div>
            <Button
              variant="outline" size="icon" className="size-9 shrink-0 rounded-full"
              onClick={() => scheduleBrightness(Math.min(100, brightness + 5))}
              disabled={!displayState || brightness >= 100}
            >
              <Plus size={15} />
            </Button>
            <button
              type="button"
              onClick={() => setBrightnessFineOpen((o) => !o)}
              title="Fine-tune"
              className={cn(
                'flex items-center justify-center size-9 shrink-0 rounded-full border transition-colors',
                brightnessFineOpen ? 'border-primary/50 text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>

          {brightnessFineOpen && (
            <div className="space-y-2 mt-3 pt-3 border-t border-border">
              <div className="relative h-8 rounded-xl overflow-hidden bg-gradient-to-r from-zinc-900 via-zinc-600 to-yellow-200">
                <div className="absolute inset-0 bg-black transition-none" style={{ opacity: (100 - brightness) / 100 * 0.85 }} />
              </div>
              <Slider
                min={5} max={100} step={1}
                value={[brightness]}
                onValueChange={(vals) => scheduleBrightness(Number(Array.isArray(vals) ? vals[0] : vals))}
                onValueCommitted={(vals) => commitBrightness(Number(Array.isArray(vals) ? vals[0] : vals))}
                className="w-full [&_[role=slider]]:h-6 [&_[role=slider]]:w-6 [&_[data-orientation=horizontal]]:h-3"
                disabled={!displayState}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Dim</span>
                <p className={cn('text-xs', brightnessSync === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
                  {brightnessSync === 'saving' ? 'Syncing…' : brightnessSync === 'saved' ? 'Saved ✓' : brightnessSync === 'error' ? 'Could not sync' : ''}
                </p>
                <span>Full</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Source (mode chip + album pills) ── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            {activeMode ? (
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg border', modeTone(activeMode.id).iconBg, modeTone(activeMode.id).iconBorder, modeTone(activeMode.id).text)}>
                <ModeIcon mode={activeMode} size={17} />
              </span>
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                <Tv size={16} className="text-muted-foreground" />
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{activeMode?.label ?? 'No mode'}</p>
              <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                {activeAlbums.length > 0 ? activeAlbums.map((a) => a.name).join(', ') : 'No albums active'}
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setModePickerOpen(true)}>
              Change
            </Button>
          </div>

          {htmlTvUnsupportedMode && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2.5 text-yellow-200">
              <Info size={13} className="mt-0.5 shrink-0 text-yellow-300" />
              <p className="text-xs leading-relaxed">
                TV-safe renderer active. {activeMode?.label} is not supported — the TV will show a compatibility notice.
              </p>
            </div>
          )}

          {visibleAlbums.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
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
                      'flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-full text-xs font-medium transition-all border',
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
          )}
          {pendingAlbumIds.size > 0 && (
            <p className="text-xs text-primary">Syncing album selection to TV…</p>
          )}
        </CardContent>
      </Card>

      <ModePickerSheet
        open={modePickerOpen}
        onOpenChange={setModePickerOpen}
        modes={MODES}
        activeModeId={displayState?.active_mode_id}
        pendingModeId={pendingModeId}
        loading={loading}
        onSelectMode={setMode}
      />

      {/* ── 4. Setup (collapsed by default) ── */}
      <div className="space-y-2 pb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Setup</p>

        <AccordionSection
          icon={<Info size={14} className="text-primary shrink-0" />}
          label="Status"
          open={statusOpen}
          onOpenChange={setStatusOpen}
          meta={
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {isConnected
                ? <><CheckCircle2 size={12} className="text-green-500" /> Live</>
                : <><AlertCircle size={12} className="text-yellow-500" /> No DB</>}
            </span>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-muted-foreground" />
                <span className="text-sm">Clock</span>
                <Switch checked={clockConfig.enabled} onCheckedChange={toggleClock} disabled={!isConnected} />
              </div>
              {nextSchedule && (
                <div className="flex items-center gap-2">
                  <CalendarDays size={13} className="text-muted-foreground" />
                  <span className="text-sm truncate max-w-[120px]">{nextSchedule.name}</span>
                  <Switch checked={nextSchedule.is_enabled} onCheckedChange={() => toggleSchedule(nextSchedule)} />
                </div>
              )}
            </div>
            {lastUpdated && (
              <p className="text-[11px] text-muted-foreground/50 text-right">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </AccordionSection>

        {activeMode && (
          <AccordionSection
            icon={<Zap size={14} className="text-primary shrink-0" />}
            label={`Settings · ${activeMode.label}`}
            open={quickOpen}
            onOpenChange={setQuickOpen}
            meta={
              <>
                {quickSaveStatus === 'saving' && <Loader2 size={11} className="animate-spin text-primary" />}
                {quickSaveStatus === 'saved' && <span className="text-xs text-green-500">Saved</span>}
                {quickSaveStatus === 'error' && <span className="text-xs text-destructive">Error</span>}
              </>
            }
          >
            <QuickSettingsContent
              modeId={activeMode.id}
              cfg={modeConfig}
              onChange={handleModeConfigChange}
            />
          </AccordionSection>
        )}

        <AccordionSection
          icon={<MonitorSmartphone size={14} className="text-primary shrink-0" />}
          label="Viewing devices"
          open={devicesOpen}
          onOpenChange={setDevicesOpen}
          meta={
            activeDevices.length > 0 && (
              <span className={cn('text-xs font-medium', activeViewers.length > 0 ? 'text-green-400' : 'text-muted-foreground')}>
                {activeViewers.length} live
              </span>
            )
          }
        >
          {displayDevices.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Open the display on a TV or browser to see devices here.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Display viewers */}
              {viewerDevices.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium px-1">Display viewers</p>
                  {viewerDevices.slice(0, 10).map((device) => {
                    const active = deviceNow - new Date(device.last_seen_at).getTime() < 90_000;
                    const duration = active ? watchDuration(device.first_seen_at, deviceNow) : null;
                    const unsupported = device.renderer === 'html-tv' && Boolean(device.active_mode_id) && !TV_SAFE_MODES.has(device.active_mode_id ?? '');
                    const location = [device.city, device.country].filter(Boolean).join(', ');
                    return (
                      <div
                        key={device.id}
                        className={cn(
                          'bg-card rounded-xl border p-3 space-y-1.5',
                          unsupported ? 'border-yellow-500/30' : active ? 'border-green-500/20' : 'border-border'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', active ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40')} />
                            <span className="text-muted-foreground shrink-0">{deviceTypeIcon(device)}</span>
                            <p className="text-sm font-semibold truncate">{smartDeviceLabel(device)}</p>
                          </div>
                          {active
                            ? <span className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/30 rounded-full px-2 py-0.5 shrink-0">{duration ?? 'Live'}</span>
                            : <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(device.last_seen_at, deviceNow)}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {[device.browser, device.os, rendererLabel(device.renderer), device.active_mode_id].filter(Boolean).join(' · ')}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {device.ip && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70 font-mono">
                              <Wifi size={9} />{device.ip}
                            </span>
                          )}
                          {location && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                              <MapPin size={9} />{location}
                            </span>
                          )}
                          {device.viewport_width && (
                            <span className="text-[11px] text-muted-foreground/70">
                              {device.viewport_width}×{device.viewport_height}{device.fullscreen_active ? ' · fs' : ''}
                            </span>
                          )}
                        </div>
                        {unsupported && <p className="text-xs text-yellow-300">Needs full renderer for this mode.</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Admin browsers */}
              {displayDevices.filter((d) => d.route === 'admin').length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium px-1">Admin browsers</p>
                  {displayDevices.filter((d) => d.route === 'admin').map((device) => {
                    const active = deviceNow - new Date(device.last_seen_at).getTime() < 90_000;
                    const isMe = device.client_id === myClientId;
                    const location = [device.city, device.country].filter(Boolean).join(', ');
                    return (
                      <div key={device.id} className={cn('bg-card rounded-xl border p-3 space-y-1.5', isMe ? 'border-primary/30' : 'border-border')}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', active ? 'bg-primary' : 'bg-muted-foreground/40')} />
                            <span className="text-muted-foreground shrink-0">{deviceTypeIcon(device)}</span>
                            <p className="text-sm font-semibold truncate">{smartDeviceLabel(device)}</p>
                            {isMe && <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 rounded-full px-2 py-0.5 shrink-0">You</span>}
                          </div>
                          <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(device.last_seen_at, deviceNow)}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          <p className="text-xs text-muted-foreground">{[device.browser, device.os].filter(Boolean).join(' · ')}</p>
                          {device.ip && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70 font-mono">
                              <Wifi size={9} />{device.ip}
                            </span>
                          )}
                          {location && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                              <MapPin size={9} />{location}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </AccordionSection>

        <ShareLinkCard open={shareOpen} onOpenChange={setShareOpen} />
      </div>
    </div>
  );
}
