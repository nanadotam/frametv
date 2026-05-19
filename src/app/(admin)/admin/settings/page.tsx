'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, KeyRound, CheckCircle2, MapPin, Moon, Zap, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
        {[1,2,3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card animate-pulse h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure display behavior and integrations</p>
      </div>

      {/* Location */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin size={15} className="text-primary" /> Location
          </CardTitle>
          <CardDescription>Used for sunrise/sunset auto-theme</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input
                type="number"
                step="0.0001"
                value={settings.latitude}
                onChange={(e) => setSettings({ ...settings, latitude: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input
                type="number"
                step="0.0001"
                value={settings.longitude}
                onChange={(e) => setSettings({ ...settings, longitude: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Default: Accra, Ghana (5.6037, -0.1870)</p>
        </CardContent>
      </Card>

      {/* Auto Theme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap size={15} className="text-primary" /> Auto Theme
          </CardTitle>
          <CardDescription>Switch light/dark theme automatically at sunrise/sunset</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-theme">Enable auto theme switching</Label>
            <Switch
              id="auto-theme"
              checked={settings.auto_theme}
              onCheckedChange={(v) => setSettings({ ...settings, auto_theme: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Night Dim */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Moon size={15} className="text-primary" /> Night Dim
          </CardTitle>
          <CardDescription>Automatically dim the display at night</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="night-dim">Dim display at night</Label>
            <Switch
              id="night-dim"
              checked={settings.night_dim_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, night_dim_enabled: v })}
            />
          </div>
          {settings.night_dim_enabled && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label>Dim start</Label>
                <Input
                  type="time"
                  value={settings.night_dim_start}
                  onChange={(e) => setSettings({ ...settings, night_dim_start: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Dim end</Label>
                <Input
                  type="time"
                  value={settings.night_dim_end}
                  onChange={(e) => setSettings({ ...settings, night_dim_end: e.target.value })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        size="lg"
        className={cn('w-full h-12', saved && 'bg-green-600 hover:bg-green-500')}
        onClick={saveSettings}
        disabled={saving}
      >
        {saved ? <><CheckCircle2 size={16} /> Saved</> : saving ? 'Saving…' : 'Save Settings'}
      </Button>

      <Separator />

      {/* Integrations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 min-h-[48px]">
            <div>
              <p className="text-sm font-medium">Spotify</p>
              <p className="text-xs text-muted-foreground">Show currently playing song</p>
            </div>
            {integrations.spotify_connected ? (
              <Badge variant="outline" className="border-green-500/40 text-green-400 bg-green-500/10">
                <CheckCircle2 size={10} className="mr-1" /> Connected
              </Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={async () => {
                const res = await fetch('/api/auth/spotify');
                if (res.ok) { const { url } = await res.json(); if (url) window.location.href = url; }
              }}>
                Connect
              </Button>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3 min-h-[48px]">
            <div>
              <p className="text-sm font-medium">Google Drive</p>
              <p className="text-xs text-muted-foreground">Import photo albums (public folders via API key)</p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                integrations.google_connected
                  ? 'border-green-500/40 text-green-400 bg-green-500/10'
                  : 'border-border text-muted-foreground'
              )}
            >
              {integrations.google_connected ? 'Active' : 'API key mode'}
            </Badge>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3 min-h-[48px]">
            <div>
              <p className="text-sm font-medium">Unsplash</p>
              <p className="text-xs text-muted-foreground">
                Access key: <span className="font-mono">{integrations.unsplash_key_set ? '••••••••••••••••' : 'Not set'}</span>
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                integrations.unsplash_key_set
                  ? 'border-green-500/40 text-green-400 bg-green-500/10'
                  : 'border-border text-muted-foreground'
              )}
            >
              {integrations.unsplash_key_set ? 'Key set' : 'No key'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Display */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tv size={15} className="text-primary" /> Display
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Display token</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 rounded-lg bg-muted border border-border text-sm font-mono truncate">
                {integrations.display_token ? maskToken(integrations.display_token) : '—'}
              </code>
              <KeyRound size={15} className="text-muted-foreground shrink-0" />
            </div>
          </div>
          <Link
            href="/display"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Open display <ExternalLink size={13} />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
