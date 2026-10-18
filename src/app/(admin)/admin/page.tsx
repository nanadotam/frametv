'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pause, Play, SkipBack, SkipForward, Shuffle, Sun, SunDim, SlidersHorizontal, Clock,
  CalendarBlank, Plus, Images, Desktop, CaretRight, ArrowsClockwise, MonitorPlay,
} from '@phosphor-icons/react';
import { Page } from '@/components/m/Page';
import { Section, Row, ToggleRow, IconTile } from '@/components/m/List';
import { Button, Chip, Empty, IconButton } from '@/components/m/Controls';
import { Sheet } from '@/components/m/Sheet';
import { toast } from '@/components/m/Toast';
import { CoverImage } from '@/components/m/CoverImage';
import { LOOK_BY_ID, LOOKS, ALBUM_LOOKS, lookName } from '@/components/looks/catalog';
import { LivePreview } from '@/components/looks/LivePreview';
import { QuickSettingsContent, MODES_WITH_SETTINGS, type Cfg } from '@/components/looks/QuickSettings';
import { invalidateModes } from '@/hooks/useModes';
import { cn } from '@/lib/utils';
import type { DisplayState, Album, Schedule, Mode, DisplayDevice } from '@/types/db';

type ClockConfig = { enabled: boolean; position: string; font: string };
type Pending = 'pause' | 'prev' | 'next' | 'shuffle' | null;

async function patchDisplayState(patch: Partial<DisplayState>) {
  const res = await fetch('/api/display-state', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? 'Your display didn’t respond. Try again.');
  return json?.state as DisplayState | undefined;
}

function scheduleLabel(s: Schedule) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const d = s.days_of_week?.length === 7 ? 'Every day' : (s.days_of_week ?? []).map((i) => days[i]).join(' ');
  return `${d} · ${s.start_time?.slice(0, 5)}–${s.end_time?.slice(0, 5)}`;
}

