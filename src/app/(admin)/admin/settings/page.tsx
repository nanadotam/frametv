'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, KeyRound } from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { Card } from '@/components/admin/Card';
import { Toggle } from '@/components/admin/Toggle';
import { Badge } from '@/components/admin/Badge';
import { TimeField, Label, DateInput, DateSegment } from 'react-aria-components';
import { parseTime } from '@internationalized/date';

interface Settings {
  latitude: number;
  longitude: number;
  auto_theme: boolean;
  night_dim_enabled: boolean;
  night_dim_start: string;
  night_dim_end: string;
}

interface Integrations {
  spotify_connected: boolean;
  google_connected: boolean;
  unsplash_key_set: boolean;
  display_token: string;
}

const defaultSettings: Settings = {
  latitude: 5.6037,
  longitude: -0.187,
  auto_theme: false,
  night_dim_enabled: false,
  night_dim_start: '22:00',
  night_dim_end: '07:00',
};

const defaultIntegrations: Integrations = {
  spotify_connected: false,
  google_connected: false,
  unsplash_key_set: false,
  display_token: '',
};

function maskToken(token: string) {
  if (!token) return '—';
  return token.slice(0, 6) + '••••••••' + token.slice(-4);
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [integrations, setIntegrations] = useState<Integrations>(defaultIntegrations);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const [sRes, iRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/settings/integrations'),
      ]);
      if (sRes.ok) setSettings(await sRes.json());
      if (iRes.ok) setIntegrations(await iRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const connectSpotify = async () => {
    const res = await fetch('/api/auth/spotify');
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  };

  const connectGoogle = async () => {
    const res = await fetch('/api/auth/google');
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto text-fg-muted text-sm text-center py-12">Loading…</div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="pt-2">
        <h1 className="text-2xl font-semibold font-display text-fg">System Settings</h1>
      </div>

      {/* Location */}
      <Card title="Location">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-fg-muted block mb-1.5">Latitude</label>
            <input
              type="number"
              step="0.0001"
              value={settings.latitude}
              onChange={(e) => setSettings({ ...settings, latitude: Number(e.target.value) })}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-fg-muted block mb-1.5">Longitude</label>
            <input
              type="number"
              step="0.0001"
              value={settings.longitude}
              onChange={(e) => setSettings({ ...settings, longitude: Number(e.target.value) })}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <p className="text-xs text-fg-dim mt-2">Default: Accra, Ghana (5.6037, -0.1870)</p>
      </Card>

      {/* Auto Theme */}
      <Card title="Auto Theme">
        <Toggle
          checked={settings.auto_theme}
          onChange={(v) => setSettings({ ...settings, auto_theme: v })}
          label="Switch theme automatically at sunrise/sunset"
        />
      </Card>

      {/* Night Dim */}
      <Card title="Night Dim">
        <div className="space-y-4">
          <Toggle
            checked={settings.night_dim_enabled}
            onChange={(v) => setSettings({ ...settings, night_dim_enabled: v })}
            label="Dim display at night"
          />
          {settings.night_dim_enabled && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-xs text-fg-muted block mb-1.5">Dim start</label>
                <TimeField
                  value={parseTime(settings.night_dim_start)}
                  onChange={(t) =>
                    setSettings({
                      ...settings,
                      night_dim_start: t
                        ? `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
                        : settings.night_dim_start,
                    })
                  }
                  aria-label="Dim start"
                >
                  <Label className="sr-only">Dim start</Label>
                  <DateInput className="flex gap-0.5 px-3 py-2.5 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm focus-within:border-accent">
                    {(segment) => (
                      <DateSegment segment={segment} className="outline-none focus:text-accent rounded px-0.5" />
                    )}
                  </DateInput>
                </TimeField>
              </div>
              <div>
                <label className="text-xs text-fg-muted block mb-1.5">Dim end</label>
                <TimeField
                  value={parseTime(settings.night_dim_end)}
                  onChange={(t) =>
                    setSettings({
                      ...settings,
                      night_dim_end: t
                        ? `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
                        : settings.night_dim_end,
                    })
                  }
                  aria-label="Dim end"
                >
                  <Label className="sr-only">Dim end</Label>
                  <DateInput className="flex gap-0.5 px-3 py-2.5 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm focus-within:border-accent">
                    {(segment) => (
                      <DateSegment segment={segment} className="outline-none focus:text-accent rounded px-0.5" />
                    )}
                  </DateInput>
                </TimeField>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Save settings */}
      <Button
        size="lg"
        className="w-full h-14"
        onClick={saveSettings}
        loading={saving}
        variant={saved ? 'secondary' : 'primary'}
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </Button>

      {/* Integrations */}
      <Card title="Integrations">
        <div className="space-y-4">
          {/* Spotify */}
          <div className="flex items-center justify-between gap-3 min-h-[48px]">
            <div>
              <p className="text-sm font-medium text-fg">Spotify</p>
              <p className="text-xs text-fg-muted">Play current song on display</p>
            </div>
            {integrations.spotify_connected ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Button size="sm" variant="secondary" onClick={connectSpotify}>
                Connect Spotify
              </Button>
            )}
          </div>

          <div className="h-px bg-fg/10" />

          {/* Google Drive */}
          <div className="flex items-center justify-between gap-3 min-h-[48px]">
            <div>
              <p className="text-sm font-medium text-fg">Google Drive</p>
              <p className="text-xs text-fg-muted">Import photo albums from Drive</p>
            </div>
            {integrations.google_connected ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Button size="sm" variant="secondary" onClick={connectGoogle}>
                Connect Google Drive
              </Button>
            )}
          </div>

          <div className="h-px bg-fg/10" />

          {/* Unsplash */}
          <div className="flex items-center justify-between gap-3 min-h-[48px]">
            <div>
              <p className="text-sm font-medium text-fg">Unsplash</p>
              <p className="text-xs text-fg-muted">
                Access key:{' '}
                <span className="font-mono text-fg-dim">
                  {integrations.unsplash_key_set ? '••••••••••••••••' : 'Not set'}
                </span>
              </p>
            </div>
            <Badge variant={integrations.unsplash_key_set ? 'success' : 'muted'}>
              {integrations.unsplash_key_set ? 'Key set' : 'No key'}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Display */}
      <Card title="Display">
        <div className="space-y-4">
          <div className="min-h-[48px]">
            <p className="text-xs text-fg-muted uppercase tracking-wider mb-1.5">Display token</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm font-mono truncate">
                {integrations.display_token ? maskToken(integrations.display_token) : '—'}
              </code>
              <KeyRound size={16} className="text-fg-muted flex-shrink-0" />
            </div>
          </div>
          <div className="min-h-[48px] flex items-center">
            <Link
              href="/display"
              target="_blank"
              className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent-hover transition-colors"
            >
              Open display <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
