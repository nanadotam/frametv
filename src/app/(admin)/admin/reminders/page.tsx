'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Check, Trash2, Eye, EyeOff } from 'lucide-react';
import { Toggle } from '@/components/admin/Toggle';
import type { Reminder, ReminderPriority } from '@/types/db';

type QuadrantConfig = {
  priority: ReminderPriority;
  label: string;
  emoji: string;
  bg: string;
  border: string;
  badge: string;
};

const QUADRANTS: QuadrantConfig[] = [
  {
    priority: 'urgent_important',
    label: 'Urgent + Important',
    emoji: '🔴',
    bg: 'bg-red-950/60',
    border: 'border-red-900/40',
    badge: 'bg-red-500/20 text-red-400',
  },
  {
    priority: 'not_urgent_important',
    label: 'Not Urgent + Important',
    emoji: '🟡',
    bg: 'bg-yellow-950/60',
    border: 'border-yellow-900/40',
    badge: 'bg-yellow-500/20 text-yellow-400',
  },
  {
    priority: 'urgent_not_important',
    label: 'Urgent + Not Important',
    emoji: '🔵',
    bg: 'bg-blue-950/60',
    border: 'border-blue-900/40',
    badge: 'bg-blue-500/20 text-blue-400',
  },
  {
    priority: 'not_urgent_not_important',
    label: 'Not Urgent + Not Important',
    emoji: '🟢',
    bg: 'bg-green-950/60',
    border: 'border-green-900/40',
    badge: 'bg-green-500/20 text-green-400',
  },
];

function RemindersQuadrant({
  config,
  reminders,
  onAdd,
  onMarkDone,
  onDelete,
  onToggleShow,
}: {
  config: QuadrantConfig;
  reminders: Reminder[];
  onAdd: (priority: ReminderPriority, text: string) => Promise<void>;
  onMarkDone: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleShow: (r: Reminder) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    await onAdd(config.priority, text.trim());
    setText('');
    setAdding(false);
  };

  const active = reminders.filter((r) => !r.is_done);
  const done = reminders.filter((r) => r.is_done);

  return (
    <div className={`flex flex-col rounded-xl border ${config.bg} ${config.border} p-4 gap-3 min-h-[220px]`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{config.emoji}</span>
        <h3 className="text-sm font-semibold text-fg">{config.label}</h3>
        {active.length > 0 && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-pill ${config.badge}`}>
            {active.length}
          </span>
        )}
      </div>

      {/* Active reminders */}
      <div className="flex-1 space-y-1.5 overflow-y-auto max-h-48">
        {active.map((r) => (
          <div key={r.id} className="group flex items-start gap-2 py-1.5 px-2 rounded-lg bg-black/20 hover:bg-black/30 transition-colors">
            <p className="flex-1 text-sm text-fg leading-snug min-w-0 break-words">{r.text}</p>
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onToggleShow(r)}
                className="w-7 h-7 rounded flex items-center justify-center text-fg-muted hover:text-fg transition-colors"
                title={r.show_on_board ? 'Hide from board' : 'Show on board'}
              >
                {r.show_on_board ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button
                onClick={() => onMarkDone(r.id)}
                className="w-7 h-7 rounded flex items-center justify-center text-fg-muted hover:text-success transition-colors"
                title="Mark done"
              >
                <Check size={13} />
              </button>
              <button
                onClick={() => onDelete(r.id)}
                className="w-7 h-7 rounded flex items-center justify-center text-fg-muted hover:text-danger transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {done.map((r) => (
          <div key={r.id} className="group flex items-start gap-2 py-1.5 px-2 rounded-lg bg-black/10 opacity-50">
            <p className="flex-1 text-sm text-fg-muted line-through leading-snug break-words">{r.text}</p>
            <button
              onClick={() => onDelete(r.id)}
              className="w-7 h-7 rounded flex items-center justify-center text-fg-dim hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {reminders.length === 0 && (
          <p className="text-xs text-fg-dim text-center py-3">No reminders</p>
        )}
      </div>

      {/* Add form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-auto">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add reminder…"
          className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-fg/10 text-fg text-sm placeholder:text-fg-dim focus:outline-none focus:border-fg/30 min-h-[40px]"
        />
        <button
          type="submit"
          disabled={adding || !text.trim()}
          className="w-10 h-10 rounded-lg bg-fg/15 flex items-center justify-center text-fg hover:bg-fg/25 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <Plus size={16} />
        </button>
      </form>
    </div>
  );
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch('/api/reminders');
      if (res.ok) setReminders(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const addReminder = async (priority: ReminderPriority, text: string) => {
    const res = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, priority, show_on_board: true }),
    });
    if (res.ok) {
      const created: Reminder = await res.json();
      setReminders((prev) => [created, ...prev]);
    }
  };

  const markDone = async (id: string) => {
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, is_done: true } : r));
    await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_done: true }),
    });
  };

  const deleteReminder = async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
  };

  const toggleShow = async (reminder: Reminder) => {
    const next = !reminder.show_on_board;
    setReminders((prev) => prev.map((r) => r.id === reminder.id ? { ...r, show_on_board: next } : r));
    await fetch(`/api/reminders/${reminder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ show_on_board: next }),
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 pt-2">
        <div>
          <h1 className="text-2xl font-semibold font-display text-fg">Reminders</h1>
          <p className="text-sm text-fg-muted mt-0.5">Eisenhower priority matrix</p>
        </div>
      </div>

      {loading ? (
        <div className="text-fg-muted text-sm text-center py-12">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {QUADRANTS.map((q) => (
            <RemindersQuadrant
              key={q.priority}
              config={q}
              reminders={reminders.filter((r) => r.priority === q.priority)}
              onAdd={addReminder}
              onMarkDone={markDone}
              onDelete={deleteReminder}
              onToggleShow={toggleShow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
