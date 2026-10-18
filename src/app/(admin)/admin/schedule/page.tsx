'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarBlank, Plus, SunHorizon, MoonStars, Coffee, Trash } from '@phosphor-icons/react';
import { Page } from '@/components/m/Page';
import { Section, Row, Toggle, IconTile } from '@/components/m/List';
import { Button, Chip, Empty, Field, TextInput } from '@/components/m/Controls';
import { Sheet } from '@/components/m/Sheet';
import { toast } from '@/components/m/Toast';
import { LOOKS, lookName } from '@/components/looks/catalog';
import { LivePreview } from '@/components/looks/LivePreview';
import { cn } from '@/lib/utils';
import type { Schedule, Album } from '@/types/db';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];

type Form = {
  name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  mode_id: string;
  album_ids: string[];
  priority: number;
};

const BLANK: Form = { name: '', days_of_week: EVERY_DAY, start_time: '08:00', end_time: '22:00', mode_id: 'slideshow-single', album_ids: [], priority: 5 };

const PRESETS: { icon: React.ReactNode; tone: 'orange' | 'indigo' | 'teal'; form: Form; blurb: string }[] = [
  { icon: <Coffee size={20} weight="fill" />, tone: 'orange', blurb: 'Weekdays 6–9 am · Slideshow', form: { ...BLANK, name: 'Mornings', days_of_week: WEEKDAYS, start_time: '06:00', end_time: '09:00', mode_id: 'slideshow-single' } },
  { icon: <SunHorizon size={20} weight="fill" />, tone: 'teal', blurb: 'Every day 6–10 pm · Gallery Wall', form: { ...BLANK, name: 'Evenings', start_time: '18:00', end_time: '22:00', mode_id: 'slideshow-grid' } },
  { icon: <MoonStars size={20} weight="fill" />, tone: 'indigo', blurb: 'Every day 10 pm–6 am · Clock', form: { ...BLANK, name: 'Night clock', start_time: '22:00', end_time: '06:00', mode_id: 'clock-text' } },
];

function daysLabel(days: number[]) {
  const d = [...days].sort();
  if (d.length === 7) return 'Every day';
  if (d.join() === WEEKDAYS.join()) return 'Weekdays';
  if (d.join() === WEEKENDS.join()) return 'Weekends';
  return d.map((i) => DAY_NAMES[i]).join(', ');
}

