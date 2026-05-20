'use client';

import { useCallback, useEffect, useState } from 'react';
import { Settings2, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { invalidateModes } from '@/hooks/useModes';
import type { Mode } from '@/types/db';

// Interval options in seconds
const INTERVAL_OPTIONS: { label: string; value: number }[] = [
  { label: '30 seconds', value: 30   },
  { label: '1 minute',   value: 60   },
  { label: '2 minutes',  value: 120  },
  { label: '3 minutes',  value: 180  },
  { label: '5 minutes',  value: 300  },
  { label: '10 minutes', value: 600  },
  { label: '12 minutes', value: 720  },
  { label: '15 minutes', value: 900  },
  { label: '20 minutes', value: 1200 },
  { label: '30 minutes', value: 1800 },
];

function SlideshowConfig({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  // Read intervalSeconds; fall back to legacy 'interval' key if present, then default 300s (5 min)
  const intervalSec = (cfg.intervalSeconds as number) ?? (cfg.interval as number) ?? 300;
  // Find closest option value
  const closestOption = INTERVAL_OPTIONS.reduce((prev, cur) =>
    Math.abs(cur.value - intervalSec) < Math.abs(prev.value - intervalSec) ? cur : prev
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Photo interval</Label>
        <Select
          value={String(closestOption.value)}
          onValueChange={(v) => onChange({ ...cfg, intervalSeconds: Number(v), interval: undefined })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Transition</Label>
        <Select
          value={(cfg.transition as string) ?? 'fade'}
          onValueChange={(v) => onChange({ ...cfg, transition: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {['fade', 'slide', 'blur', 'pixelate'].map((t) => (
              <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label>Shuffle photos</Label>
        <Switch
          checked={(cfg.shuffle as boolean) ?? true}
          onCheckedChange={(v) => onChange({ ...cfg, shuffle: v })}
        />
      </div>
    </div>
  );
}

function PinterestConfig({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  // Normalise legacy string speed ("0.5x", "1x", "2x") to number
  const speedNum = typeof cfg.speed === 'number'
    ? cfg.speed
    : typeof cfg.speed === 'string'
      ? (parseFloat(cfg.speed as string) || 1)
      : 1;
  // Normalise legacy reverse_direction boolean to direction string
  const direction = typeof cfg.direction === 'string'
    ? cfg.direction
    : (cfg.reverse_direction ? 'right' : 'left');

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Scroll speed</Label>
        <Select
          value={String(speedNum)}
          onValueChange={(v) => onChange({ ...cfg, speed: Number(v), reverse_direction: undefined })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0.25">0.25× Very slow</SelectItem>
            <SelectItem value="0.5">0.5× Slow</SelectItem>
            <SelectItem value="1">1× Normal</SelectItem>
            <SelectItem value="2">2× Fast</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Rows</Label>
        <Select
          value={String((cfg.rows as number) ?? 3)}
          onValueChange={(v) => onChange({ ...cfg, rows: Number(v) })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2, 3, 4].map((r) => (
              <SelectItem key={r} value={String(r)}>{r} rows</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label>Reverse direction</Label>
        <Switch
          checked={direction === 'right'}
          onCheckedChange={(v) => onChange({ ...cfg, direction: v ? 'right' : 'left', reverse_direction: undefined })}
        />
      </div>
    </div>
  );
}

function ClockConfig({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Theme</Label>
        <Select
          value={(cfg.theme as string) ?? 'dark'}
          onValueChange={(v) => onChange({ ...cfg, theme: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {['dark', 'light', 'nude', 'cream'].map((t) => (
              <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Font size</Label>
          <span className="text-sm font-semibold text-primary">{(cfg.font_size as number) ?? 80}px</span>
        </div>
        <Slider
          min={40} max={200} step={4}
          value={[(cfg.font_size as number) ?? 80]}
          onValueChange={(v) => onChange({ ...cfg, font_size: Number(Array.isArray(v) ? v[0] : v) })}
        />
      </div>
    </div>
  );
}

function FlipboardConfig({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  const sources = (cfg.sources as string[]) ?? ['messages', 'reminders', 'quotes'];
  const toggleSource = (s: string) => {
    onChange({ ...cfg, sources: sources.includes(s) ? sources.filter((x) => x !== s) : [...sources, s] });
  };
  // secondsPerMessage — same interval options as slideshow
  const secondsPerMsg = (cfg.secondsPerMessage as number) ?? (cfg.seconds_per_message as number) ?? 60;
  const closestOpt = INTERVAL_OPTIONS.reduce((prev, cur) =>
    Math.abs(cur.value - secondsPerMsg) < Math.abs(prev.value - secondsPerMsg) ? cur : prev
  );

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Sources</Label>
        <div className="flex flex-wrap gap-1.5">
          {['messages', 'reminders', 'quotes', 'calendar', 'weather'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSource(s)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all border',
                sources.includes(s)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-muted-foreground hover:border-primary/50'
              )}
            >
              {{ messages: 'Live Messages', reminders: 'Reminders', quotes: 'Quotes', calendar: 'Calendar', weather: 'Weather' }[s] ?? s}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Time per message</Label>
        <Select
          value={String(closestOpt.value)}
          onValueChange={(v) => onChange({ ...cfg, secondsPerMessage: Number(v), seconds_per_message: undefined })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label>Sound effects</Label>
        <Switch
          checked={!!(cfg.sound)}
          onCheckedChange={(v) => onChange({ ...cfg, sound: v })}
        />
      </div>
    </div>
  );
}

function UnsplashConfig({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  const intervalSeconds = (cfg.intervalSeconds as number) ?? 120;
  const intervalMins = Math.round(intervalSeconds / 60);
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Mood / keywords</Label>
        <Input
          value={(cfg.mood as string) ?? ''}
          onChange={(e) => onChange({ ...cfg, mood: e.target.value })}
          placeholder="nature, minimal, cozy…"
        />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Photo interval</Label>
          <span className="text-sm font-semibold text-primary">{intervalMins} min</span>
        </div>
        <Slider
          min={120} max={1800} step={60}
          value={[intervalSeconds]}
          onValueChange={(v) => onChange({ ...cfg, intervalSeconds: Number(Array.isArray(v) ? v[0] : v) })}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>2 min</span><span>30 min</span>
        </div>
      </div>
    </div>
  );
}

function EaselConfig({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  const texts = ((cfg.texts as string[]) ?? []).join('\n');
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Texts (one per line)</Label>
        <Textarea
          value={texts}
          onChange={(e) => onChange({ ...cfg, texts: e.target.value.split('\n').filter(Boolean) })}
          rows={5}
          placeholder={"Good morning!\nHave a great day."}
          className="font-mono resize-none"
        />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Interval</Label>
          <span className="text-sm font-semibold text-primary">{(cfg.interval_minutes as number) ?? 5} min</span>
        </div>
        <Slider
          min={1} max={60} step={1}
          value={[(cfg.interval_minutes as number) ?? 5]}
          onValueChange={(v) => onChange({ ...cfg, interval_minutes: Number(Array.isArray(v) ? v[0] : v) })}
        />
      </div>
    </div>
  );
}

function ModeConfigForm({ mode, cfg, onChange }: { mode: Mode; cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  switch (mode.id) {
    case 'slideshow-single':
    case 'slideshow-grid':
      return <SlideshowConfig cfg={cfg} onChange={onChange} />;
    case 'pinterest':
      return <PinterestConfig cfg={cfg} onChange={onChange} />;
    case 'clock-text':
      return <ClockConfig cfg={cfg} onChange={onChange} />;
    case 'flipboard':
      return <FlipboardConfig cfg={cfg} onChange={onChange} />;
    case 'unsplash-mood':
      return <UnsplashConfig cfg={cfg} onChange={onChange} />;
    case 'easel':
      return <EaselConfig cfg={cfg} onChange={onChange} />;
    case 'eisenhower':
      return (
        <div className="text-sm text-muted-foreground">
          No configuration needed. Tasks are pulled from the Reminders board.
        </div>
      );
    default:
      return (
        <div className="space-y-1.5">
          <Label>Config JSON</Label>
          <Textarea
            value={JSON.stringify(cfg, null, 2)}
            onChange={(e) => {
              try { onChange(JSON.parse(e.target.value)); } catch { /* invalid JSON */ }
            }}
            rows={8}
            className="font-mono resize-none"
          />
        </div>
      );
  }
}

const MODE_DISPLAY: Record<string, { label: string; description: string; emoji: string }> = {
  'slideshow-single': { label: 'Slideshow', description: 'One photo at a time with smooth transitions', emoji: '🖼️' },
  'slideshow-grid':   { label: 'Grid',      description: 'Mosaic grid of photos', emoji: '🔲' },
  'pinterest':        { label: 'Pinterest', description: 'Scrolling masonry columns', emoji: '📌' },
  'clock-text':       { label: 'Clock',     description: 'Large ambient clock display', emoji: '🕐' },
  'flipboard':        { label: 'FlipBoard', description: 'News-ticker style messages', emoji: '🔤' },
  'coverflow':        { label: 'Cover Flow',description: '3D cover flow carousel', emoji: '🎵' },
  'unsplash-mood':    { label: 'Mood',      description: 'Curated Unsplash photos by mood', emoji: '🌄' },
  'easel':            { label: 'Easel',     description: 'Rotating text messages', emoji: '✍️' },
  'eisenhower':       { label: 'Eisenhower', description: 'Matrix of tasks in 4 priority quadrants', emoji: '🧩' },
};

export default function ModesPage() {
  const [modes, setModes] = useState<Mode[]>([]);
  const [loading, setLoading] = useState(true);
  const [configModal, setConfigModal] = useState<{ mode: Mode; cfg: Record<string, unknown> } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchModes = useCallback(async () => {
    try {
      const res = await fetch('/api/modes');
      if (res.ok) {
        const json = await res.json();
        setModes(Array.isArray(json) ? json : (json.modes ?? []));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchModes(); }, [fetchModes]);

  const openConfig = (mode: Mode) => {
    setConfigModal({ mode, cfg: (mode.config as Record<string, unknown>) ?? {} });
  };

  const saveConfig = async () => {
    if (!configModal) return;
    setSaving(true);
    try {
      await fetch(`/api/modes/${configModal.mode.id}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configModal.cfg),
      });
      setModes((prev) =>
        prev.map((m) => m.id === configModal.mode.id ? { ...m, config: configModal.cfg } : m)
      );
      invalidateModes(); // push update to display page cache
      setConfigModal(null);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (mode: Mode) => {
    const next = !mode.is_enabled;
    setModes((prev) => prev.map((m) => m.id === mode.id ? { ...m, is_enabled: next } : m));
    await fetch(`/api/modes/${mode.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: next }),
    });
  };

  const displayModes = modes.length > 0
    ? modes
    : Object.entries(MODE_DISPLAY).map(([id, d]) => ({
        id, name: d.label, description: d.description, is_enabled: true, config: {},
      } as Mode));

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Modes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {displayModes.filter(m => m.is_enabled).length} of {displayModes.length} modes enabled
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {displayModes.map((mode) => {
            const display = MODE_DISPLAY[mode.id];
            return (
              <Card key={mode.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl shrink-0">{display?.emoji ?? '⚙️'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{display?.label ?? mode.name}</h3>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            mode.is_enabled
                              ? 'border-green-500/40 text-green-400 bg-green-500/10'
                              : 'border-border text-muted-foreground'
                          )}
                        >
                          {mode.is_enabled ? 'On' : 'Off'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {display?.description ?? (mode as Mode & { description?: string }).description ?? 'No description'}
                      </p>
                      {mode.config && Object.keys(mode.config as object).length > 0 && (
                        <p className="text-xs text-muted-foreground/50 mt-1 truncate font-mono">
                          {Object.entries(mode.config as Record<string, unknown>).slice(0, 3).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Switch
                        checked={mode.is_enabled}
                        onCheckedChange={() => toggleEnabled(mode)}
                      />
                      <Button size="sm" variant="outline" onClick={() => openConfig(mode)} className="gap-1.5 text-xs">
                        <Settings2 size={12} /> Configure
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!configModal} onOpenChange={(open) => { if (!open) setConfigModal(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {configModal && (MODE_DISPLAY[configModal.mode.id]?.emoji ?? '⚙️')} Configure{' '}
              {configModal && (MODE_DISPLAY[configModal.mode.id]?.label ?? configModal.mode.name)}
            </DialogTitle>
            <DialogDescription>Adjust settings for this display mode.</DialogDescription>
          </DialogHeader>
          {configModal && (
            <div className="py-2">
              <ModeConfigForm
                mode={configModal.mode}
                cfg={configModal.cfg}
                onChange={(cfg) => setConfigModal((prev) => prev ? { ...prev, cfg } : null)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigModal(null)}>Cancel</Button>
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
