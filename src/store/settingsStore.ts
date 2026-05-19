'use client';

import { create } from 'zustand';

interface Location {
  lat: number;
  lng: number;
}

interface DimWindow {
  startMinute: number;
  endMinute: number;
}

interface SettingsStore {
  location: Location | null;
  dim: DimWindow | null;
  setLocation: (location: Location | null) => void;
  setDim: (dim: DimWindow | null) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  location: null,
  dim: null,
  setLocation: (location) => set({ location }),
  setDim: (dim) => set({ dim }),
}));
