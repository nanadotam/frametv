'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getRealtimeClient } from '@/lib/supabase/realtime';
import type { Reminder, ReminderPriority, FlipboardMessage } from '@/types/db';

export interface FlipMessage {
  text: string;
  bgColor?: string;
}

const PRIORITY_COLORS: Record<ReminderPriority, string> = {
  urgent_important:         '#e53935',
  not_urgent_important:     '#fbc02d',
  urgent_not_important:     '#1e88e5',
  not_urgent_not_important: '#43a047',
};

const QUOTES: FlipMessage[] = [
  { text: 'GOD IS IN THE DETAILS - MIES VAN DER ROHE' },
  { text: 'STAY HUNGRY STAY FOOLISH - STEVE JOBS' },
  { text: 'GOOD DESIGN IS GOOD BUSINESS - THOMAS WATSON' },
  { text: 'LESS IS MORE - MIES VAN DER ROHE' },
  { text: 'MAKE IT SIMPLE BUT SIGNIFICANT - DON DRAPER' },
  { text: 'HAVE NO FEAR OF PERFECTION - SALVADOR DALI' },
  { text: 'DONE IS BETTER THAN PERFECT' },
  { text: 'FOCUS ON PROGRESS NOT PERFECTION' },
];

export type Source = 'reminders' | 'calendar' | 'weather' | 'quotes' | 'messages';

interface UseFlipboardMessagesProps {
  sources: Source[];
  secondsPerMessage: number;
}

export function useFlipboardMessages({ sources, secondsPerMessage }: UseFlipboardMessagesProps) {
  const [reminders, setReminders]     = useState<FlipMessage[]>([]);
  const [boardMessages, setBoardMessages] = useState<FlipMessage[]>([]);
  const [current, setCurrent]         = useState<FlipMessage | null>(null);
  const indexRef                      = useRef(0);
  const sourceKey                     = sources.join(',');

  // Fetch reminders from Supabase
  useEffect(() => {
    if (!sources.includes('reminders')) {
      const timeout = window.setTimeout(() => setReminders([]), 0);
      return () => clearTimeout(timeout);
    }
    const fetchReminders = async () => {
      const res = await fetch('/api/reminders');
      if (!res.ok) return;
      const json = await res.json();
      const data = (json.reminders ?? []) as Reminder[];
        if (data) {
          setReminders(
            data.map((r) => ({
              text: r.text.toUpperCase(),
              bgColor: PRIORITY_COLORS[r.priority],
            }))
          );
        }
    };
    fetchReminders();
    const supabase = getRealtimeClient();
    const channel = supabase
      .channel('flipboard_reminders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, fetchReminders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  // Fetch custom flipboard messages from the board messages table
  useEffect(() => {
    if (!sources.includes('messages')) {
      const timeout = window.setTimeout(() => setBoardMessages([]), 0);
      return () => clearTimeout(timeout);
    }
    const fetchMessages = async () => {
      try {
        const res = await fetch('/api/flipboard/messages');
        if (res.ok) {
          const json = await res.json();
          setBoardMessages(
            (json.messages as FlipboardMessage[]).map((m) => ({
              text: m.author
                ? `${m.text.toUpperCase()} - ${m.author.toUpperCase()}`
                : m.text.toUpperCase(),
            }))
          );
        }
      } catch { /* network error — skip */ }
    };
    fetchMessages();
    const id = setInterval(fetchMessages, 5_000);
    const supabase = getRealtimeClient();
    const channel = supabase
      .channel('flipboard_messages_changes_client')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flipboard_messages' }, fetchMessages)
      .subscribe();
    return () => {
      clearInterval(id);
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  const buildQueue = useCallback((): FlipMessage[] => {
    const queue: FlipMessage[] = [];
    for (const src of sources) {
      if (src === 'messages')   queue.push(...boardMessages);
      if (src === 'reminders')  queue.push(...reminders);
      if (src === 'quotes')     queue.push(...QUOTES);
      if (src === 'calendar')   queue.push({ text: 'CALENDAR INTEGRATION COMING SOON' });
      if (src === 'weather')    queue.push({ text: 'WEATHER INTEGRATION COMING SOON' });
    }
    return queue.length > 0 ? queue : [{ text: 'FRAME TV' }];
  }, [sources, reminders, boardMessages]);

  const advance = useCallback(() => {
    const queue = buildQueue();
    indexRef.current = (indexRef.current + 1) % queue.length;
    setCurrent(queue[indexRef.current] ?? null);
  }, [buildQueue]);

  // Bootstrap first message
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const queue = buildQueue();
      indexRef.current = 0;
      setCurrent(queue[0] ?? null);
    }, 0);
    return () => clearTimeout(timeout);
  }, [buildQueue]);

  // Auto-advance
  useEffect(() => {
    const id = setInterval(advance, secondsPerMessage * 1000);
    return () => clearInterval(id);
  }, [advance, secondsPerMessage]);

  return { current, advance };
}
