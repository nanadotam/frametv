'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'mantel-theme';

/**
 * Inline <head> script: applies the saved appearance before first paint so
 * there's no light/dark flash. Kept as a string so the root layout can
 * render it without shipping this module to the server.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem('${KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(location.pathname.indexOf('/display')===0)d=true;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

const listeners = new Set<() => void>();

function apply(pref: ThemePref) {
  const dark =
    pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

function read(): ThemePref {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(KEY) as ThemePref | null) ?? 'system';
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystem = () => {
    if (read() === 'system') apply('system');
    cb();
  };
  mq.addEventListener('change', onSystem);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', onSystem);
  };
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, read, () => 'system' as ThemePref);
  const setPref = useCallback((next: ThemePref) => {
    localStorage.setItem(KEY, next);
    apply(next);
    listeners.forEach((fn) => fn());
  }, []);
  return { pref, setPref };
}
