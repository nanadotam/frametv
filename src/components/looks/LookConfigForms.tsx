'use client';

// Full per-look settings forms (the "Customize" sheet on Looks). The quick
// versions shown on Now live in QuickSettings.tsx.

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/looks/ChoiceChips';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Mode } from '@/types/db';
import { TRANSLATIONS, DEFAULT_MOOD_CATEGORIES } from '@/modes/scripture/constants';

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
        <Label>Change photo every</Label>
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
        <Label>How photos change</Label>
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

// Grid mode cycles individual cells rather than dwelling on one full-screen
// photo, so it needs a faster interval scale than the single-photo slideshow.
const GRID_INTERVAL_OPTIONS: { label: string; value: number }[] = [
  { label: '5 seconds',  value: 5   },
  { label: '10 seconds', value: 10  },
  { label: '30 seconds', value: 30  },
  { label: '1 minute',   value: 60  },
  { label: '2 minutes',  value: 120 },
  { label: '5 minutes',  value: 300 },
];

const GRID_CELL_OPTIONS = [3, 6, 8, 9, 12];

function GridConfig({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  const intervalSec = (cfg.cellIntervalSeconds as number) ?? (cfg.intervalSeconds as number) ?? 30;
  const closestOption = GRID_INTERVAL_OPTIONS.reduce((prev, cur) =>
    Math.abs(cur.value - intervalSec) < Math.abs(prev.value - intervalSec) ? cur : prev
  );
  const maxCells = (cfg.maxCells as number) ?? 6;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Change one tile every</Label>
        <Select
          value={String(closestOption.value)}
          onValueChange={(v) => onChange({ ...cfg, cellIntervalSeconds: Number(v), intervalSeconds: undefined })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {GRID_INTERVAL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Photos on screen</Label>
        <Select
          value={String(maxCells)}
          onValueChange={(v) => onChange({ ...cfg, maxCells: Number(v) })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {GRID_CELL_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>{n} photos</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Layouts always fill the grid with this many photos at once — the mode picks the
          best-fitting mosaic for their aspect ratios instead of falling back to fullscreen.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <Label>Shuffle photos</Label>
        <Switch
          checked={(cfg.shuffle as boolean) ?? true}
          onCheckedChange={(v) => onChange({ ...cfg, shuffle: v })}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>Include videos</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Mix videos from the active albums in with the photos.</p>
        </div>
        <Switch
          checked={(cfg.multimodal as boolean) ?? false}
          onCheckedChange={(v) => onChange({ ...cfg, multimodal: v })}
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
      <div className="space-y-1.5">
        <Label>Change photos every</Label>
        <Select
          value={String((cfg.intervalSeconds as number) ?? 120)}
          onValueChange={(v) => onChange({ ...cfg, intervalSeconds: Number(v) })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 seconds</SelectItem>
            <SelectItem value="60">1 minute</SelectItem>
            <SelectItem value="120">2 minutes</SelectItem>
            <SelectItem value="300">5 minutes</SelectItem>
            <SelectItem value="600">10 minutes</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Videos loop until the page changes — a page always stays up at least as long as its longest clip.</p>
      </div>
      <div className="flex items-center justify-between">
        <Label>Scroll the other way</Label>
        <Switch
          checked={direction === 'right'}
          onCheckedChange={(v) => onChange({ ...cfg, direction: v ? 'right' : 'left', reverse_direction: undefined })}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>Include videos</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Mix videos from the active albums in with the photos.</p>
        </div>
        <Switch
          checked={(cfg.multimodal as boolean) ?? false}
          onCheckedChange={(v) => onChange({ ...cfg, multimodal: v })}
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
        <Label>What to show</Label>
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
        <Label>Mood (e.g. ocean, forest, city)</Label>
        <Input
          value={(cfg.mood as string) ?? ''}
          onChange={(e) => onChange({ ...cfg, mood: e.target.value })}
          placeholder="nature, minimal, cozy…"
        />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Change photo every</Label>
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
        <Label>Messages (one per line)</Label>
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
          <Label>Change message every</Label>
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

function ScriptureConfig({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  const translation = (cfg.translation as string) ?? 'KJV';
  const customMood = (cfg.customMood as string) ?? '';
  const overlayOpacity = (cfg.overlayOpacity as number) ?? 55;
  const showCross = (cfg.showCross as boolean) ?? true;
  const moodMappingOverrides = (cfg.moodMappingOverrides as Record<string, string>) ?? {};

  return (
    <div className="space-y-5">
      {/* Translation */}
      <div className="space-y-1.5">
        <Label>Bible translation</Label>
        <Select
          value={translation}
          onValueChange={(v) => onChange({ ...cfg, translation: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TRANSLATIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Custom Unsplash keyword — overrides auto-detection */}
      <div className="space-y-1.5">
        <Label>Background scenery</Label>
        <Input
          value={customMood}
          onChange={(e) => onChange({ ...cfg, customMood: e.target.value })}
          placeholder="e.g. green valley mountains lake…"
        />
        <p className="text-xs text-muted-foreground">
          Type any Unsplash keyword. Leave blank to auto-pick based on the verse.
        </p>
      </div>

      {/* Overlay darkness */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Background darkness</Label>
          <span className="text-sm font-semibold text-primary">{overlayOpacity}%</span>
        </div>
        <Slider
          min={25} max={85} step={5}
          value={[overlayOpacity]}
          onValueChange={(v) => onChange({ ...cfg, overlayOpacity: Number(Array.isArray(v) ? v[0] : v) })}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Lighter</span><span>Darker</span>
        </div>
      </div>

      {/* Cross icon */}
      <div className="flex items-center justify-between">
        <Label>Show cross icon</Label>
        <Switch
          checked={showCross}
          onCheckedChange={(v) => onChange({ ...cfg, showCross: v })}
        />
      </div>

      {/* Per-theme keyword overrides */}
      <div className="space-y-2">
        <Label>Matching scenery by theme</Label>
        <p className="text-xs text-muted-foreground">
          These are used when no custom keyword is set. Edit the Unsplash queries to fine-tune each mood.
        </p>
        <div className="space-y-2.5 max-h-52 overflow-y-auto rounded-md border p-3 bg-muted/20">
          {DEFAULT_MOOD_CATEGORIES.map((cat) => (
            <div key={cat.id} className="space-y-1">
              <span className="text-xs font-medium text-foreground/60">{cat.label}</span>
              <Input
                className="h-7 text-xs font-mono"
                value={moodMappingOverrides[cat.id] ?? cat.query}
                onChange={(e) => {
                  const next = { ...moodMappingOverrides };
                  if (e.target.value === cat.query) {
                    delete next[cat.id];
                  } else {
                    next[cat.id] = e.target.value;
                  }
                  onChange({ ...cfg, moodMappingOverrides: next });
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VinylConfig({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Background</Label>
        <Select
          value={(cfg.background as string) ?? 'gradient'}
          onValueChange={(v) => onChange({ ...cfg, background: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gradient">Dominant color gradient</SelectItem>
            <SelectItem value="black">Pure black</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Gradient pulls the mood color from the current album art.
        </p>
      </div>
    </div>
  );
}

const VIDEO_HOLD_OPTIONS: { label: string; value: number }[] = [
  { label: 'Play once', value: 0 },
  { label: '1 minute',     value: 1 },
  { label: '5 minutes',     value: 5 },
  { label: '15 minutes',    value: 15 },
  { label: '30 minutes',    value: 30 },
  { label: '1 hour',    value: 60 },
];

const VIDEO_TEMPLATES: { value: string; label: string; hint: string }[] = [
  { value: 'normal',  label: 'Normal',  hint: 'The clip as recorded.' },
  { value: 'crt',     label: 'Old TV',  hint: 'Curved tube, scanlines and a VCR on-screen display.' },
  { value: 'fisheye', label: 'Fisheye', hint: 'A round wide-angle lens with heavy barrel distortion.' },
  { value: 'film',    label: 'Film',    hint: 'Thick cinema bars, grain, warm stock and gate weave.' },
  { value: 'grid',    label: 'Grid',    hint: 'Several clips playing at once in a mosaic.' },
];

function VideoModeConfig({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  const playback = (cfg.playback as string) ?? 'playlist';
  const template = (cfg.template as string) ?? 'normal';
  const isGrid = template === 'grid';
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Style</Label>
        <Select value={template} onValueChange={(v) => onChange({ ...cfg, template: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {VIDEO_TEMPLATES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {VIDEO_TEMPLATES.find((t) => t.value === template)?.hint}
        </p>
      </div>
      {isGrid && (
        <div className="space-y-1.5">
          <Label>Videos on screen</Label>
          <Select
            value={String((cfg.gridCells as number) ?? 4)}
            onValueChange={(v) => onChange({ ...cfg, gridCells: Number(v) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Each tile plays its own clip. Fewer clips than tiles? Repeats start at different points.
          </p>
        </div>
      )}
      {!isGrid && <>
      <div className="space-y-1.5">
        <Label>Playback</Label>
        <Select value={playback} onValueChange={(v) => onChange({ ...cfg, playback: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="playlist">Play the album, one after another</SelectItem>
            <SelectItem value="loop">Loop one video</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Videos come from the active albums. Next/previous on the remote switches clips.
        </p>
      </div>
      {playback === 'playlist' && (
        <div className="space-y-1.5">
          <Label>Time on each video</Label>
          <Select
            value={String((cfg.holdMinutes as number) ?? 0)}
            onValueChange={(v) => onChange({ ...cfg, holdMinutes: Number(v) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VIDEO_HOLD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Anything longer than the clip loops it until the time is up.
          </p>
        </div>
      )}
      {template === 'normal' && (
        <div className="space-y-1.5">
          <Label>Fill the screen?</Label>
          <Select value={(cfg.fit as string) ?? 'cover'} onValueChange={(v) => onChange({ ...cfg, fit: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cover">Fill the screen (crop edges)</SelectItem>
              <SelectItem value="contain">Show the whole video</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      </>}
      <div className="flex items-center justify-between">
        <Label>Shuffle videos</Label>
        <Switch
          checked={(cfg.shuffle as boolean) ?? false}
          onCheckedChange={(v) => onChange({ ...cfg, shuffle: v })}
        />
      </div>
    </div>
  );
}

export function ModeConfigForm({ mode, cfg, onChange }: { mode: Mode; cfg: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  switch (mode.id) {
    case 'slideshow-single':
      return <SlideshowConfig cfg={cfg} onChange={onChange} />;
    case 'slideshow-grid':
      return <GridConfig cfg={cfg} onChange={onChange} />;
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
    case 'scripture':
      return <ScriptureConfig cfg={cfg} onChange={onChange} />;
    case 'vinyl':
      return <VinylConfig cfg={cfg} onChange={onChange} />;
    case 'video':
      return <VideoModeConfig cfg={cfg} onChange={onChange} />;
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
