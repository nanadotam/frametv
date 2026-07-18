'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, KeyRound, CheckCircle2, MapPin, Moon, Zap, Tv, Clock, CalendarDays, ChevronRight, LockKeyhole, RefreshCw, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import PageGuide from '@/components/admin/PageGuide';

interface Settings {
  latitude: number;
  longitude: number;
  auto_theme: boolean;
  night_dim_enabled: boolean;
  night_dim_start: string;
  night_dim_end: string;
}

type ClockPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
type ClockFont = 'Poppins' | 'Oswald' | 'JetBrains Mono' | 'Pacifico' | 'Playfair Display' | 'Dancing Script' | 'Bebas Neue' | 'Syne';

interface ClockOverlayConfig {
  enabled: boolean;
  position: ClockPosition;
  font: ClockFont;
}

const CLOCK_POSITIONS: { value: ClockPosition; label: string }[] = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left',  label: 'Bottom Left' },
  { value: 'top-right',    label: 'Top Right' },
  { value: 'top-left',     label: 'Top Left' },
];

const CLOCK_FONTS: { value: ClockFont; label: string }[] = [
  { value: 'Poppins',          label: 'Poppins — clean & modern' },
  { value: 'Oswald',           label: 'Oswald — bold condensed' },
  { value: 'JetBrains Mono',   label: 'JetBrains Mono — techy' },
  { value: 'Pacifico',         label: 'Pacifico — playful retro' },
  { value: 'Playfair Display', label: 'Playfair Display — elegant serif' },
  { value: 'Dancing Script',   label: 'Dancing Script — handwritten' },
  { value: 'Bebas Neue',       label: 'Bebas Neue — big & bold' },
  { value: 'Syne',             label: 'Syne — geometric' },
];

interface SpotifyProfile {
  display_name: string | null;
  email: string | null;
  image_url: string | null;
  spotify_id: string | null;
}

interface Integrations {
  spotify_connected: boolean;
  spotify_profile: SpotifyProfile | null;
  google_connected: boolean;
  unsplash_key_set: boolean;
  display_token: string;
  google_api_key?: string;
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
  spotify_profile: null,
  google_connected: false,
  unsplash_key_set: false,
  display_token: '',
  google_api_key: '',
};

function maskToken(token: string) {
  if (!token) return '—';
  return token.slice(0, 6) + '••••••••' + token.slice(-4);
}

