import type { Schedule } from '@/types/db';

export function findActiveSchedule(
  schedules: Schedule[],
  now: Date = new Date()
): Schedule | null {
  const dow = now.getDay();
  const curMinutes = now.getHours() * 60 + now.getMinutes();

  const matching = schedules.filter((s) => {
    if (!s.is_enabled) return false;
    if (
      s.days_of_week &&
      s.days_of_week.length > 0 &&
      !s.days_of_week.includes(dow)
    ) {
      return false;
    }
    const start = parseTimeToMinutes(s.start_time);
    const end = parseTimeToMinutes(s.end_time);
    // Handle overnight ranges (e.g. 23:00–06:00)
    if (start <= end) {
      return curMinutes >= start && curMinutes < end;
    } else {
      return curMinutes >= start || curMinutes < end;
    }
  });

  if (matching.length === 0) return null;
  return matching.sort((a, b) => b.priority - a.priority)[0];
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
