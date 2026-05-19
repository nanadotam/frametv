'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Reminder, ReminderPriority } from '@/types/db';

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

export type Source = 'reminders' | 'calendar' | 'weather' | 'quotes';

interface UseFlipboardMessagesProps {
  sources: Source[];
  secondsPerMessage: number;
}

export function useFlipboardMessages({ sources, secondsPerMessage }: UseFlipboardMessagesProps) {
  const [reminders, setReminders] = useState<FlipMessage[]>([]);
  const [current, setCurrent] = useState<FlipMessage | null>(null);
  const indexRef = useRef(0);

  // Fetch reminders whenever sources include 'reminders'
  useEffect(() => {
    if (!sources.includes('reminders')) { setReminders([]); return; }
    const supabase = createClient();
    supabase
      .from('reminders')
      .select('*')
      .eq('show_on_board', true)
      .eq('is_done', false)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: Reminder[] | null }) => {
        if (data) {
          setReminders(
            data.map((r) => ({
              text: r.text.toUpperCase(),
              bgColor: PRIORITY_COLORS[r.priority],
            }))
          );
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.join(',')]);

  const buildQueue = useCallback((): FlipMessage[] => {
    const queue: FlipMessage[] = [];
    for (const src of sources) {
      if (src === 'reminders')  queue.push(...reminders);
      if (src === 'quotes')     queue.push(...QUOTES);
      // calendar / weather: placeholders until integrations are live
      if (src === 'calendar')   queue.push({ text: 'CALENDAR COMING SOON' });
      if (src === 'weather')    queue.push({ text: 'WEATHER COMING SOON' });
    }
    return queue.length > 0 ? queue : [{ text: 'FRAME TV' }];
  }, [sources, reminders]);

  const advance = useCallback(() => {
    const queue = buildQueue();
    indexRef.current = (indexRef.current + 1) % queue.length;
    setCurrent(queue[indexRef.current] ?? null);
  }, [buildQueue]);

  // Bootstrap first message
  useEffect(() => {
    const queue = buildQueue();
    indexRef.current = 0;
    setCurrent(queue[0] ?? null);
  }, [buildQueue]);

  // Auto-advance
  useEffect(() => {
    const id = setInterval(advance, secondsPerMessage * 1000);
    return () => clearInterval(id);
  }, [advance, secondsPerMessage]);

  return { current, advance };
}
