'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

type ToastItem = { id: number; message: string; tone: 'ok' | 'error' };

let nextId = 1;
const listeners = new Set<(t: ToastItem) => void>();

/** Fire-and-forget toast. `toast.error()` for failures. */
export function toast(message: string) {
  const t = { id: nextId++, message, tone: 'ok' as const };
  listeners.forEach((fn) => fn(t));
}
toast.error = (message: string) => {
  const t = { id: nextId++, message, tone: 'error' as const };
  listeners.forEach((fn) => fn(t));
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (t: ToastItem) => {
      setItems((prev) => [...prev.slice(-2), t]);
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.tone === 'error' ? 5000 : 2200);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 safe-top" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex max-w-sm items-center gap-2 rounded-full bg-elevated/95 px-4 py-2.5 text-[15px] font-medium shadow-[0_10px_30px_rgb(0_0_0/0.18)] ring-1 ring-separator backdrop-blur-xl',
            'animate-in fade-in-0 slide-in-from-top-2'
          )}
        >
          {t.tone === 'ok' ? (
            <CheckCircle size={20} weight="fill" className="text-ok" />
          ) : (
            <WarningCircle size={20} weight="fill" className="text-bad" />
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}
