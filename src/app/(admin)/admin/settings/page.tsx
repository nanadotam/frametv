'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Moon, Clock, MapPin, SunHorizon, Password, Key, LockKey, MusicNotes, Megaphone, ListChecks,
  CalendarBlank, SpotifyLogo, Question, Sparkle, SignOut, Trash, Wrench, Crosshair,
} from '@phosphor-icons/react';
import { Page } from '@/components/m/Page';
import { Section, Row, ToggleRow, IconTile } from '@/components/m/List';
import { Button, Field, Segmented, TextInput } from '@/components/m/Controls';
import { Sheet } from '@/components/m/Sheet';
import { toast } from '@/components/m/Toast';
import { RecoveryKeyCard } from '@/components/m/RecoveryKeyCard';
import { useTheme, type ThemePref } from '@/lib/theme';
import { helpPrompt } from '@/lib/helpPrompt';

interface Account { id: string; email: string; username: string; name: string }

interface AppSettings {
  latitude: number;
  longitude: number;
  auto_theme: boolean;
  night_dim_enabled: boolean;
  night_dim_start: string;
  night_dim_end: string;
}

type ClockPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
interface ClockOverlay { enabled: boolean; position: ClockPosition; font: string }

const CLOCK_FONTS = ['Poppins', 'Oswald', 'JetBrains Mono', 'Pacifico', 'Playfair Display', 'Dancing Script', 'Bebas Neue', 'Syne'];

const DEFAULT_SETTINGS: AppSettings = {
  latitude: 5.6037,
  longitude: -0.187,
  auto_theme: false,
  night_dim_enabled: false,
  night_dim_start: '22:00',
  night_dim_end: '07:00',
};

async function saveSetting(key: string, value: unknown) {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  }).catch(() => null);
  if (!res?.ok) toast.error('Couldn’t save that change.');
  return !!res?.ok;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'Something went wrong.');
  return json;
}

