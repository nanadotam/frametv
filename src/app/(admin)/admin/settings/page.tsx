'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { ExternalLink, KeyRound, CheckCircle2, MapPin, Moon, Zap, Tv, Clock, Eye, EyeOff, RefreshCw } from 'lucide-react';
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

interface Integrations {
  spotify_connected: boolean;
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
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [integrations, setIntegrations] = useState<Integrations>(defaultIntegrations);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [clock, setClock] = useState<ClockOverlayConfig>({ enabled: false, position: 'bottom-right', font: 'Poppins' });
  const [savingClock, setSavingClock] = useState(false);
  const [clockSaved, setClockSaved] = useState(false);
  const [spotifyBanner, setSpotifyBanner] = useState<'connected' | 'error' | null>(null);
  const [displayPin, setDisplayPin] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);
  const [pinError, setPinError] = useState('');

  // Read ?spotify= query param set by OAuth callback
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params = new URLSearchParams((globalThis as any).location?.search ?? '');
    const status = params.get('spotify');
    if (status === 'connected' || status === 'error') {
      setSpotifyBanner(status);
      // Remove the query param without a full reload
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).history?.replaceState({}, '', '/admin/settings');
      if (status === 'connected') setTimeout(() => setSpotifyBanner(null), 4000);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const [sRes, iRes, apiKeyRes, clockRes, pinRes] = await Promise.all([
        fetch('/api/settings?key=app_settings'),
        fetch('/api/settings/integrations'),
        fetch('/api/settings?key=google_api_key'),
        fetch('/api/settings?key=clock_overlay'),
        fetch('/api/auth/pin-manage'),
      ]);
      if (sRes.ok) {
        const json = await sRes.json();
        if (json.setting?.value) setSettings((prev) => ({ ...prev, ...json.setting.value }));
      }
      if (iRes.ok) setIntegrations(await iRes.json());
      if (apiKeyRes.ok) {
        const json = await apiKeyRes.json();
        if (json.setting?.value) setGoogleApiKey(json.setting.value);
      }
      if (clockRes.ok) {
        const json = await clockRes.json();
        if (json.setting?.value) setClock((prev) => ({ ...prev, ...json.setting.value }));
      }
      if (pinRes.ok) {
        const json = await pinRes.json();
        setDisplayPin(json.pin ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const saveClock = async () => {
    setSavingClock(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'clock_overlay', value: clock }),
      });
      setClockSaved(true);
      setTimeout(() => setClockSaved(false), 2000);
    } finally {
      setSavingClock(false);
    }
  };

  const savePin = async () => {
    if (!/^\d{6}$/.test(newPin)) {
      setPinError('PIN must be exactly 6 digits.');
      return;
    }
    setPinError('');
    setSavingPin(true);
    try {
      const res = await fetch('/api/auth/pin-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin }),
      });
      const json = await res.json();
      if (!res.ok) { setPinError(json.error ?? 'Failed to save PIN.'); return; }
      setDisplayPin(newPin);
      setNewPin('');
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 2500);
    } finally {
      setSavingPin(false);
    }
  };

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'app_settings', value: settings }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
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
    <>
    <Head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&family=Oswald:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Pacifico&family=Playfair+Display:wght@400;700&family=Dancing+Script:wght@700&family=Bebas+Neue&family=Syne:wght@400;700&display=swap"
        rel="stylesheet"
      />
    </Head>
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure display behavior and integrations</p>
      </div>

      {spotifyBanner === 'connected' && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-400 flex items-center gap-2">
          <CheckCircle2 size={16} /> Spotify connected! Now playing will appear on the display.
        </div>
      )}
      {spotifyBanner === 'error' && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Spotify connection failed. Make sure <code className="font-mono text-xs">http://localhost:3000/api/auth/spotify/callback</code> is added as a Redirect URI in your{' '}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="underline">Spotify Developer Dashboard</a>.
        </div>
      )}

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

      {/* Clock Overlay */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock size={15} className="text-primary" /> Clock Overlay
          </CardTitle>
          <CardDescription>Show time and date on the display, like Chromecast Ambient Mode</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label htmlFor="clock-enabled">Show clock on display</Label>
            <Switch
              id="clock-enabled"
              checked={clock.enabled}
              onCheckedChange={(v) => setClock({ ...clock, enabled: v })}
            />
          </div>

          {clock.enabled && (
            <>
              {/* Position */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Position</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CLOCK_POSITIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setClock({ ...clock, position: value })}
                      className={cn(
                        'px-3 py-2 rounded-lg border text-sm transition-all text-left',
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

              {/* Font */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Font</Label>
                <div className="space-y-1.5">
                  {CLOCK_FONTS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setClock({ ...clock, font: value })}
                      className={cn(
                        'w-full px-3 py-2.5 rounded-lg border text-sm transition-all text-left flex items-center justify-between',
                        clock.font === value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <span className={clock.font === value ? 'text-primary font-medium' : 'text-muted-foreground'}>
                        {label}
                      </span>
                      <span
                        className="text-base"
                        style={{ fontFamily: `'${value}', sans-serif` }}
                      >
                        12:00
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Button
            size="sm"
            className={cn('w-full', clockSaved && 'bg-green-600 hover:bg-green-500')}
            onClick={saveClock}
            disabled={savingClock}
          >
            {clockSaved ? <><CheckCircle2 size={14} /> Saved</> : savingClock ? 'Saving…' : 'Save Clock Settings'}
          </Button>
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
              <Button size="sm" variant="outline" onClick={() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (globalThis as any).location.href = '/api/auth/spotify';
              }}>
                Connect
              </Button>
            )}
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
                Enable Drive API v3 in Google Cloud Console, then create an API key. No OAuth needed.
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

      {/* Display Access */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tv size={15} className="text-primary" /> Display Access
          </CardTitle>
          <CardDescription>Your PIN lets anyone open your display on any TV</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* PIN display */}
          <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Your Display PIN</p>
              <button
                onClick={() => setShowPin((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                {showPin ? 'Hide' : 'Reveal'}
              </button>
            </div>
            {displayPin ? (
              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-5xl font-bold tracking-[0.35em] select-all"
                  style={{
                    background: showPin
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)'
                      : undefined,
                    WebkitBackgroundClip: showPin ? 'text' : undefined,
                    WebkitTextFillColor: showPin ? 'transparent' : undefined,
                    color: showPin ? undefined : 'var(--muted-foreground)',
                    letterSpacing: '0.3em',
                  }}
                >
                  {showPin ? displayPin : '••••••'}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No PIN stored — set one below.</p>
            )}
          </div>

          {/* Change PIN */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1.5">
              <RefreshCw size={11} /> Change PIN
            </p>
            <div className="flex gap-2">
              <Input
                className="font-mono tracking-[0.4em] text-xl text-center h-12"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digits"
                value={newPin}
                onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
              />
              <Button
                size="lg"
                className={cn('shrink-0 h-12 px-5', pinSaved && 'bg-green-600 hover:bg-green-500 text-white')}
                onClick={savePin}
                disabled={savingPin || newPin.length !== 6}
              >
                {pinSaved ? <><CheckCircle2 size={15} /> Saved</> : savingPin ? 'Saving…' : 'Set PIN'}
              </Button>
            </div>
            {pinError && <p className="text-xs text-destructive">{pinError}</p>}
          </div>

          {/* Display token (collapsed/secondary) */}
          {integrations.display_token && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Display token</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2.5 rounded-lg bg-muted border border-border text-xs font-mono truncate">
                  {maskToken(integrations.display_token)}
                </code>
                <KeyRound size={15} className="text-muted-foreground shrink-0" />
              </div>
            </div>
          )}

          {/* Big colorful View Display button */}
          <Link href="/display" target="_blank">
            <button
              style={{
                width: '100%',
                height: '64px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
                border: 'none',
                color: '#fff',
                fontSize: '1.1rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'opacity 0.2s ease, transform 0.15s ease',
                boxShadow: '0 6px 24px rgba(139,92,246,0.35)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'scale(1.01)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <Tv size={20} />
              View Display
              <ExternalLink size={16} style={{ opacity: 0.7 }} />
            </button>
          </Link>

        </CardContent>
      </Card>
    </div>
    </>
  );
}
