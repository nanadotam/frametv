import { randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { createSessionToken, getDeviceInfo, hashSessionToken } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Short, single-use codes that connect a Mac screensaver without signing in
// inside System Settings: the Mantel app shows one, the screensaver's
// Options panel redeems it for its own per-device token.

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SCREENSAVER_CODE_TTL_MS = 15 * 60 * 1000;

export function newScreensaverCode() {
  const raw = Array.from(randomBytes(8), (b) => CHARS[b % CHARS.length]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function normalizeScreensaverCode(code: string) {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : null;
}

/** Mints a per-device screensaver session (same as /api/screensaver/authorize). */
export async function mintScreensaverToken(request: NextRequest, userId: string) {
  const token = createSessionToken();
  await createServiceClient().from('app_sessions').insert({
    user_id: userId,
    session_hash: hashSessionToken(token),
    kind: 'screensaver',
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    ...getDeviceInfo(request, 'Mantel Screensaver (Mac)'),
  });
  return token;
}