export default function SettingsPage() {
  const { pref, setPref } = useTheme();
  const [account, setAccount] = useState<Account | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [clock, setClock] = useState<ClockOverlay>({ enabled: false, position: 'bottom-right', font: 'Poppins' });
  const [spotify, setSpotify] = useState<{ connected: boolean; name: string | null }>({ connected: false, name: null });
  const [recovery, setRecovery] = useState<{ hasKey: boolean; createdAt: string | null } | null>(null);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState('');

  const [sheet, setSheet] = useState<null | 'password' | 'recovery' | 'pin' | 'clock' | 'night' | 'location' | 'delete' | 'advanced'>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState<string | null>(null);

  const field = (k: string) => ({
    value: form[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  const load = useCallback(async () => {
    const [me, app, ck, integ, rk, pin, gk] = await Promise.all([
      fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/settings?key=app_settings').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/settings?key=clock_overlay').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/settings/integrations').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/auth/recovery-key').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/auth/pin-manage').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/settings?key=google_api_key').then((r) => (r.ok ? r.json() : null)),
    ]);
    if (me?.user) setAccount(me.user);
    if (app?.setting?.value) setSettings((p) => ({ ...p, ...app.setting.value }));
    if (ck?.setting?.value) setClock((p) => ({ ...p, ...ck.setting.value }));
    if (integ) setSpotify({ connected: !!integ.spotify_connected, name: integ.spotify_profile?.display_name ?? null });
    if (rk) setRecovery(rk);
    setHasPin(pin ? Boolean(pin.pin) : null);
    if (gk?.setting?.value) setApiKey(gk.setting.value);
  }, []);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const s = params.get('spotify');
    if (s === 'connected') toast('Spotify connected');
    if (s === 'error') toast.error('Spotify didn’t connect. Try again.');
    if (s) window.history.replaceState({}, '', '/admin/settings');
  }, [load]);

  const closeSheet = () => {
    setSheet(null);
    setForm({});
    setNewKey(null);
  };

  const updateSettings = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSetting('app_settings', next);
  };

  const updateClock = (patch: Partial<ClockOverlay>) => {
    const next = { ...clock, ...patch };
    setClock(next);
    saveSetting('clock_overlay', next);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = () =>
    run(async () => {
      if (form.next !== form.confirm) throw new Error('The new passwords don’t match.');
      await postJson('/api/auth/password', { currentPassword: form.current, newPassword: form.next, keepScreens: true });
      toast('Password changed. Other devices were signed out.');
      closeSheet();
    });

  const makeRecoveryKey = () =>
    run(async () => {
      const j = await postJson('/api/auth/recovery-key', { password: form.password });
      setNewKey(j.recoveryKey);
      setRecovery({ hasKey: true, createdAt: new Date().toISOString() });
    });

  const updatePin = () =>
    run(async () => {
      if (!/^\d{6}$/.test(form.pin ?? '')) throw new Error('The PIN must be 6 digits.');
      await postJson('/api/auth/pin-update', { mode: 'password', password: form.password, new_pin: form.pin });
      setHasPin(true);
      toast('Display PIN saved');
      closeSheet();
    });

  const deleteAccount = () =>
    run(async () => {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: form.password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Couldn’t delete your account.');
      window.location.href = '/';
    });

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        updateSettings({ latitude: +pos.coords.latitude.toFixed(4), longitude: +pos.coords.longitude.toFixed(4) });
        toast('Location updated');
      },
      () => toast.error('Location permission was denied.')
    );
  };

  const copyHelpPrompt = async () => {
    await navigator.clipboard.writeText(helpPrompt(window.location.origin));
    toast('Copied. Paste it into ChatGPT, Claude or Gemini.');
  };

  const initials = (account?.name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Page title="Settings">
      {/* ── Profile ── */}
      <div className="flex items-center gap-4 rounded-[20px] bg-cell p-4 shadow-cell">
        <span className="bg-ember flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full text-[22px] font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[20px] font-semibold">{account?.name ?? ' '}</p>
          <p className="truncate text-[15px] text-label-2">{account?.email ?? ''}</p>
        </div>
      </div>

      <Section header="Appearance">
        <div className="px-4 py-3">
          <Segmented<ThemePref>
            value={pref}
            onChange={setPref}
            options={[
              { value: 'system', label: 'Automatic' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </Section>

      <Section
        header="Security"
        footer={
          recovery && !recovery.hasKey
            ? 'You don’t have a recovery key yet. Without one, a forgotten password means a lost account.'
            : undefined
        }
      >
        <Row icon={<IconTile tone="gray"><Password size={18} weight="bold" /></IconTile>} title="Change password" onClick={() => setSheet('password')} chevron />
        <Row
          icon={<IconTile tone={recovery?.hasKey ? 'green' : 'orange'}><Key size={18} weight="bold" /></IconTile>}
          title="Recovery key"
          detail={recovery ? (recovery.hasKey ? 'On' : 'Set up') : undefined}
          onClick={() => setSheet('recovery')}
          chevron
        />
        <Row
          icon={<IconTile tone="blue"><LockKey size={18} weight="bold" /></IconTile>}
          title="Display PIN"
          subtitle="Unlock a TV with a code instead of a password"
          detail={hasPin === null ? undefined : hasPin ? 'On' : 'Off'}
          onClick={() => setSheet('pin')}
          chevron
        />
      </Section>

      <Section header="On your screens">
        <Row icon={<IconTile tone="gray"><Clock size={18} weight="bold" /></IconTile>} title="Clock overlay" detail={clock.enabled ? 'On' : 'Off'} onClick={() => setSheet('clock')} chevron />
        <Row icon={<IconTile tone="indigo"><Moon size={18} weight="fill" /></IconTile>} title="Dim at night" detail={settings.night_dim_enabled ? `${settings.night_dim_start}–${settings.night_dim_end}` : 'Off'} onClick={() => setSheet('night')} chevron />
        <ToggleRow
          icon={<IconTile tone="orange"><SunHorizon size={18} weight="bold" /></IconTile>}
          title="Match sunrise & sunset"
          subtitle="Clocks and text switch light/dark with the sun"
          checked={settings.auto_theme}
          onChange={(v) => updateSettings({ auto_theme: v })}
        />
        <Row icon={<IconTile tone="teal"><MapPin size={18} weight="fill" /></IconTile>} title="Location" detail={`${settings.latitude.toFixed(2)}, ${settings.longitude.toFixed(2)}`} onClick={() => setSheet('location')} chevron />
      </Section>

      <Section header="Features">
        <Row icon={<IconTile tone="green"><MusicNotes size={18} weight="fill" /></IconTile>} title="Music" href="/admin/music" />
        <Row icon={<IconTile tone="yellow"><Megaphone size={18} weight="fill" /></IconTile>} title="Flip Board messages" href="/admin/flipboard" />
        <Row icon={<IconTile tone="blue"><ListChecks size={18} weight="bold" /></IconTile>} title="Reminders" href="/admin/reminders" />
        <Row icon={<IconTile tone="indigo"><CalendarBlank size={18} weight="bold" /></IconTile>} title="Schedules" href="/admin/schedule" />
      </Section>

      <Section header="Connections">
        <Row
          icon={<IconTile tone="green"><SpotifyLogo size={18} weight="fill" /></IconTile>}
          title="Spotify"
          subtitle={spotify.connected ? `Connected${spotify.name ? ` as ${spotify.name}` : ''}` : 'For the Vinyl and Cover Flow looks'}
          detail={spotify.connected ? 'Reconnect' : 'Connect'}
          onClick={() => { window.location.href = '/api/auth/spotify'; }}
          chevron={false}
        />
      </Section>

      <Section header="Help">
        <Row icon={<IconTile tone="ember"><Question size={18} weight="bold" /></IconTile>} title="Setup guide" href="/help" />
        <Row
          icon={<IconTile tone="purple"><Sparkle size={18} weight="fill" /></IconTile>}
          title="Ask an AI for help"
          subtitle="Copies a prompt for ChatGPT, Claude or Gemini"
          onClick={copyHelpPrompt}
        />
        <Row icon={<IconTile tone="gray"><Wrench size={18} weight="bold" /></IconTile>} title="Advanced" onClick={() => setSheet('advanced')} chevron />
      </Section>

      <Section>
        <Row icon={<IconTile tone="gray"><SignOut size={18} weight="bold" /></IconTile>} title="Sign out" onClick={signOut} />
        <Row icon={<IconTile tone="red"><Trash size={18} weight="bold" /></IconTile>} title="Delete account" destructive onClick={() => setSheet('delete')} />
      </Section>

      <p className="pb-4 text-center text-[13px] text-label-3">Mantel</p>

      {/* ── Sheets ── */}
      <Sheet open={sheet === 'password'} onOpenChange={(o) => !o && closeSheet()} title="Change password" description="Other devices will be signed out. Your screens stay connected.">
        <Section>
          <Field label="Current" type="password" autoComplete="current-password" {...field('current')} />
          <Field label="New" type="password" autoComplete="new-password" placeholder="8+ characters" {...field('next')} />
          <Field label="Confirm" type="password" autoComplete="new-password" {...field('confirm')} />
        </Section>
        <Button block onClick={changePassword} loading={busy} disabled={!form.current || !form.next}>Change password</Button>
      </Sheet>

      <Sheet open={sheet === 'recovery'} onOpenChange={(o) => !o && closeSheet()} title="Recovery key">
        {newKey ? (
          <>
            <RecoveryKeyCard recoveryKey={newKey} email={account?.email} />
            <Button block onClick={closeSheet}>I’ve saved it</Button>
          </>
        ) : (
          <>
            <p className="px-1 text-[15px] leading-relaxed text-label-2">
              A recovery key lets you reset your password if you forget it. There’s no email reset, so keep it somewhere safe,
              like your Photos, a password manager or printed out.
              {recovery?.hasKey && ' Making a new key turns the old one off.'}
            </p>
            {recovery?.hasKey && (
              <Section>
                <Field label="Password" type="password" autoComplete="current-password" {...field('password')} />
              </Section>
            )}
            <Button block onClick={makeRecoveryKey} loading={busy} disabled={recovery?.hasKey && !form.password}>
              {recovery?.hasKey ? 'Make a new recovery key' : 'Create my recovery key'}
            </Button>
          </>
        )}
      </Sheet>

      <Sheet open={sheet === 'pin'} onOpenChange={(o) => !o && closeSheet()} title="Display PIN" description="A 6-digit code you can type on a TV instead of your password.">
        <Section>
          <Field label="Password" type="password" autoComplete="current-password" {...field('password')} />
          <Field label="New PIN" inputMode="numeric" maxLength={6} placeholder="6 digits" {...field('pin')} />
        </Section>
        <Button block onClick={updatePin} loading={busy} disabled={!form.password || (form.pin ?? '').length !== 6}>Save PIN</Button>
      </Sheet>

      <Sheet open={sheet === 'clock'} onOpenChange={(o) => !o && closeSheet()} title="Clock overlay" description="A small clock on top of any look.">
        <Section>
          <ToggleRow title="Show clock" checked={clock.enabled} onChange={(v) => updateClock({ enabled: v })} />
        </Section>
        <Section header="Position">
          <div className="grid grid-cols-2 gap-2 p-3">
            {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as ClockPosition[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updateClock({ position: p })}
                className={`pressable relative h-16 rounded-[10px] ${clock.position === p ? 'bg-tint/15 ring-2 ring-tint' : 'bg-fill'}`}
                aria-label={p}
              >
                <span className={`absolute h-2 w-8 rounded-full ${clock.position === p ? 'bg-tint' : 'bg-label-3'} ${p.includes('top') ? 'top-3' : 'bottom-3'} ${p.includes('left') ? 'left-3' : 'right-3'}`} />
              </button>
            ))}
          </div>
        </Section>
        <Section header="Font">
          {CLOCK_FONTS.map((f) => (
            <Row key={f} title={<span style={{ fontFamily: f }}>{f}</span>} onClick={() => updateClock({ font: f })} trailing={clock.font === f ? <span className="text-tint">✓</span> : null} />
          ))}
        </Section>
      </Sheet>

      <Sheet open={sheet === 'night'} onOpenChange={(o) => !o && closeSheet()} title="Dim at night">
        <Section>
          <ToggleRow title="Dim automatically" checked={settings.night_dim_enabled} onChange={(v) => updateSettings({ night_dim_enabled: v })} />
          <Field label="From" type="time" value={settings.night_dim_start} onChange={(e) => updateSettings({ night_dim_start: e.target.value })} />
          <Field label="Until" type="time" value={settings.night_dim_end} onChange={(e) => updateSettings({ night_dim_end: e.target.value })} />
        </Section>
      </Sheet>

      <Sheet open={sheet === 'location'} onOpenChange={(o) => !o && closeSheet()} title="Location" description="Used only to work out sunrise and sunset.">
        <Button block variant="tinted" icon={<Crosshair size={20} weight="bold" />} onClick={useMyLocation}>Use my current location</Button>
        <Section>
          <Field label="Latitude" inputMode="decimal" value={String(settings.latitude)} onChange={(e) => setSettings((s) => ({ ...s, latitude: Number(e.target.value) || 0 }))} onBlur={() => saveSetting('app_settings', settings)} />
          <Field label="Longitude" inputMode="decimal" value={String(settings.longitude)} onChange={(e) => setSettings((s) => ({ ...s, longitude: Number(e.target.value) || 0 }))} onBlur={() => saveSetting('app_settings', settings)} />
        </Section>
      </Sheet>

      <Sheet open={sheet === 'advanced'} onOpenChange={(o) => !o && closeSheet()} title="Advanced">
        <Section
          header="Google API key"
          footer="Optional. Mantel already has a key; add your own only if Drive albums stop syncing because of quota limits."
        >
          <Field placeholder="AIza…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </Section>
        <Button block variant="tinted" onClick={async () => { if (await saveSetting('google_api_key', apiKey.trim())) toast('Saved'); }}>Save key</Button>
      </Sheet>

      <Sheet open={sheet === 'delete'} onOpenChange={(o) => !o && closeSheet()} title="Delete account" description="This permanently deletes your albums, uploaded videos, looks and settings. Google Drive files are not touched.">
        <TextInput type="password" placeholder="Your password" autoComplete="current-password" {...field('password')} />
        <Button block variant="destructive" onClick={deleteAccount} loading={busy} disabled={!form.password}>Delete everything</Button>
      </Sheet>
    </Page>
  );
}
