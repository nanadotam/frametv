'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Trash2, Eye, EyeOff, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Reminder } from '@/types/db';

type Priority = Reminder['priority'];

const QUADRANTS: { priority: Priority; label: string; sub: string; color: string; border: string; badge: string }[] = [
  {
    priority: 'urgent_important',
    label: 'Do First',
    sub: 'Urgent + Important',
    color: 'bg-red-500/10',
    border: 'border-red-500/40',
    badge: 'bg-red-500 text-white',
  },
  {
    priority: 'not_urgent_important',
    label: 'Schedule',
    sub: 'Not Urgent + Important',
    color: 'bg-yellow-500/10',
    border: 'border-yellow-500/40',
    badge: 'bg-yellow-500 text-black',
  },
  {
    priority: 'urgent_not_important',
    label: 'Delegate',
    sub: 'Urgent + Not Important',
    color: 'bg-blue-500/10',
    border: 'border-blue-500/40',
    badge: 'bg-blue-500 text-white',
  },
  {
    priority: 'not_urgent_not_important',
    label: 'Eliminate',
    sub: 'Not Urgent + Not Important',
    color: 'bg-green-500/10',
    border: 'border-green-500/40',
    badge: 'bg-green-500 text-white',
  },
];

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<Priority, string>>({
    urgent_important: '',
    not_urgent_important: '',
    urgent_not_important: '',
    not_urgent_not_important: '',
  });

  const fetchReminders = useCallback(async () => {
    const res = await fetch('/api/reminders');
    if (res.ok) {
      const json = await res.json();
      setReminders(Array.isArray(json) ? json : (json.reminders ?? []));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const addReminder = async (priority: Priority) => {
    const text = drafts[priority].trim();
    if (!text) return;
    const res = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, priority }),
    });
    if (res.ok) {
      const json = await res.json();
      const created: Reminder = json.reminder ?? json;
      setReminders((prev) => [created, ...prev]);
      setDrafts((d) => ({ ...d, [priority]: '' }));
    }
  };

  const markDone = async (id: string) => {
    await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_done: true }),
    });
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, is_done: true } : r));
  };

  const deleteReminder = async (id: string) => {
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleBoard = async (r: Reminder) => {
    const next = !r.show_on_board;
    await fetch(`/api/reminders/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ show_on_board: next }),
    });
    setReminders((prev) => prev.map((x) => x.id === r.id ? { ...x, show_on_board: next } : x));
  };

  const active = reminders.filter((r) => !r.is_done);
  const done = reminders.filter((r) => r.is_done);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Reminders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Eisenhower matrix · {active.length} active · {reminders.filter((r) => r.show_on_board && !r.is_done).length} showing on FlipBoard
        </p>
      </div>

      {/* 2×2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUADRANTS.map((q) => {
          const items = active.filter((r) => r.priority === q.priority);
          return (
            <div key={q.priority} className={cn('rounded-xl border p-4 space-y-3', q.color, q.border)}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', q.badge)}>
                      {q.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{q.sub}</p>
                </div>
              </div>

              {/* Items */}
              {loading ? (
                <div className="h-8 bg-background/50 rounded animate-pulse" />
              ) : items.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic py-1">Nothing here</p>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((r) => (
                    <li key={r.id} className="flex items-start gap-2 group bg-background/60 rounded-lg px-3 py-2 border border-border/50">
                      <button onClick={() => markDone(r.id)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-500 transition-colors">
                        <Circle size={14} />
                      </button>
                      <span className="flex-1 text-sm leading-snug">{r.text}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => toggleBoard(r)} title={r.show_on_board ? 'Hide from FlipBoard' : 'Show on FlipBoard'}
                          className="text-muted-foreground hover:text-foreground transition-colors">
                          {r.show_on_board ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button onClick={() => deleteReminder(r.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {r.show_on_board && (
                        <Badge variant="outline" className="text-[9px] h-4 shrink-0">board</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Add input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add task…"
                  value={drafts[q.priority]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [q.priority]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addReminder(q.priority)}
                  className="h-8 text-sm bg-background/80"
                />
                <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0"
                  onClick={() => addReminder(q.priority)} disabled={!drafts[q.priority].trim()}>
                  <Plus size={13} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Done section */}
      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Completed ({done.length})</p>
          <div className="space-y-1">
            {done.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 text-muted-foreground">
                <CheckCircle2 size={13} className="text-green-500/60 shrink-0" />
                <span className="text-sm line-through flex-1">{r.text}</span>
                <button onClick={() => deleteReminder(r.id)} className="hover:text-destructive transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
