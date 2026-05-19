'use client';

import { create } from 'zustand';
import type { Reminder } from '@/types/db';

interface RemindersStore {
  reminders: Reminder[];
  setReminders: (reminders: Reminder[]) => void;
  addReminder: (reminder: Reminder) => void;
  updateReminder: (id: string, patch: Partial<Reminder>) => void;
  removeReminder: (id: string) => void;
}

export const useRemindersStore = create<RemindersStore>((set) => ({
  reminders: [],
  setReminders: (reminders) => set({ reminders }),
  addReminder: (reminder) =>
    set((state) => ({ reminders: [...state.reminders, reminder] })),
  updateReminder: (id, patch) =>
    set((state) => ({
      reminders: state.reminders.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    })),
  removeReminder: (id) =>
    set((state) => ({
      reminders: state.reminders.filter((r) => r.id !== id),
    })),
}));
