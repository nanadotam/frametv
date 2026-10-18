'use client';

// Per-look quick settings (interval, layout, background…) shown in the
// Customize sheet on Now and Looks. Each writes the look's config through
// `onChange`; the caller debounces and persists.

import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SCRAPBOOK_BACKGROUNDS } from '@/modes/scrapbook/ScrapbookMode';


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

export const MODES_WITH_SETTINGS = new Set([
  'slideshow-single', 'slideshow-grid', 'pinterest', 'scrapbook',
  'clock-text', 'flipboard', 'unsplash-mood', 'easel',
  'vinyl', 'scripture', 'video',
]);

function ChipRow<T extends string | number>({
  options, value, onSelect,
}: {
  options: { label: string; value: T }[];
  value: T;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onSelect(o.value)}
          className={cn(
            'pressable h-9 rounded-full px-3.5 text-[15px] font-medium transition-colors',
            value === o.value ? 'bg-tint text-white' : 'bg-fill text-label'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type Cfg = Record<string, unknown>;

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-sm font-medium">Multimodal</span>
          <p className="text-xs text-muted-foreground mt-0.5">Mix in videos from the active albums.</p>
        </div>
        <Switch
          checked={(cfg.multimodal as boolean) ?? false}
          onCheckedChange={(v) => onChange({ ...cfg, multimodal: v })}
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

const PINTEREST_INTERVALS = [
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

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
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Change photos every</p>
        <ChipRow
          options={PINTEREST_INTERVALS}
          value={(cfg.intervalSeconds as number) ?? 120}
          onSelect={(v) => onChange({ ...cfg, intervalSeconds: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Reverse direction</span>
        <Switch
          checked={direction === 'right'}
          onCheckedChange={(v) => onChange({ ...cfg, direction: v ? 'right' : 'left', reverse_direction: undefined })}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-sm font-medium">Multimodal</span>
          <p className="text-xs text-muted-foreground mt-0.5">Mix in videos from the active albums.</p>
        </div>
        <Switch
          checked={(cfg.multimodal as boolean) ?? false}
          onCheckedChange={(v) => onChange({ ...cfg, multimodal: v })}
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

const VIDEO_HOLD_OPTIONS = [
  { label: 'Play once', value: 0 },
  { label: '1 min',     value: 1 },
  { label: '5 min',     value: 5 },
  { label: '15 min',    value: 15 },
  { label: '30 min',    value: 30 },
  { label: '1 hour',    value: 60 },
];

function VideoQuickSettings({ cfg, onChange }: { cfg: Cfg; onChange: (c: Cfg) => void }) {
  const playback = (cfg.playback as string) ?? 'playlist';
  const template = (cfg.template as string) ?? 'normal';
  const isGrid = template === 'grid';
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Template</p>
        <ChipRow
          options={[
            { label: 'Normal',  value: 'normal' },
            { label: 'Old TV',  value: 'crt' },
            { label: 'Fisheye', value: 'fisheye' },
            { label: 'Film',    value: 'film' },
            { label: 'Grid',    value: 'grid' },
          ]}
          value={template}
          onSelect={(v) => onChange({ ...cfg, template: v })}
        />
      </div>
      {isGrid && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Videos on screen</p>
          <ChipRow
            options={[3, 4, 5, 6].map((n) => ({ label: String(n), value: n }))}
            value={(cfg.gridCells as number) ?? 4}
            onSelect={(v) => onChange({ ...cfg, gridCells: v })}
          />
        </div>
      )}
      {!isGrid && <>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Playback</p>
        <ChipRow
          options={[
            { label: 'Play album', value: 'playlist' },
            { label: 'Loop one',   value: 'loop' },
          ]}
          value={playback}
          onSelect={(v) => onChange({ ...cfg, playback: v })}
        />
      </div>
      {playback === 'playlist' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Each video</p>
          <ChipRow
            options={VIDEO_HOLD_OPTIONS}
            value={(cfg.holdMinutes as number) ?? 0}
            onSelect={(v) => onChange({ ...cfg, holdMinutes: v })}
          />
        </div>
      )}
      {template === 'normal' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Fit</p>
          <ChipRow
            options={[
              { label: 'Fill screen', value: 'cover' },
              { label: 'Show whole',  value: 'contain' },
            ]}
            value={(cfg.fit as string) ?? 'cover'}
            onSelect={(v) => onChange({ ...cfg, fit: v })}
          />
        </div>
      )}
      </>}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Shuffle</span>
        <Switch
          checked={(cfg.shuffle as boolean) ?? false}
          onCheckedChange={(v) => onChange({ ...cfg, shuffle: v })}
        />
      </div>
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

export function QuickSettingsContent({
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
    case 'video':
      return <VideoQuickSettings cfg={cfg} onChange={onChange} />;
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
