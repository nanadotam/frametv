'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Send, Trash2, Clock, Type, CheckCircle2, Radio,
  SlidersHorizontal, Plus, Circle, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { invalidateModes } from '@/hooks/useModes';
import type { FlipboardMessage, Reminder } from '@/types/db';

// ─── Types ────────────────────────────────────────────────────────────────────

type Source = 'messages' | 'reminders' | 'quotes' | 'calendar' | 'weather';
type Priority = Reminder['priority'];

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_SOURCES: { id: Source; label: string; desc: string }[] = [
  { id: 'messages',  label: 'Live Messages',  desc: 'Posts from this page' },
  { id: 'reminders', label: 'Reminders',       desc: 'Eisenhower matrix tasks' },
  { id: 'quotes',    label: 'Quotes',          desc: 'Built-in inspirational quotes' },
  { id: 'calendar',  label: 'Calendar',        desc: 'Coming soon' },
  { id: 'weather',   label: 'Weather',         desc: 'Coming soon' },
];

const EXPIRY_OPTIONS = [
  { value: '0',  label: 'Never expires' },
  { value: '1',  label: '1 hour' },
  { value: '4',  label: '4 hours' },
  { value: '8',  label: '8 hours' },
  { value: '24', label: '24 hours' },
];

const QUADRANTS: { priority: Priority; label: string; sub: string; color: string; border: string; badge: string }[] = [
  { priority: 'urgent_important',         label: 'Do First',  sub: 'Urgent + Important',     color: 'bg-red-500/10',    border: 'border-red-500/40',    badge: 'bg-red-500 text-white' },
  { priority: 'not_urgent_important',     label: 'Schedule',  sub: 'Not Urgent + Important', color: 'bg-yellow-500/10', border: 'border-yellow-500/40', badge: 'bg-yellow-500 text-black' },
  { priority: 'urgent_not_important',     label: 'Delegate',  sub: 'Urgent + Not Important', color: 'bg-blue-500/10',   border: 'border-blue-500/40',   badge: 'bg-blue-500 text-white' },
  { priority: 'not_urgent_not_important', label: 'Eliminate', sub: 'Not Urgent + Not Important', color: 'bg-green-500/10', border: 'border-green-500/40', badge: 'bg-green-500 text-white' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function timeUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BoardPage() {
  // ── Sources ──
  const [sources, setSources] = useState<Source[]>(['messages', 'reminders', 'quotes']);
  const [sourcesLoading, setSourcesLoading] = useState(true);

  // ── Reminders ──
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<Priority, string>>({
    urgent_important: '',
    not_urgent_important: '',
    urgent_not_important: '',
    not_urgent_not_important: '',
  });

  // ── Messages ──
  const [messages, setMessages] = useState<FlipboardMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [expiresIn, setExpiresIn] = useState('0');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Init: load sources ──
  useEffect(() => {
    fetch('/api/modes')
      .then((r) => r.json())
      .then((json) => {
        const modes = Array.isArray(json) ? json : (json.modes ?? []);
        const fb = modes.find((m: { id: string }) => m.id === 'flipboard');
        if (fb?.config?.sources) setSources(fb.config.sources as Source[]);
      })
      .finally(() => setSourcesLoading(false));
  }, []);

  // ── Init: load reminders ──
  const fetchReminders = useCallback(async () => {
    const res = await fetch('/api/reminders');
    if (res.ok) {
      const json = await res.json();
      setReminders(Array.isArray(json) ? json : (json.reminders ?? []));
    }
    setRemindersLoading(false);
  }, []);
  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  // ── Init: load messages ──
  const fetchMessages = useCallback(async () => {
    const res = await fetch('/api/flipboard/messages');
    if (res.ok) {
      const json = await res.json();
      setMessages(json.messages ?? []);
    }
    setMessagesLoading(false);
  }, []);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // ── Sources ──
  const toggleSource = async (src: Source) => {
    const next = sources.includes(src) ? sources.filter((s) => s !== src) : [...sources, src];
    setSources(next);
    const modesRes = await fetch('/api/modes');
    const modesJson = await modesRes.json();
    const modes = Array.isArray(modesJson) ? modesJson : (modesJson.modes ?? []);
    const fb = modes.find((m: { id: string }) => m.id === 'flipboard');
    const currentConfig = fb?.config ?? {};
    await fetch('/api/modes/flipboard/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...currentConfig, sources: next }),
    });
    invalidateModes();
  };

  // ── Reminders ──
  const addReminder = async (priority: Priority) => {
    const t = drafts[priority].trim();
    if (!t) return;
    const res = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t, priority }),
    });
    if (res.ok) {
      const json = await res.json();
      setReminders((prev) => [json.reminder ?? json, ...prev]);
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

  // ── Messages ──
  const sendMessage = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/flipboard/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          author: author.trim() || undefined,
          expires_in_hours: expiresIn === '0' ? undefined : Number(expiresIn),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setMessages((prev) => [json.message, ...prev]);
        setText('');
        setSent(true);
        setTimeout(() => setSent(false), 2000);
      }
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/flipboard/messages/${id}`, { method: 'DELETE' });
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (msg: FlipboardMessage) => {
    const res = await fetch(`/api/flipboard/messages/${msg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !msg.is_active }),
    });
    if (res.ok) {
      const json = await res.json();
      setMessages((prev) => prev.map((m) => m.id === msg.id ? json.message : m));
    }
  };

  const active = reminders.filter((r) => !r.is_done);
  const done   = reminders.filter((r) => r.is_done);
  const charCount = text.length;
  const charWarning = charCount > 80;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Radio size={20} className="text-primary" />
          FlipBoard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {active.length} active reminders · {messages.filter((m) => m.is_active).length} live messages
        </p>
      </div>

      {/* ── Content Sources ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-primary" />
            Content Sources
          </CardTitle>
          <CardDescription>Choose what rotates on the FlipBoard display</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sourcesLoading ? (
            <div className="h-24 bg-muted/30 rounded animate-pulse" />
          ) : (
            ALL_SOURCES.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                <Switch
                  checked={sources.includes(s.id)}
                  onCheckedChange={() => toggleSource(s.id)}
                  disabled={s.id === 'calendar' || s.id === 'weather'}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ── Reminders ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Reminders</h2>
          <p className="text-sm text-muted-foreground">
            Eisenhower matrix · {reminders.filter((r) => r.show_on_board && !r.is_done).length} showing on board
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUADRANTS.map((q) => {
            const items = active.filter((r) => r.priority === q.priority);
            return (
              <div key={q.priority} className={cn('rounded-xl border p-4 space-y-3', q.color, q.border)}>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', q.badge)}>
                    {q.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                  <span className="text-xs text-muted-foreground/50 ml-auto">{q.sub}</span>
                </div>

                {remindersLoading ? (
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
                          <button onClick={() => toggleBoard(r)} title={r.show_on_board ? 'Hide from board' : 'Show on board'}
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

        {/* Completed */}
        {done.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Completed ({done.length})
            </p>
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

      <Separator />

      {/* ── Live Messages ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Live Messages</h2>
          <p className="text-sm text-muted-foreground">Post directly to the split-flap display</p>
        </div>

        {/* Compose */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Type size={14} className="text-primary" />
              Post a Message
            </CardTitle>
            <CardDescription>
              Messages appear in the FlipBoard rotation alongside reminders and quotes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Message</Label>
                <span className={cn('text-xs', charWarning ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                  {charCount} chars{charWarning ? ' — long messages wrap across rows' : ''}
                </span>
              </div>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value.toUpperCase())}
                placeholder="TYPE YOUR MESSAGE HERE…"
                className="font-mono tracking-widest text-sm uppercase"
                maxLength={200}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From (optional)</Label>
                <Input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Your name"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock size={11} /> Expires
                </Label>
                <Select value={expiresIn} onValueChange={(v) => setExpiresIn(v ?? '0')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className={cn('w-full gap-2', sent && 'bg-green-600 hover:bg-green-500')}
              onClick={sendMessage}
              disabled={!text.trim() || sending}
            >
              {sent
                ? <><CheckCircle2 size={15} /> Sent to Board</>
                : sending
                ? 'Sending…'
                : <><Send size={15} /> Post to FlipBoard</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* Message list */}
        {messagesLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl border border-border animate-pulse" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No messages yet. Post one above to see it on the board.
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <Card key={msg.id} className={cn('transition-opacity', !msg.is_active && 'opacity-40')}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-semibold tracking-wider truncate">{msg.text}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {msg.author && (
                          <span className="text-xs text-muted-foreground">— {msg.author}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{timeAgo(msg.created_at)}</span>
                        {msg.expires_at && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-500/40 text-amber-400">
                            {timeUntil(msg.expires_at)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => toggleActive(msg)}>
                        {msg.is_active ? 'Pause' : 'Resume'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteMessage(msg.id)} disabled={deletingId === msg.id}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