function time12(t: string) {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: m ? '2-digit' : undefined });
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [sc, al] = await Promise.all([
      fetch('/api/schedules').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/albums').then((r) => (r.ok ? r.json() : [])),
    ]);
    setSchedules(Array.isArray(sc) ? sc : (sc.schedules ?? []));
    setAlbums((Array.isArray(al) ? al : (al.albums ?? [])).filter((a: Album) => !a.is_archived));
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  const save = async () => {
    if (!editing) return;
    const f = editing.form;
    if (!f.name.trim()) return toast.error('Give the schedule a name.');
    if (!f.days_of_week.length) return toast.error('Pick at least one day.');
    setSaving(true);
    const res = await fetch(editing.id ? `/api/schedules/${editing.id}` : '/api/schedules', {
      method: editing.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, name: f.name.trim() }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error('Couldn’t save the schedule.');
    toast(editing.id ? 'Schedule updated' : 'Schedule added');
    setEditing(null);
    load();
  };

  const remove = async () => {
    if (!editing?.id) return;
    const res = await fetch(`/api/schedules/${editing.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) return toast.error('Couldn’t delete the schedule.');
    setSchedules((p) => p.filter((s) => s.id !== editing.id));
    setEditing(null);
    toast('Schedule deleted');
  };

  const toggle = async (s: Schedule, enabled: boolean) => {
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

  const f = editing?.form;

  return (
    <Page
      title="Schedules"
      subtitle="Change the look automatically through the day."
      back={{ href: '/admin/settings', label: 'Settings' }}
      actions={<Button size="sm" icon={<Plus size={14} weight="bold" />} onClick={() => setEditing({ id: null, form: BLANK })}>New</Button>}
    >
      {loaded && schedules.length === 0 && (
        <Empty
          art={<IconTile tone="indigo" size={72}><CalendarBlank size={38} weight="fill" /></IconTile>}
          title="No schedules yet"
          body="For example: a calm slideshow in the morning, a gallery wall in the evening, and a clock overnight."
        />
      )}

      {schedules.length > 0 && (
        <Section header="Your schedules" footer="When schedules overlap, the higher priority wins. Turn one off to pause it.">
          {schedules.map((s) => (
            <Row
              key={s.id}
              icon={<IconTile tone="indigo"><CalendarBlank size={18} weight="bold" /></IconTile>}
              title={s.name}
              subtitle={`${daysLabel(s.days_of_week)} · ${time12(s.start_time)}–${time12(s.end_time)} · ${lookName(s.mode_id)}`}
              onClick={() =>
                setEditing({
                  id: s.id,
                  form: { name: s.name, days_of_week: s.days_of_week, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5), mode_id: s.mode_id, album_ids: s.album_ids ?? [], priority: s.priority },
                })
              }
              trailing={
                <span onClick={(e) => e.stopPropagation()}>
                  <Toggle checked={s.is_enabled} onChange={(v) => toggle(s, v)} label={`Turn ${s.name} on or off`} />
                </span>
              }
            />
          ))}
        </Section>
      )}

      <Section header="Quick start" footer="Tap one to set it up, then adjust anything you like.">
        {PRESETS.map((p) => (
          <Row
            key={p.form.name}
            icon={<IconTile tone={p.tone}>{p.icon}</IconTile>}
            title={p.form.name}
            subtitle={p.blurb}
            onClick={() => setEditing({ id: null, form: p.form })}
            chevron
          />
        ))}
      </Section>

      <Sheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.id ? 'Edit schedule' : 'New schedule'}
        size="lg"
        footer={
          <div className="flex gap-2">
            {editing?.id && (
              <Button variant="destructive" icon={<Trash size={18} weight="bold" />} onClick={remove}>Delete</Button>
            )}
            <Button className="flex-1" onClick={save} loading={saving}>{editing?.id ? 'Save changes' : 'Add schedule'}</Button>
          </div>
        }
      >
        {f && (
          <>
            <TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name, e.g. Mornings" />

            <Section header="Which days">
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2">
                  <Chip selected={f.days_of_week.length === 7} onClick={() => set({ days_of_week: EVERY_DAY })}>Every day</Chip>
                  <Chip selected={f.days_of_week.join() === WEEKDAYS.join()} onClick={() => set({ days_of_week: WEEKDAYS })}>Weekdays</Chip>
                  <Chip selected={f.days_of_week.join() === WEEKENDS.join()} onClick={() => set({ days_of_week: WEEKENDS })}>Weekends</Chip>
                </div>
                <div className="flex justify-between gap-1.5">
                  {DAYS.map((d, i) => {
                    const on = f.days_of_week.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={on}
                        aria-label={DAY_NAMES[i]}
                        onClick={() => set({ days_of_week: on ? f.days_of_week.filter((x) => x !== i) : [...f.days_of_week, i].sort() })}
                        className={cn('pressable h-11 w-11 rounded-full text-[15px] font-semibold', on ? 'bg-tint text-white' : 'bg-fill text-label')}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Section>

            <Section header="When" footer={f.end_time < f.start_time ? 'Runs overnight, into the next morning.' : undefined}>
              <Field label="Starts" type="time" value={f.start_time} onChange={(e) => set({ start_time: e.target.value })} />
              <Field label="Ends" type="time" value={f.end_time} onChange={(e) => set({ end_time: e.target.value })} />
            </Section>

            <div>
              <h3 className="mb-2 px-4 text-[13px] font-medium uppercase tracking-wide text-label-2">Show this look</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {LOOKS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => set({ mode_id: l.id })}
                    className={cn('pressable overflow-hidden rounded-[12px] bg-cell text-left shadow-cell ring-2', f.mode_id === l.id ? 'ring-tint' : 'ring-transparent')}
                  >
                    <LivePreview id={l.id} className="aspect-[4/3] w-full" />
                    <p className="truncate px-2 py-1.5 text-[13px] font-semibold">{l.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {albums.length > 0 && (
              <Section header="From these albums" footer="Leave all unselected to use whatever is on display.">
                <div className="flex flex-wrap gap-2 p-4">
                  {albums.map((a) => (
                    <Chip
                      key={a.id}
                      selected={f.album_ids.includes(a.id)}
                      onClick={() => set({ album_ids: f.album_ids.includes(a.id) ? f.album_ids.filter((x) => x !== a.id) : [...f.album_ids, a.id] })}
                    >
                      {a.name}
                    </Chip>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </Sheet>
    </Page>
  );
}
