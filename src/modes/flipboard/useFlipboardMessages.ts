'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Reminder, ReminderPriority } from '@/types/db';

export interface FlipMessage {
  text: string;
  bgColor?: string;
}

const PRIORITY_COLORS: Record<ReminderPriority, string> = {
  urgent_important: '#e53935',
  not_urgent_important: '#fbc02d',
  urgent_not_important: '#1e88e5',
  not_urgent_not_important: '#43a047',
};

const QUOTES: FlipMessage[] = [
  { text: 'THE SECRET OF GETTING AHEAD IS GETTING STARTED.' },
  { text: 'DONE IS BETTER THAN PERFECT.' },
  { text: 'FOCUS ON PROGRESS, NOT PERFECTION.' },
  { text: 'SMALL STEPS EVERY DAY ADD UP TO BIG CHANGES.' },
  { text: 'YOUR FUTURE SELF WILL THANK YOU.' },
];

function formatTime(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const mm = String(m).padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
}

type Source = 'reminders' | 'quotes' | 'time';

interface UseFlipboardMessagesProps {
  sources: Source[];
  secondsPerMessage: number;
}

export function useFlipboardMessages({
  sources,
  secondsPerMessage,
}: UseFlipboardMessagesProps) {
  const [reminders, setReminders] = useState<FlipMessage[]>([]);
  const [current, setCurrent] = useState<FlipMessage | null>(null);
  const queueRef = useRef<FlipMessage[]>([]);
  const indexRef = useRef(0);

  // Fetch reminders from Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('reminders')
      .select('*')
      .eq('show_on_board', true)
      .eq('is_done', false)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: Reminder[] | null }) => {
        if (data) {
          const msgs: FlipMessage[] = data.map((r) => ({
            text: r.text.toUpperCase(),
            bgColor: PRIORITY_COLORS[r.priority],
          }));
          setReminders(msgs);
        }
      });
  }, []);

  // Build a queue from all enabled sources
  const buildQueue = useCallback((): FlipMessage[] => {
    const queue: FlipMessage[] = [];
    for (const src of sources) {
      if (src === 'reminders') {
        queue.push(...reminders);
      } else if (src === 'quotes') {
        queue.push(...QUOTES);
      } else if (src === 'time') {
        queue.push({ text: formatTime() });
      }
    }
    return queue.length > 0 ? queue : [{ text: 'FRAME TV' }];
  }, [sources, reminders]);

  const advance = useCallback(() => {
    const queue = buildQueue();
    queueRef.current = queue;
    indexRef.current = (indexRef.current + 1) % queue.length;
    // Refresh time message if it's next
    const next = queue[indexRef.current];
    if (next && sources.includes('time') && !next.bgColor) {
      // Re-compute time in case it's the time slot
      const timeSlotIdx = queue.findIndex(
        (m) => !m.bgColor && QUOTES.every((q) => q.text !== m.text)
      );
      if (indexRef.current === timeSlotIdx) {
        setCurrent({ text: formatTime() });
        return;
      }
    }
    setCurrent(next ?? null);
  }, [buildQueue, sources]);

  // Bootstrap first message
  useEffect(() => {
    const queue = buildQueue();
    queueRef.current = queue;
    indexRef.current = 0;
    setCurrent(queue[0] ?? null);
  }, [buildQueue]);

  // Auto-advance on interval
  useEffect(() => {
    const id = setInterval(advance, secondsPerMessage * 1000);
    return () => clearInterval(id);
  }, [advance, secondsPerMessage]);

  return { current, advance };
}
