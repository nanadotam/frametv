import { NextRequest } from 'next/server';

// Google Photos Picker API (the Library API was closed to third parties
// in 2025). The user picks photos in Google's own picker; we then copy
// the picked items into a Mantel album, compressed like any upload.

export const GPHOTOS_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
export const PICKER_API = 'https://photospicker.googleapis.com/v1';
export const TOKEN_COOKIE = 'mantel_gphotos';

export function googlePhotosConfigured() {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function redirectUri(request: NextRequest) {
  return `${request.nextUrl.origin}/api/google-photos/callback`;
}

/** Short-lived access token, kept in an httpOnly cookie for the picking session only. */
export function readToken(request: NextRequest): string | null {
  return request.cookies.get(TOKEN_COOKIE)?.value ?? null;
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
