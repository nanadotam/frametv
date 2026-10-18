import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Google Photos Picker API (the Library API was closed to third parties
// in 2025). Google sign-in happens in the person's real browser — Google
// blocks it inside embedded app browsers like the Mantel Mac app — so the
// flow is tied together by a one-time nonce instead of a cookie:
//
//   start     → nonce row (pending) + Google sign-in URL
//   callback  → token + picker session stored on the nonce row (ready)
//   status    → the app/page polls the nonce until it's ready
//   session / media → use the stored token, only for the nonce's owner

export const GPHOTOS_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
export const PICKER_API = 'https://photospicker.googleapis.com/v1';
const TTL_MS = 55 * 60 * 1000;

export function googlePhotosConfigured() {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function redirectUri(request: NextRequest) {
  return `${request.nextUrl.origin}/api/google-photos/callback`;
}

export type GPhotosAuth = {
  status: 'pending' | 'ready' | 'error';
  expires_at: string;
  token?: string;
  session_id?: string;
  picker_uri?: string;
  error?: string;
};

const key = (nonce: string) => `gpauth:${nonce}`;

export async function createAuth(userId: string, nonce: string) {
  const supabase = createServiceClient();
  // One Google Photos sign-in at a time per account.
  await supabase.from('settings').delete().eq('user_id', userId).like('key', 'gpauth:%');
  const value: GPhotosAuth = { status: 'pending', expires_at: new Date(Date.now() + TTL_MS).toISOString() };
  await supabase.from('settings').insert({ key: key(nonce), user_id: userId, value, updated_at: new Date().toISOString() });
}

export async function readAuth(nonce: string) {
  if (!/^[a-f0-9]{32}$/.test(nonce)) return null;
  const { data } = await createServiceClient().from('settings').select('user_id, value').eq('key', key(nonce)).maybeSingle();
  if (!data) return null;
  const value = data.value as GPhotosAuth;
  if (new Date(value.expires_at).getTime() < Date.now()) return null;
  return { userId: data.user_id as string, value };
}

export async function writeAuth(nonce: string, value: GPhotosAuth) {
  await createServiceClient().from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key(nonce));
}

export async function deleteAuth(nonce: string) {
  await createServiceClient().from('settings').delete().eq('key', key(nonce));
}

export async function pickerFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${PICKER_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Google Photos ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
