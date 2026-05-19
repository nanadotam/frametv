'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CalendarDays, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Schedule, Album } from '@/types/db';

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
      if (schRes.ok) {
        const json = await schRes.json();
        setSchedules(Array.isArray(json) ? json : (json.schedules ?? []));
      }
      if (albRes.ok) {
        const json = await albRes.json();
        const list: Album[] = Array.isArray(json) ? json : (json.albums ?? []);
        setAlbums(list.filter((a) => !a.is_archived));
      }
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
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-switch modes at specific times · {schedules.filter(s => s.is_enabled).length} active
          </p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus size={14} /> Add schedule
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card animate-pulse h-24" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No schedules yet</p>
          <p className="text-sm mt-1">Add one to auto-switch modes at specific times</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{s.name}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          s.is_enabled
                            ? 'border-green-500/40 text-green-400 bg-green-500/10'
                            : 'border-border text-muted-foreground'
                        )}
                      >
                        {s.is_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {DAY_LABELS.map((d, i) => (
                        <span
                          key={i}
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            s.days_of_week.includes(i)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {d}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock size={11} />
                      <span>{s.start_time} – {s.end_time}</span>
                      <span className="text-border">·</span>
                      <span>{modeLabel(s.mode_id)}</span>
                      <span className="text-border">·</span>
                      <span>Priority {s.priority}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={s.is_enabled}
                      onCheckedChange={() => toggleEnabled(s)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => openEdit(s)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:text-destructive"
                      onClick={() => deleteSchedule(s.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit schedule' : 'Add schedule'}</DialogTitle>
            <DialogDescription>Configure when and what to show on the TV.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Morning routine"
              />
            </div>

            <div className="space-y-2">
              <Label>Days</Label>
              <div className="flex gap-1.5 flex-wrap">
                {DAY_LABELS.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-all border',
                      form.days_of_week.includes(i)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start time</Label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End time</Label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={form.mode_id ?? ''} onValueChange={(v) => setForm({ ...form, mode_id: v ?? '' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES_LIST.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {albums.length > 0 && (
              <div className="space-y-2">
                <Label>Albums</Label>
                <div className="flex flex-wrap gap-1.5">
                  {albums.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAlbum(a.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm font-medium transition-all border',
                        form.album_ids.includes(a.id)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                      )}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Priority</Label>
                <span className="text-sm font-semibold text-primary">{form.priority}</span>
              </div>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[form.priority]}
                onValueChange={(vals) => setForm({ ...form, priority: Number(Array.isArray(vals) ? vals[0] : vals) })}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low (1)</span>
                <span>High (10)</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={saveSchedule} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
