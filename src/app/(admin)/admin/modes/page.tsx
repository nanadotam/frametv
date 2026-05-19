'use client';

import { useCallback, useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { Card } from '@/components/admin/Card';
import { Modal } from '@/components/admin/Modal';
import { Toggle } from '@/components/admin/Toggle';
import { Badge } from '@/components/admin/Badge';
import type { Mode } from '@/types/db';

// ── Per-mode config forms ─────────────────────────────────────────────────────

function SlideshowConfig({
  cfg,
  onChange,
}: {
  cfg: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">
          Interval: <span className="text-accent">{(cfg.interval as number) ?? 10}s</span>
        </label>
        <input
          type="range"
          min={3}
          max={60}
          value={(cfg.interval as number) ?? 10}
          onChange={(e) => onChange({ ...cfg, interval: Number(e.target.value) })}
          className="w-full accent-accent h-2 rounded-full cursor-pointer"
        />
      </div>
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">Transition</label>
        <select
          value={(cfg.transition as string) ?? 'fade'}
          onChange={(e) => onChange({ ...cfg, transition: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm focus:outline-none focus:border-accent appearance-none"
        >
          {['fade', 'slide', 'zoom', 'flip', 'crossfade'].map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>
      <Toggle
        checked={!!(cfg.blur_backdrop)}
        onChange={(v) => onChange({ ...cfg, blur_backdrop: v })}
        label="Blur backdrop"
      />
    </div>
  );
}

function PinterestConfig({
  cfg,
  onChange,
}: {
  cfg: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">Speed</label>
        <select
          value={(cfg.speed as string) ?? '1x'}
          onChange={(e) => onChange({ ...cfg, speed: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm focus:outline-none focus:border-accent appearance-none"
        >
          {['0.5x', '1x', '2x'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">Rows</label>
        <select
          value={(cfg.rows as number) ?? 3}
          onChange={(e) => onChange({ ...cfg, rows: Number(e.target.value) })}
          className="w-full px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm focus:outline-none focus:border-accent appearance-none"
        >
          {[2, 3, 4].map((r) => (
            <option key={r} value={r}>{r} rows</option>
          ))}
        </select>
      </div>
      <Toggle
        checked={!!(cfg.reverse_direction)}
        onChange={(v) => onChange({ ...cfg, reverse_direction: v })}
        label="Reverse direction"
      />
    </div>
  );
}

function ClockConfig({
  cfg,
  onChange,
}: {
  cfg: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">Theme</label>
        <select
          value={(cfg.theme as string) ?? 'dark'}
          onChange={(e) => onChange({ ...cfg, theme: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm focus:outline-none focus:border-accent appearance-none"
        >
          {['dark', 'light', 'nude', 'cream'].map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">
          Font size: <span className="text-accent">{(cfg.font_size as number) ?? 80}px</span>
        </label>
        <input
          type="range"
          min={40}
          max={200}
          value={(cfg.font_size as number) ?? 80}
          onChange={(e) => onChange({ ...cfg, font_size: Number(e.target.value) })}
          className="w-full accent-accent h-2 rounded-full cursor-pointer"
        />
      </div>
    </div>
  );
}

function FlipboardConfig({
  cfg,
  onChange,
}: {
  cfg: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  const sources = (cfg.sources as string[]) ?? [];
  const toggleSource = (s: string) => {
    onChange({
      ...cfg,
      sources: sources.includes(s) ? sources.filter((x) => x !== s) : [...sources, s],
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-2">Sources</label>
        <div className="flex flex-wrap gap-2">
          {['reminders', 'calendar', 'weather', 'quotes'].map((s) => (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className={`px-3 py-1.5 rounded-pill text-sm transition-colors min-h-[40px] ${
                sources.includes(s) ? 'bg-accent text-bg' : 'bg-fg/10 text-fg hover:bg-fg/15'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">
          Seconds per message: <span className="text-accent">{(cfg.seconds_per_message as number) ?? 8}s</span>
        </label>
        <input
          type="range"
          min={2}
          max={30}
          value={(cfg.seconds_per_message as number) ?? 8}
          onChange={(e) => onChange({ ...cfg, seconds_per_message: Number(e.target.value) })}
          className="w-full accent-accent h-2 rounded-full cursor-pointer"
        />
      </div>
      <Toggle
        checked={!!(cfg.sound)}
        onChange={(v) => onChange({ ...cfg, sound: v })}
        label="Sound effects"
      />
    </div>
  );
}

function UnsplashConfig({
  cfg,
  onChange,
}: {
  cfg: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">Mood / keywords</label>
        <input
          type="text"
          value={(cfg.mood as string) ?? ''}
          onChange={(e) => onChange({ ...cfg, mood: e.target.value })}
          placeholder="nature, minimal, cozy…"
          className="w-full px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm placeholder:text-fg-dim focus:outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">
          Interval: <span className="text-accent">{(cfg.interval as number) ?? 30}s</span>
        </label>
        <input
          type="range"
          min={10}
          max={120}
          value={(cfg.interval as number) ?? 30}
          onChange={(e) => onChange({ ...cfg, interval: Number(e.target.value) })}
          className="w-full accent-accent h-2 rounded-full cursor-pointer"
        />
      </div>
    </div>
  );
}

function EaselConfig({
  cfg,
  onChange,
}: {
  cfg: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  const texts = ((cfg.texts as string[]) ?? []).join('\n');
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">Texts (one per line)</label>
        <textarea
          value={texts}
          onChange={(e) =>
            onChange({ ...cfg, texts: e.target.value.split('\n').filter(Boolean) })
          }
          rows={5}
          placeholder={"Good morning!\nHave a great day."}
          className="w-full px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm placeholder:text-fg-dim focus:outline-none focus:border-accent resize-none font-mono"
        />
      </div>
      <div>
        <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">
          Interval: <span className="text-accent">{(cfg.interval_minutes as number) ?? 5} min</span>
        </label>
        <input
          type="range"
          min={1}
          max={60}
          value={(cfg.interval_minutes as number) ?? 5}
          onChange={(e) => onChange({ ...cfg, interval_minutes: Number(e.target.value) })}
          className="w-full accent-accent h-2 rounded-full cursor-pointer"
        />
      </div>
    </div>
  );
}

function GenericConfig({
  cfg,
  onChange,
}: {
  cfg: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  return (
    <div>
      <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">Config JSON</label>
      <textarea
        value={JSON.stringify(cfg, null, 2)}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            // invalid JSON, ignore
          }
        }}
        rows={8}
        className="w-full px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm font-mono focus:outline-none focus:border-accent resize-none"
      />
    </div>
  );
}

function ModeConfigForm({
  mode,
  cfg,
  onChange,
}: {
  mode: Mode;
  cfg: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
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
    default:
      return <GenericConfig cfg={cfg} onChange={onChange} />;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

const MODE_DISPLAY: Record<string, { label: string; description: string }> = {
  'slideshow-single': { label: 'Slideshow', description: 'One photo at a time with smooth transitions' },
  'slideshow-grid': { label: 'Grid', description: 'Mosaic grid of photos' },
  'pinterest': { label: 'Pinterest', description: 'Scrolling masonry columns' },
  'clock-text': { label: 'Clock', description: 'Large ambient clock display' },
  'flipboard': { label: 'FlipBoard', description: 'News-ticker style messages' },
  'coverflow': { label: 'Cover Flow', description: '3D cover flow carousel' },
  'unsplash-mood': { label: 'Mood', description: 'Curated Unsplash photos by mood' },
  'easel': { label: 'Easel', description: 'Rotating text messages' },
};

export default function ModesPage() {
  const [modes, setModes] = useState<Mode[]>([]);
  const [loading, setLoading] = useState(true);
  const [configModal, setConfigModal] = useState<{ mode: Mode; cfg: Record<string, unknown> } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchModes = useCallback(async () => {
    try {
      const res = await fetch('/api/modes');
      if (res.ok) setModes(await res.json());
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
        prev.map((m) =>
          m.id === configModal.mode.id ? { ...m, config: configModal.cfg } : m
        )
      );
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

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 pt-2">
        <h1 className="text-2xl font-semibold font-display text-fg">Modes</h1>
      </div>

      {loading ? (
        <div className="text-fg-muted text-sm text-center py-12">Loading…</div>
      ) : (
        <div className="space-y-3">
          {(modes.length > 0 ? modes : Object.entries(MODE_DISPLAY).map(([id, d]) => ({
            id,
            name: d.label,
            description: d.description,
            is_enabled: true,
            config: {},
          } as Mode))).map((mode) => {
            const display = MODE_DISPLAY[mode.id];
            return (
              <Card key={mode.id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-fg">{display?.label ?? mode.name}</h3>
                    <Badge variant={mode.is_enabled ? 'success' : 'muted'}>
                      {mode.is_enabled ? 'On' : 'Off'}
                    </Badge>
                  </div>
                  <p className="text-sm text-fg-muted mt-0.5 truncate">
                    {display?.description ?? mode.description ?? 'No description'}
                  </p>
                  {mode.config && Object.keys(mode.config).length > 0 && (
                    <p className="text-xs text-fg-dim mt-1 truncate font-mono">
                      {Object.entries(mode.config).slice(0, 3).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Toggle checked={mode.is_enabled} onChange={() => toggleEnabled(mode)} />
                  <Button size="sm" variant="secondary" onClick={() => openConfig(mode)}>
                    <Settings2 size={15} /> Configure
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Config Modal */}
      {configModal && (
        <Modal
          open={true}
          onOpenChange={(open) => { if (!open) setConfigModal(null); }}
          title={`Configure ${MODE_DISPLAY[configModal.mode.id]?.label ?? configModal.mode.name}`}
          description="Adjust settings for this display mode."
        >
          <div className="space-y-5">
            <ModeConfigForm
              mode={configModal.mode}
              cfg={configModal.cfg}
              onChange={(cfg) => setConfigModal((prev) => prev ? { ...prev, cfg } : null)}
            />
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" size="md" onClick={() => setConfigModal(null)}>Cancel</Button>
              <Button size="md" onClick={saveConfig} loading={saving}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
