'use client';

import { create } from 'zustand';
import type { DisplayState } from '@/types/db';

interface DisplayStore {
  displayState: DisplayState | null;
  setDisplayState: (state: DisplayState | null) => void;
}

export const useDisplayStore = create<DisplayStore>((set) => ({
  displayState: null,
  setDisplayState: (state) => set({ displayState: state }),
}));