export default function SettingsPage() {
  const [settings, setSettings]             = useState<Settings>(defaultSettings);
  const [integrations, setIntegrations]     = useState<Integrations>(defaultIntegrations);
  const [loading, setLoading]               = useState(true);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSaved, setLocationSaved]   = useState(false);
  const [googleApiKey, setGoogleApiKey]     = useState('');
  const [savingApiKey, setSavingApiKey]     = useState(false);
  const [apiKeySaved, setApiKeySaved]       = useState(false);
  const [clock, setClock]                   = useState<ClockOverlayConfig>({ enabled: false, position: 'bottom-right', font: 'Poppins' });
  const [spotifyBanner, setSpotifyBanner]   = useState<'connected' | 'error' | null>(null);

  // PIN update state
  const [pinMode, setPinMode]               = useState<'pin' | 'password'>('pin');
  const [pinOldValue, setPinOldValue]       = useState('');
  const [pinNewValue, setPinNewValue]       = useState('');
  const [pinConfirm, setPinConfirm]         = useState('');
  const [pinSaving, setPinSaving]           = useState(false);
  const [pinResult, setPinResult]           = useState<{ ok: boolean; msg: string } | null>(null);

  // TV pairing state
  const [pairCode, setPairCode]             = useState('');
  const [pairSaving, setPairSaving]         = useState(false);
  const [pairResult, setPairResult]         = useState<{ ok: boolean; msg: string } | null>(null);

  const approvePairCode = useCallback(async () => {
    setPairSaving(true);
    setPairResult(null);
    try {
      const res = await fetch('/api/auth/pair/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to pair.');
      setPairResult({ ok: true, msg: 'TV signed in.' });
      setPairCode('');
      setTimeout(() => setPairResult(null), 4000);
    } catch (err) {
      setPairResult({ ok: false, msg: err instanceof Error ? err.message : 'Unable to pair.' });
    } finally {
      setPairSaving(false);
    }
  }, [pairCode]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params = new URLSearchParams((globalThis as any).location?.search ?? '');
    const status = params.get('spotify');
    if (status === 'connected' || status === 'error') {
      setSpotifyBanner(status);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).history?.replaceState({}, '', '/admin/settings');
      if (status === 'connected') setTimeout(() => setSpotifyBanner(null), 4000);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const [sRes, iRes, apiKeyRes, clockRes] = await Promise.all([
        fetch('/api/settings?key=app_settings'),
        fetch('/api/settings/integrations'),
        fetch('/api/settings?key=google_api_key'),
        fetch('/api/settings?key=clock_overlay'),
      ]);
      if (sRes.ok) {
        const json = await sRes.json();
        if (json.setting?.value) setSettings((p) => ({ ...p, ...json.setting.value }));
      }
      if (iRes.ok) setIntegrations(await iRes.json());
      if (apiKeyRes.ok) {
        const json = await apiKeyRes.json();
        if (json.setting?.value) setGoogleApiKey(json.setting.value);
      }
      if (clockRes.ok) {
        const json = await clockRes.json();
        if (json.setting?.value) setClock((p) => ({ ...p, ...json.setting.value }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // ── Auto-save helpers ──────────────────────────────────────────────────────

  const saveAppSettings = useCallback(async (s: Settings) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'app_settings', value: s }),
    });
  }, []);

  const saveClockSettings = useCallback(async (c: ClockOverlayConfig) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'clock_overlay', value: c }),
    });
  }, []);

  const handleAutoTheme = (v: boolean) => {
    const next = { ...settings, auto_theme: v };
    setSettings(next);
    saveAppSettings(next);
  };

  const handleNightDim = (v: boolean) => {
    const next = { ...settings, night_dim_enabled: v };
    setSettings(next);
    saveAppSettings(next);
  };

  const handleClockEnabled = (v: boolean) => {
    const next = { ...clock, enabled: v };
    setClock(next);
    saveClockSettings(next);
  };

  const handleClockPosition = (position: ClockPosition) => {
    const next = { ...clock, position };
    setClock(next);
    saveClockSettings(next);
  };

  const handleClockFont = (font: ClockFont) => {
    const next = { ...clock, font };
    setClock(next);
    saveClockSettings(next);
  };

  const saveLocation = async () => {
    setSavingLocation(true);
    try {
      await saveAppSettings(settings);
      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 2000);
    } finally {
      setSavingLocation(false);
    }
  };

  const saveGoogleApiKey = async () => {
    if (!googleApiKey.trim()) return;
    setSavingApiKey(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'google_api_key', value: googleApiKey.trim() }),
      });
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    } finally {
      setSavingApiKey(false);
    }
  };

  const updatePin = async () => {
    if (!/^\d{6}$/.test(pinNewValue)) {
      setPinResult({ ok: false, msg: 'New PIN must be exactly 6 digits.' });
      return;
    }
    if (pinNewValue !== pinConfirm) {
      setPinResult({ ok: false, msg: 'PINs do not match.' });
      return;
    }
    setPinSaving(true);
    setPinResult(null);
    try {
      const body =
        pinMode === 'pin'
          ? { mode: 'pin', old_pin: pinOldValue, new_pin: pinNewValue }
          : { mode: 'password', password: pinOldValue, new_pin: pinNewValue };
      const res = await fetch('/api/auth/pin-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        setPinResult({ ok: true, msg: 'PIN updated successfully.' });
        setPinOldValue('');
        setPinNewValue('');
        setPinConfirm('');
        setTimeout(() => setPinResult(null), 3000);
      } else {
        setPinResult({ ok: false, msg: json.error ?? 'Failed to update PIN.' });
      }
    } finally {
      setPinSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card animate-pulse h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">

      <PageGuide
        pageKey="settings"
        icon={<Tv size={18} className="text-primary" />}
        title="Settings"
        about="Configure your display, connect integrations, and personalise FrameTV. Changes save automatically."
        steps={[
          'Clock Overlay — enable it to show the time on top of your photos.',
          'Auto Theme — dims the display at sunrise/sunset based on your location.',
          'Spotify — connect your account to show album art and control music.',
          'Display PIN — change the 6-digit PIN used to unlock the TV display.',
          'Google Drive — connect your account to sync photos from Drive folders.',
        ]}
      />

      <div className="pt-2">
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Display behaviour, clock, and integrations</p>
      </div>

      {spotifyBanner === 'connected' && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-400 flex items-center gap-2">
          <CheckCircle2 size={16} /> Spotify connected! Now playing will appear on the display.
        </div>
      )}
      {spotifyBanner === 'error' && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Spotify connection failed. Make sure{' '}
          <code className="font-mono text-xs">http://localhost:3000/api/auth/spotify/callback</code>{' '}
          is added as a Redirect URI in your{' '}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="underline">
            Spotify Dashboard
          </a>.
        </div>
      )}

      {/* ── Schedule shortcut ── */}
      <Link
        href="/admin/schedule"
        className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-3">
          <CalendarDays size={16} className="text-primary" />
          <div>
            <p className="text-sm font-semibold">Schedule</p>
            <p className="text-xs text-muted-foreground">Auto-switch modes at specific times</p>
          </div>
        </div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </Link>

      {/* ── Auto Theme ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap size={15} className="text-primary" /> Auto Theme
          </CardTitle>
          <CardDescription>Switch light/dark at sunrise/sunset</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-theme">Enable auto theme switching</Label>
            <Switch id="auto-theme" checked={settings.auto_theme} onCheckedChange={handleAutoTheme} />
          </div>
        </CardContent>
      </Card>

      {/* ── Night Dim ── */}
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
            <Switch id="night-dim" checked={settings.night_dim_enabled} onCheckedChange={handleNightDim} />
          </div>
          {settings.night_dim_enabled && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label>Dim start</Label>
                <Input
                  type="time"
                  value={settings.night_dim_start}
                  onChange={(e) => setSettings({ ...settings, night_dim_start: e.target.value })}
                  onBlur={() => saveAppSettings({ ...settings })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Dim end</Label>
                <Input
                  type="time"
                  value={settings.night_dim_end}
                  onChange={(e) => setSettings({ ...settings, night_dim_end: e.target.value })}
                  onBlur={() => saveAppSettings({ ...settings })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Clock Overlay ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock size={15} className="text-primary" /> Clock Overlay
          </CardTitle>
          <CardDescription>Show time and date on the display</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label htmlFor="clock-enabled">Show clock on display</Label>
            <Switch id="clock-enabled" checked={clock.enabled} onCheckedChange={handleClockEnabled} />
          </div>

          {clock.enabled && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Position</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CLOCK_POSITIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => handleClockPosition(value)}
                      className={cn(
                        'px-3 py-2.5 rounded-lg border text-sm transition-all text-left',
                        clock.position === value
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Font</Label>
                <div className="space-y-1.5">
                  {CLOCK_FONTS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => handleClockFont(value)}
                      className={cn(
                        'w-full px-3 py-2.5 rounded-lg border text-sm transition-all text-left flex items-center justify-between',
                        clock.font === value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                      )}
                    >
                      <span className={clock.font === value ? 'text-primary font-medium' : 'text-muted-foreground'}>
                        {label}
                      </span>
                      <span className="text-base" style={{ fontFamily: `'${value}', sans-serif` }}>
                        12:00
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Location ── */}
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
          <p className="text-xs text-muted-foreground">Default: Accra, Ghana (5.6037, −0.1870)</p>
          <Button
            size="sm"
            className={cn('w-full', locationSaved && 'bg-green-600 hover:bg-green-500')}
            onClick={saveLocation}
            disabled={savingLocation}
          >
            {locationSaved
              ? <><CheckCircle2 size={14} /> Saved</>
              : savingLocation ? 'Saving…' : 'Save Location'}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Integrations ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3 min-h-[48px]">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {integrations.spotify_connected && integrations.spotify_profile?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={integrations.spotify_profile.image_url}
                  alt="Spotify profile"
                  className="w-9 h-9 rounded-full object-cover shrink-0 border border-green-500/30"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
                  <Music2 size={15} className="text-emerald-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">Spotify</p>
                {integrations.spotify_connected && integrations.spotify_profile ? (
                  <p className="text-xs text-green-400 truncate">
                    {integrations.spotify_profile.display_name ?? integrations.spotify_profile.email ?? 'Connected'}
                    {integrations.spotify_profile.email && integrations.spotify_profile.display_name && (
                      <span className="text-muted-foreground ml-1">· {integrations.spotify_profile.email}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Show currently playing song</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {integrations.spotify_connected ? (
                <>
                  <Badge variant="outline" className="border-green-500/40 text-green-400 bg-green-500/10">
                    <CheckCircle2 size={10} className="mr-1" /> Connected
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (globalThis as any).location.href = '/api/auth/spotify';
                    }}
                    title="Reconnect Spotify"
                  >
                    <RefreshCw size={12} />
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (globalThis as any).location.href = '/api/auth/spotify';
                }}>
                  Connect
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Google Drive</p>
                <p className="text-xs text-muted-foreground">Import public photo folders via API key</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs shrink-0',
                  googleApiKey
                    ? 'border-green-500/40 text-green-400 bg-green-500/10'
                    : 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10'
                )}
              >
                {googleApiKey ? 'Key set' : 'Key missing'}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Google API Key{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  (get one ↗)
                </a>
              </Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="AIza…"
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant={apiKeySaved ? 'default' : 'outline'}
                  className={cn('shrink-0', apiKeySaved && 'bg-green-600 hover:bg-green-500 text-white')}
                  onClick={saveGoogleApiKey}
                  disabled={savingApiKey || !googleApiKey.trim()}
                >
                  {apiKeySaved ? <CheckCircle2 size={14} /> : 'Save'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground/60">
                Enable Drive API v3 in Google Cloud Console, then create an API key.
              </p>
            </div>
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

      {/* ── Update PIN ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LockKeyhole size={15} className="text-primary" /> Update Display PIN
          </CardTitle>
          <CardDescription>Change the 6-digit PIN used to unlock your display</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => { setPinMode('pin'); setPinOldValue(''); setPinResult(null); }}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg border text-sm transition-all',
                pinMode === 'pin'
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              )}
            >
              Use current PIN
            </button>
            <button
              onClick={() => { setPinMode('password'); setPinOldValue(''); setPinResult(null); }}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg border text-sm transition-all',
                pinMode === 'password'
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              )}
            >
              Use password
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>{pinMode === 'pin' ? 'Current PIN' : 'Account password'}</Label>
            <Input
              type="password"
              inputMode={pinMode === 'pin' ? 'numeric' : undefined}
              maxLength={pinMode === 'pin' ? 6 : undefined}
              placeholder={pinMode === 'pin' ? '••••••' : 'Your account password'}
              value={pinOldValue}
              onChange={(e) => setPinOldValue(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>New PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={pinNewValue}
                onChange={(e) => setPinNewValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
              />
            </div>
          </div>

          {pinResult && (
            <p className={cn('text-sm', pinResult.ok ? 'text-green-400' : 'text-red-400')}>
              {pinResult.ok && <CheckCircle2 size={13} className="inline mr-1" />}
              {pinResult.msg}
            </p>
          )}

          <Button
            size="sm"
            className={cn('w-full', pinResult?.ok && 'bg-green-600 hover:bg-green-500')}
            onClick={updatePin}
            disabled={pinSaving || !pinOldValue || !pinNewValue || !pinConfirm}
          >
            {pinSaving ? 'Updating…' : pinResult?.ok ? <><CheckCircle2 size={14} /> Updated</> : 'Update PIN'}
          </Button>
        </CardContent>
      </Card>

      {/* ── Display token ── */}
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

          <Separator />

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Pair a TV</p>
            <p className="text-sm text-muted-foreground mb-3">
              Enter the 6-character code shown on your TV screen — or open{' '}
              <span className="font-mono">frametv.app/pair/CODE</span> directly by scanning its QR code.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={pairCode}
                onChange={(e) => setPairCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABC123"
                className="font-mono tracking-[0.3em] uppercase"
                maxLength={6}
              />
              <Button
                size="sm"
                onClick={approvePairCode}
                disabled={pairSaving || pairCode.length < 6}
              >
                {pairSaving ? 'Pairing…' : pairResult?.ok ? <><CheckCircle2 size={14} /> Paired</> : 'Pair'}
              </Button>
            </div>
            {pairResult && (
              <p className={cn('text-sm mt-2', pairResult.ok ? 'text-green-400' : 'text-red-400')}>
                {pairResult.msg}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
