'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  TimeField,
  Label,
  DateInput,
  DateSegment,
} from 'react-aria-components';
import { parseTime } from '@internationalized/date';
import { Button } from '@/components/admin/Button';
import { Card } from '@/components/admin/Card';
import { Modal } from '@/components/admin/Modal';
import { Toggle } from '@/components/admin/Toggle';
import { Badge } from '@/components/admin/Badge';
import type { Schedule, Album, Mode } from '@/types/db';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MODES_LIST = [
  { id: 'slideshow-single', label: 'Slideshow' },
  { id: 'slideshow-grid', label: 'Grid' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'clock-text', label: 'Clock' },
  { id: 'flipboard', label: 'FlipBoard' },
  { id: 'coverflow', label: 'Cover Flow' },
  { id: 'unsplash-mood', label: 'Mood' },
  { id: 'easel', label: 'Easel' },
];

type FormState = {
  name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  mode_id: string;
  album_ids: string[];
  priority: number;
};

const defaultForm: FormState = {
  name: '',
  days_of_week: [],
  start_time: '08:00',
  end_time: '22:00',
  mode_id: 'slideshow-single',
  album_ids: [],
  priority: 5,
};

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [schRes, albRes] = await Promise.all([
        fetch('/api/schedules'),
        fetch('/api/albums'),
      ]);
      if (schRes.ok) setSchedules(await schRes.json());
      if (albRes.ok) setAlbums((await albRes.json()).filter((a: Album) => !a.is_archived));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      days_of_week: s.days_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      mode_id: s.mode_id,
      album_ids: s.album_ids,
      priority: s.priority,
    });
    setModalOpen(true);
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await fetch(`/api/schedules/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      setModalOpen(false);
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async (id: string) => {
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleEnabled = async (s: Schedule) => {
    const next = !s.is_enabled;
    setSchedules((prev) => prev.map((x) => x.id === s.id ? { ...x, is_enabled: next } : x));
    await fetch(`/api/schedules/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: next }),
    });
  };

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  };

  const toggleAlbum = (albumId: string) => {
    setForm((prev) => ({
      ...prev,
      album_ids: prev.album_ids.includes(albumId)
        ? prev.album_ids.filter((id) => id !== albumId)
        : [...prev.album_ids, albumId],
    }));
  };

  const modeLabel = (modeId: string) =>
    MODES_LIST.find((m) => m.id === modeId)?.label ?? modeId;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 pt-2">
        <h1 className="text-2xl font-semibold font-display text-fg">Schedule</h1>
        <Button size="sm" onClick={openAdd}>
          <Plus size={16} /> Add schedule
        </Button>
      </div>

      {loading ? (
        <div className="text-fg-muted text-sm text-center py-12">Loading…</div>
      ) : schedules.length === 0 ? (
        <div className="text-fg-muted text-sm text-center py-12">
          No schedules yet. Add one to auto-switch modes at specific times.
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <Card key={s.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-fg">{s.name}</h3>
                    <Badge variant={s.is_enabled ? 'success' : 'muted'}>
                      {s.is_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {DAY_LABELS.map((d, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded-pill ${
                          s.days_of_week.includes(i)
                            ? 'bg-accent/20 text-accent'
                            : 'bg-fg/5 text-fg-dim'
                        }`}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-sm text-fg-muted space-y-0.5">
                    <p>{s.start_time} – {s.end_time} · {modeLabel(s.mode_id)}</p>
                    <p className="text-xs">Priority {s.priority}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Toggle checked={s.is_enabled} onChange={() => toggleEnabled(s)} />
                  <button
                    onClick={() => openEdit(s)}
                    className="w-10 h-10 rounded-lg bg-fg/10 flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/15 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => deleteSchedule(s.id)}
                    className="w-10 h-10 rounded-lg bg-fg/5 flex items-center justify-center text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? 'Edit schedule' : 'Add schedule'}
        className="max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Morning routine"
              className="w-full px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm placeholder:text-fg-dim focus:outline-none focus:border-accent"
            />
          </div>

          {/* Days */}
          <div>
            <label className="text-xs text-fg-muted uppercase tracking-wider block mb-2">Days</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-pill text-sm font-medium transition-colors min-h-[40px] ${
                    form.days_of_week.includes(i)
                      ? 'bg-accent text-bg'
                      : 'bg-fg/10 text-fg hover:bg-fg/15'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">Start time</label>
              <TimeField
                value={parseTime(form.start_time)}
                onChange={(t) => setForm({ ...form, start_time: t ? `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}` : form.start_time })}
                aria-label="Start time"
              >
                <Label className="sr-only">Start time</Label>
                <DateInput className="flex gap-0.5 px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm focus-within:border-accent">
                  {(segment) => (
                    <DateSegment
                      segment={segment}
                      className="outline-none focus:text-accent rounded px-0.5"
                    />
                  )}
                </DateInput>
              </TimeField>
            </div>
            <div>
              <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">End time</label>
              <TimeField
                value={parseTime(form.end_time)}
                onChange={(t) => setForm({ ...form, end_time: t ? `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}` : form.end_time })}
                aria-label="End time"
              >
                <Label className="sr-only">End time</Label>
                <DateInput className="flex gap-0.5 px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm focus-within:border-accent">
                  {(segment) => (
                    <DateSegment
                      segment={segment}
                      className="outline-none focus:text-accent rounded px-0.5"
                    />
                  )}
                </DateInput>
              </TimeField>
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">Mode</label>
            <select
              value={form.mode_id}
              onChange={(e) => setForm({ ...form, mode_id: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm focus:outline-none focus:border-accent appearance-none"
            >
              {MODES_LIST.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Albums */}
          <div>
            <label className="text-xs text-fg-muted uppercase tracking-wider block mb-2">Albums</label>
            <div className="flex flex-wrap gap-1.5">
              {albums.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAlbum(a.id)}
                  className={`px-3 py-1.5 rounded-pill text-sm transition-colors min-h-[40px] ${
                    form.album_ids.includes(a.id)
                      ? 'bg-accent text-bg'
                      : 'bg-fg/10 text-fg hover:bg-fg/15'
                  }`}
                >
                  {a.name}
                </button>
              ))}
              {albums.length === 0 && (
                <span className="text-sm text-fg-muted">No albums available</span>
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs text-fg-muted uppercase tracking-wider block mb-1.5">
              Priority: <span className="text-accent">{form.priority}</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              className="w-full accent-accent h-2 rounded-full cursor-pointer"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" size="md" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="md" onClick={saveSchedule} loading={saving}>
              {editingId ? 'Save changes' : 'Add schedule'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
