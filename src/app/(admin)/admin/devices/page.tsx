'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AppleLogo, Television, Globe, DeviceMobile, Laptop, Monitor, Link as LinkIcon, Copy,
  CheckCircle, SignOut, Trash, ArrowSquareOut, DownloadSimple, MonitorPlay, CaretRight,
} from '@phosphor-icons/react';
import { Page } from '@/components/m/Page';
import { Section, Row, IconTile } from '@/components/m/List';
import { Button, TextInput } from '@/components/m/Controls';
import { Sheet } from '@/components/m/Sheet';
import { toast } from '@/components/m/Toast';
import { lookName } from '@/components/looks/catalog';
import { MAC_DOWNLOAD_URL } from '@/lib/links';
import { LIVE_WINDOW_MS } from '@/lib/polling';
import type { DisplayDevice } from '@/types/db';

type Session = {
  id: string;
  kind: 'admin' | 'display' | 'screensaver' | 'widget';
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  last_seen_at: string | null;
  current: boolean;
};

type PairPreview = { device_name: string | null; device_type: string | null; city: string | null; country: string | null; created_at: string };

function ago(ts: string | null, now: number) {
  if (!ts) return 'never';
  const d = Math.max(0, now - new Date(ts).getTime());
  if (d < 90_000) return 'now';
  if (d < 3_600_000) return `${Math.round(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} h ago`;
  return `${Math.round(d / 86_400_000)} d ago`;
}

function sessionIcon(s: { kind?: string; device_type: string | null }) {
  if (s.kind === 'screensaver') return <IconTile tone="gray"><AppleLogo size={18} weight="fill" /></IconTile>;
  if (s.device_type === 'tv') return <IconTile tone="blue"><Television size={18} weight="bold" /></IconTile>;
  if (s.device_type === 'mobile' || s.device_type === 'tablet') return <IconTile tone="green"><DeviceMobile size={18} weight="bold" /></IconTile>;
  return <IconTile tone="indigo"><Laptop size={18} weight="bold" /></IconTile>;
}

const KIND_LABEL: Record<Session['kind'], string> = {
  admin: 'Controls your account',
  display: 'Shows your display',
  screensaver: 'Mac screensaver',
  widget: 'Widget',
};