export default function NowPage() {
  const [state, setState] = useState<DisplayState | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [modes, setModes] = useState<Mode[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [devices, setDevices] = useState<DisplayDevice[]>([]);
  const [clock, setClock] = useState<ClockConfig>({ enabled: false, position: 'bottom-right', font: 'Poppins' });
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [pendingAlbums, setPendingAlbums] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [cfg, setCfg] = useState<Cfg>({});
  const [brightness, setBrightness] = useState(100);

  const cfgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brightnessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [ds, al, md, sc, ck, dv] = await Promise.all([
        fetch('/api/display-state').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/albums').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/modes').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/schedules').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/settings?key=clock_overlay').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/display-devices').then((r) => (r.ok ? r.json() : null)),
      ]);
      const st = ds?.state ?? ds;
      if (st) {
        setState(st);
        setBrightness(st.brightness ?? 100);
      }
      setAlbums(Array.isArray(al) ? al : (al.albums ?? []));
      setModes(Array.isArray(md) ? md : (md.modes ?? []));
      setSchedules(Array.isArray(sc) ? sc : (sc.schedules ?? []));
      if (ck?.setting?.value) setClock((p) => ({ ...p, ...ck.setting.value }));
      setDevices(dv?.devices ?? []);
      setNow(Date.now());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const m = modes.find((x) => x.id === state?.active_mode_id);
    if (m) setCfg((m.config as Cfg) ?? {});
  }, [state?.active_mode_id, modes]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const optimistic = async (patch: Partial<DisplayState>, kind: Pending = null) => {
    if (!state) return;
    const previous = state;
    setState({ ...state, ...patch });
    if (kind) setPending(kind);
    try {
      const next = await patchDisplayState(patch);
      if (next) setState(next);
    } catch (err) {
      setState(previous);
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      if (kind) setPending(null);
    }
  };

  const command = async (kind: Exclude<Pending, null | 'pause'>, url: string) => {
    if (pending) return;
    setPending(kind);
    try {
      const res = await fetch(url, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Your display didn’t respond.');
      if (json?.state) setState(json.state);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Your display didn’t respond.');
    } finally {
      setPending(null);
    }
  };

  const chooseLook = async (id: string) => {
    setPickerOpen(false);
    await optimistic({ active_mode_id: id });
    toast(`Showing ${lookName(id)}`);
  };

  const toggleAlbum = async (id: string) => {
    if (!state || pendingAlbums.has(id)) return;
    const next = state.active_album_ids.includes(id)
      ? state.active_album_ids.filter((x) => x !== id)
      : [...state.active_album_ids, id];
    setPendingAlbums((p) => new Set(p).add(id));
    await optimistic({ active_album_ids: next });
    setPendingAlbums((p) => {
      const c = new Set(p);
      c.delete(id);
      return c;
    });
  };

  const onBrightness = (val: number) => {
    setBrightness(val);
    if (brightnessTimer.current) clearTimeout(brightnessTimer.current);
    brightnessTimer.current = setTimeout(() => optimistic({ brightness: val }), 250);
  };

  const toggleClock = async (enabled: boolean) => {
    const previous = clock;
    const next = { ...clock, enabled };
    setClock(next);
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'clock_overlay', value: next }),
    }).catch(() => null);
    if (!res?.ok) {
      setClock(previous);
      toast.error('Couldn’t update the clock overlay.');
    }
  };

  const toggleSchedule = async (s: Schedule, enabled: boolean) => {
    setSchedules((p) => p.map((x) => (x.id === s.id ? { ...x, is_enabled: enabled } : x)));
    const res = await fetch(`/api/schedules/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: enabled }),
    }).catch(() => null);
    if (!res?.ok) {
      setSchedules((p) => p.map((x) => (x.id === s.id ? { ...x, is_enabled: !enabled } : x)));
      toast.error('Couldn’t update that schedule.');
    }
  };

  const onCfgChange = (next: Cfg) => {
    setCfg(next);
    const id = state?.active_mode_id;
    if (!id) return;
    if (cfgTimer.current) clearTimeout(cfgTimer.current);
    cfgTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/modes/${id}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => null);
      if (!res?.ok) return toast.error('Couldn’t save that change.');
      setModes((prev) => prev.map((m) => (m.id === id ? { ...m, config: next } : m)));
      invalidateModes();
    }, 400);
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeId = state?.active_mode_id ?? null;
  const look = activeId ? LOOK_BY_ID[activeId] : null;
  const visibleAlbums = albums.filter((a) => !a.is_archived);
  const activeAlbums = visibleAlbums.filter((a) => state?.active_album_ids?.includes(a.id));
  const coverAlbum = activeAlbums.find((a) => a.cover_photo_id) ?? visibleAlbums.find((a) => a.cover_photo_id);
  const paused = state?.is_paused ?? false;
  const screens = devices.filter((d) => d.route !== 'admin');
  const liveScreens = screens.filter((d) => now - new Date(d.last_seen_at).getTime() < 90_000);
  const enabledModeIds = new Set(modes.filter((m) => m.is_enabled !== false).map((m) => m.id));
  const pickable = LOOKS.filter((l) => enabledModeIds.size === 0 || enabledModeIds.has(l.id));

  if (loaded && !state) {
    return (
      <Page title="Now">
        <Empty
          art={<IconTile tone="gray" size={72}><ArrowsClockwise size={36} weight="bold" /></IconTile>}
          title="Can’t reach Mantel"
          body="Check your internet connection, then try again."
          action={<Button block onClick={load}>Try again</Button>}
        />
      </Page>
    );
  }

  return (
    <Page
      title="Now"
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', liveScreens.length ? 'bg-ok' : 'bg-label-3')} />
          {liveScreens.length
            ? `Showing on ${liveScreens.length} screen${liveScreens.length > 1 ? 's' : ''}`
            : 'No screens are showing right now'}
        </span>
      }
    >
      {/* ── Hero: what's on ── */}
      <div className="relative overflow-hidden rounded-[26px] bg-cell shadow-cell">
        <button type="button" onClick={() => setPickerOpen(true)} className="pressable block w-full text-left">
          <div className="relative aspect-[16/10] w-full">
            {coverAlbum && activeId && ALBUM_LOOKS.has(activeId) ? (
              <CoverImage src={`/api/photos/${coverAlbum.cover_photo_id}/thumbnail`} rotation={coverAlbum.cover_rotation} />
            ) : (
              <LivePreview id={activeId ?? 'slideshow-single'} className="absolute inset-0 h-full w-full" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            {paused && (
              <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide text-white backdrop-blur">
                Paused
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-white/70">On display</p>
                <p className="truncate text-[28px] font-bold leading-tight tracking-tight">{look?.name ?? 'Pick a look'}</p>
                {activeId && ALBUM_LOOKS.has(activeId) && (
                  <p className="truncate text-[15px] text-white/80">
                    {activeAlbums.length ? activeAlbums.map((a) => a.name).join(', ') : 'All albums'}
                  </p>
                )}
              </div>
              <span className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white/20 px-3 text-[15px] font-semibold backdrop-blur-md">
                Change <CaretRight size={14} weight="bold" />
              </span>
            </div>
          </div>
        </button>

        {/* Transport */}
        <div className="flex items-center justify-between px-6 py-5">
          <IconButton label="Shuffle" size={48} variant="plain" onClick={() => command('shuffle', '/api/display-state/reshuffle')} disabled={!!pending}>
            <Shuffle size={26} weight="bold" className={pending === 'shuffle' ? 'animate-pulse' : ''} />
          </IconButton>
          <IconButton label="Previous" size={56} variant="plain" onClick={() => command('prev', '/api/display-state/prev')} disabled={!!pending}>
            <SkipBack size={34} weight="fill" className="text-label" />
          </IconButton>
          <IconButton
            label={paused ? 'Play' : 'Pause'}
            size={76}
            variant="filled"
            onClick={() => optimistic({ is_paused: !paused }, 'pause')}
            disabled={pending === 'pause'}
          >
            {paused ? <Play size={36} weight="fill" className="ml-1" /> : <Pause size={36} weight="fill" />}
          </IconButton>
          <IconButton label="Next" size={56} variant="plain" onClick={() => command('next', '/api/display-state/next')} disabled={!!pending}>
            <SkipForward size={34} weight="fill" className="text-label" />
          </IconButton>
          <IconButton
            label="Customize look"
            size={48}
            variant="plain"
            onClick={() => setCustomizeOpen(true)}
            disabled={!activeId || !MODES_WITH_SETTINGS.has(activeId)}
          >
            <SlidersHorizontal size={26} weight="bold" />
          </IconButton>
        </div>

        {/* Brightness */}
        <div className="flex items-center gap-3 border-t border-separator px-5 py-4">
          <SunDim size={20} className="text-label-2" />
          <input
            type="range"
            min={5}
            max={100}
            value={brightness}
            onChange={(e) => onBrightness(Number(e.target.value))}
            aria-label="Brightness"
            className="h-[6px] flex-1 cursor-pointer appearance-none rounded-full bg-fill-2 accent-[var(--m-tint)]"
            style={{ background: `linear-gradient(to right, var(--m-tint) ${(brightness - 5) / 0.95}%, var(--m-fill-2) ${(brightness - 5) / 0.95}%)` }}
          />
          <Sun size={22} weight="fill" className="text-label-2" />
        </div>
      </div>

      {loaded && visibleAlbums.length === 0 && (
        <Link href="/admin/albums?add=1" className="pressable bg-ember flex items-center gap-4 rounded-[22px] p-5 text-white shadow-[0_12px_30px_-12px_var(--m-tint)]">
          <Images size={40} weight="fill" />
          <div className="flex-1">
            <p className="text-[19px] font-bold">Set up your photo library</p>
            <p className="text-[14px] text-white/85">Upload from this computer or Apple Photos, or connect Google Drive or Google Photos.</p>
          </div>
          <CaretRight size={20} weight="bold" />
        </Link>
      )}

      {/* ── Albums on display ── */}
      {activeId && ALBUM_LOOKS.has(activeId) && (
        <Section
          plain
          header="Albums on display"
          footer={activeAlbums.length === 0 && visibleAlbums.length > 0 ? 'Nothing selected means every album is in the mix.' : undefined}
        >
          {visibleAlbums.length === 0 ? (
            <div className="rounded-[14px] bg-cell shadow-cell">
              <Row
                icon={<IconTile tone="ember"><Plus size={18} weight="bold" /></IconTile>}
                title="Add your first album"
                subtitle="Connect a Google Drive folder or upload videos"
                href="/admin/albums"
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleAlbums.map((a) => (
                <Chip key={a.id} selected={state?.active_album_ids?.includes(a.id)} loading={pendingAlbums.has(a.id)} onClick={() => toggleAlbum(a.id)}>
                  {a.name}
                </Chip>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Extras ── */}
      <Section header="On screen">
        <ToggleRow
          icon={<IconTile tone="gray"><Clock size={18} weight="bold" /></IconTile>}
          title="Clock in the corner"
          checked={clock.enabled}
          onChange={toggleClock}
        />
        <Row
          icon={<IconTile tone="ember"><MonitorPlay size={18} weight="fill" /></IconTile>}
          title="Set up a screensaver"
          subtitle="Mac, TV, iPad, Windows or any browser"
          href="/admin/screensaver"
        />
        <Row
          icon={<IconTile tone="blue"><Desktop size={18} weight="bold" /></IconTile>}
          title="Screens"
          detail={screens.length ? `${liveScreens.length} live` : 'Add one'}
          href="/admin/devices"
        />
      </Section>

      <Section
        header="Schedules"
        footer="Schedules switch the look automatically, like a calm morning slideshow and a clock at night."
      >
        {schedules.slice(0, 4).map((s) => (
          <ToggleRow
            key={s.id}
            icon={<IconTile tone="indigo"><CalendarBlank size={18} weight="bold" /></IconTile>}
            title={s.name}
            subtitle={`${lookName(s.mode_id)} · ${scheduleLabel(s)}`}
            checked={s.is_enabled}
            onChange={(v) => toggleSchedule(s, v)}
          />
        ))}
        <Row icon={<IconTile tone="indigo"><Plus size={18} weight="bold" /></IconTile>} title={schedules.length ? 'Manage schedules' : 'Create a schedule'} href="/admin/schedule" tint />
      </Section>

      {/* ── Look picker ── */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen} title="Choose a look" description="What should your screens show?" size="lg">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pickable.map((l) => {
            const active = l.id === activeId;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => chooseLook(l.id)}
                className={cn('pressable overflow-hidden rounded-[16px] bg-cell text-left shadow-cell ring-2', active ? 'ring-tint' : 'ring-transparent')}
              >
                <LivePreview id={l.id} className="aspect-[4/3] w-full" />
                <div className="px-3 py-2.5">
                  <p className="text-[15px] font-semibold">{l.name}</p>
                  <p className="line-clamp-1 text-[12px] text-label-2">{l.blurb}</p>
                </div>
              </button>
            );
          })}
        </div>
        <Link href="/admin/modes" className="block text-center text-[15px] font-semibold text-tint" onClick={() => setPickerOpen(false)}>
          Browse and customize all looks
        </Link>
      </Sheet>

      {/* ── Customize current look ── */}
      <Sheet
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        title={`Customize ${look?.name ?? ''}`}
        description="Changes show on your screens right away."
      >
        <div className="rounded-[14px] bg-cell p-4 shadow-cell">
          {activeId && <QuickSettingsContent modeId={activeId} cfg={cfg} onChange={onCfgChange} />}
        </div>
        {activeId && ALBUM_LOOKS.has(activeId) && (
          <Section>
            <Row icon={<IconTile tone="ember"><Images size={18} weight="bold" /></IconTile>} title="Manage albums" href="/admin/albums" />
          </Section>
        )}
      </Sheet>
    </Page>
  );
}