export default function DevicesPage() {
  const [screens, setScreens] = useState<DisplayDevice[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [now, setNow] = useState(0);
  const [shareToken, setShareToken] = useState<string | null | undefined>(undefined);
  const [pairOpen, setPairOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<PairPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [dv, ss, sh] = await Promise.all([
      fetch('/api/display-devices').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/auth/sessions').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/share').then((r) => (r.ok ? r.json() : null)),
    ]);
    setScreens((dv?.devices ?? []).filter((d: DisplayDevice) => d.route !== 'admin'));
    setSessions(ss?.sessions ?? []);
    setShareToken(sh?.token ?? null);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  // Pairing: look the code up first so you can see which device is asking.
  useEffect(() => {
    if (code.length !== 6) {
      setPreview(null);
      return;
    }
    fetch(`/api/auth/pair/approve?code=${code}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setPreview(j.device);
      })
      .catch((e) => {
        setPreview(null);
        toast.error(e.message || 'That code is invalid or has expired.');
      });
  }, [code]);

  const approve = async () => {
    setBusy(true);
    const res = await fetch('/api/auth/pair/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(j.error ?? 'Couldn’t pair that TV.');
    toast('TV connected');
    setPairOpen(false);
    setCode('');
    load();
  };

  const revoke = async (s: Session) => {
    const res = await fetch(`/api/auth/sessions?id=${s.id}`, { method: 'DELETE' });
    if (!res.ok) return toast.error('Couldn’t sign that device out.');
    setSessions((p) => p.filter((x) => x.id !== s.id));
    toast(`${s.device_name ?? 'Device'} signed out`);
  };

  const revokeAll = async () => {
    const res = await fetch('/api/auth/sessions?all=1', { method: 'DELETE' });
    if (!res.ok) return toast.error('Couldn’t sign everything out.');
    setSessions((p) => p.filter((x) => x.current));
    toast('Signed out everywhere else');
  };

  const makeLink = async () => {
    const res = await fetch('/api/share', { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setShareToken(j.token);
  };

  const killLink = async () => {
    await fetch('/api/share', { method: 'DELETE' });
    setShareToken(null);
    toast('Link turned off');
  };

  const shareUrl = shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${shareToken}` : '';

  return (
    <Page title="Devices" subtitle="Put your memories on any screen.">
      <Link href="/admin/screensaver" className="pressable bg-ember flex items-center gap-4 rounded-[20px] p-4 text-white shadow-[0_10px_30px_-12px_var(--m-tint)]">
        <MonitorPlay size={36} weight="fill" />
        <div className="flex-1">
          <p className="text-[17px] font-semibold">Set up a screensaver</p>
          <p className="text-[13px] text-white/85">Step-by-step guides for Mac, TV, iPad, Windows and more</p>
        </div>
        <CaretRight size={18} weight="bold" />
      </Link>

      {/* ── Add a screen ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <a href={MAC_DOWNLOAD_URL} className="pressable flex flex-col rounded-[20px] bg-cell p-4 shadow-cell">
          <IconTile tone="gray" size={44}><AppleLogo size={26} weight="fill" /></IconTile>
          <p className="mt-3 text-[17px] font-semibold">This Mac</p>
          <p className="text-[13px] leading-snug text-label-2">Get the Mantel app and use it as your screensaver.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-[15px] font-semibold text-tint">
            <DownloadSimple size={16} weight="bold" /> Download
          </span>
        </a>
        <button type="button" onClick={() => setPairOpen(true)} className="pressable flex flex-col rounded-[20px] bg-cell p-4 text-left shadow-cell">
          <IconTile tone="blue" size={44}><Television size={26} weight="fill" /></IconTile>
          <p className="mt-3 text-[17px] font-semibold">A TV</p>
          <p className="text-[13px] leading-snug text-label-2">Open Mantel in the TV’s browser and type the code it shows.</p>
          <span className="mt-3 text-[15px] font-semibold text-tint">Enter code</span>
        </button>
        <button type="button" onClick={() => setBrowserOpen(true)} className="pressable flex flex-col rounded-[20px] bg-cell p-4 text-left shadow-cell">
          <IconTile tone="green" size={44}><Globe size={26} weight="bold" /></IconTile>
          <p className="mt-3 text-[17px] font-semibold">Any browser</p>
          <p className="text-[13px] leading-snug text-label-2">An old iPad, a spare monitor, a laptop. No laptop needs to stay on.</p>
          <span className="mt-3 text-[15px] font-semibold text-tint">Get the link</span>
        </button>
      </div>

      {/* ── Screens ── */}
      <Section
        header="Screens"
        footer={screens.length ? undefined : 'Screens appear here once they open your display.'}
      >
        {screens.length === 0 && (
          <Row icon={<IconTile tone="gray"><Monitor size={18} weight="bold" /></IconTile>} title="No screens yet" subtitle="Add one above" />
        )}
        {screens.slice(0, 12).map((d) => {
          const isLive = now - new Date(d.last_seen_at).getTime() < LIVE_WINDOW_MS;
          return (
            <Row
              key={d.id}
              icon={sessionIcon(d)}
              title={d.label || d.device_name || [d.os, d.browser].filter(Boolean).join(' · ') || 'Screen'}
              subtitle={`${isLive ? `Showing ${lookName(d.active_mode_id)}` : `Last seen ${ago(d.last_seen_at, now)}`}${d.city ? ` · ${d.city}` : ''}`}
              trailing={<span className={isLive ? 'h-2.5 w-2.5 rounded-full bg-ok' : 'h-2.5 w-2.5 rounded-full bg-label-3'} />}
            />
          );
        })}
      </Section>

      {/* ── Signed-in devices ── */}
      <Section
        header="Signed in"
        footer="If you don’t recognise a device, sign it out and change your password in Settings."
      >
        {sessions.map((s) => (
          <Row
            key={s.id}
            icon={sessionIcon(s)}
            title={
              <span className="flex items-center gap-2">
                {s.device_name ?? 'Unknown device'}
                {s.current && <span className="rounded-full bg-tint/15 px-2 py-0.5 text-[11px] font-semibold text-tint">This device</span>}
              </span>
            }
            subtitle={`${KIND_LABEL[s.kind] ?? s.kind} · ${s.city ? `${s.city} · ` : ''}${ago(s.last_seen_at ?? s.created_at, now)}`}
            trailing={
              !s.current && (
                <button type="button" onClick={() => revoke(s)} className="pressable rounded-full p-2 text-bad" aria-label="Sign out this device">
                  <SignOut size={20} weight="bold" />
                </button>
              )
            }
          />
        ))}
        {sessions.length > 1 && <Row title="Sign out everywhere else" destructive onClick={revokeAll} />}
      </Section>

      {/* ── Pair TV sheet ── */}
      <Sheet open={pairOpen} onOpenChange={(o) => { setPairOpen(o); if (!o) setCode(''); }} title="Connect a TV">
        <ol className="space-y-2 rounded-[14px] bg-cell p-4 text-[15px] shadow-cell">
          <li><b>1.</b> On your TV, open its web browser.</li>
          <li><b>2.</b> Go to <span className="font-semibold text-tint">{typeof window !== 'undefined' ? window.location.host : 'mantel'}/display</span></li>
          <li><b>3.</b> Type the 6-letter code it shows:</li>
        </ol>
        <TextInput
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="ABC123"
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          className="h-[64px] text-center font-mono text-[30px] tracking-[0.4em]"
        />
        {preview && (
          <Section header="Is this your TV?">
            <Row
              icon={sessionIcon(preview)}
              title={preview.device_name ?? 'Unknown device'}
              subtitle={`${preview.city ? `${preview.city}, ${preview.country ?? ''} · ` : ''}asked ${ago(preview.created_at, now)}`}
            />
          </Section>
        )}
        <Button block size="xl" disabled={!preview} loading={busy} onClick={approve}>
          Connect this TV
        </Button>
      </Sheet>

      {/* ── Browser link sheet ── */}
      <Sheet open={browserOpen} onOpenChange={setBrowserOpen} title="Show on any browser">
        <Section footer="Anyone with this link can view (not change) your display. Turn it off any time.">
          {shareToken ? (
            <>
              <Row icon={<IconTile tone="green"><LinkIcon size={18} weight="bold" /></IconTile>} title={<span className="font-mono text-[15px]">{shareUrl.replace(/^https?:\/\//, '')}</span>} />
              <Row
                icon={<IconTile tone="blue"><Copy size={18} weight="bold" /></IconTile>}
                title="Copy link"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl);
                  toast('Link copied');
                }}
              />
              <Row icon={<IconTile tone="indigo"><ArrowSquareOut size={18} weight="bold" /></IconTile>} title="Open it here" href={shareUrl} external />
              <Row icon={<IconTile tone="red"><Trash size={18} weight="bold" /></IconTile>} title="Turn link off" destructive onClick={killLink} />
            </>
          ) : (
            <Row icon={<IconTile tone="green"><CheckCircle size={18} weight="bold" /></IconTile>} title="Create a viewing link" tint onClick={makeLink} />
          )}
        </Section>
        <p className="px-1 text-[13px] text-label-2">
          Tip: on an iPad, open the link in Safari, tap Share → Add to Home Screen, and turn on Guided Access to keep it on display.
        </p>
      </Sheet>
    </Page>
  );
}
