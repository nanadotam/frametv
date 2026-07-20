import { randomBytes, pbkdf2Sync, timingSafeEqual, createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const ADMIN_SESSION_COOKIE = 'frametv_session';
export const DISPLAY_SESSION_COOKIE = 'frametv_display_session';

export interface AppUser {
  id: string;
  email: string;
  username: string;
  name: string;
  created_at: string;
}

export interface DeviceInfo {
  device_name?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  browser?: string | null;
  os?: string | null;
  device_type?: string | null;
  country?: string | null;
  city?: string | null;
}

const PASSWORD_ITERATIONS = 120_000;
const PIN_ITERATIONS = 80_000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

function hashSecret(secret: string, iterations: number) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(secret, salt, iterations, KEY_LENGTH, DIGEST).toString('hex');
  return `pbkdf2:${iterations}:${salt}:${hash}`;
}

function verifySecret(secret: string, stored: string) {
  const [scheme, iterationsText, salt, expectedHex] = stored.split(':');
  if (scheme !== 'pbkdf2' || !iterationsText || !salt || !expectedHex) return false;
  const iterations = Number(iterationsText);
  const actual = pbkdf2Sync(secret, salt, iterations, KEY_LENGTH, DIGEST);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashPassword(password: string) {
  return hashSecret(password, PASSWORD_ITERATIONS);
}

export function verifyPassword(password: string, hash: string) {
  return verifySecret(password, hash);
}

export function hashPin(pin: string) {
  return hashSecret(pin, PIN_ITERATIONS);
}

export function verifyPin(pin: string, hash: string) {
  return verifySecret(pin, hash);
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

// Excludes visually ambiguous characters (0/O, 1/I/L) so codes are easy to
// read off a TV screen and type on a phone.
const PAIRING_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function createPairingCode() {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => PAIRING_CODE_CHARS[b % PAIRING_CODE_CHARS.length]).join('');
}

export function normalizePairingCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function getDeviceInfo(request: NextRequest, explicitDeviceName?: string | null): DeviceInfo {
  const userAgent = request.headers.get('user-agent') ?? '';
  const lower = userAgent.toLowerCase();

  // ── Smart TV / streaming box detection (check before generic browser/OS) ──
  const tvPlatform =
    lower.includes('tizen')                            ? 'Samsung Smart TV' :
    lower.includes('web0s') || lower.includes('webos') ? 'LG TV' :
    lower.includes('viera')                            ? 'Panasonic TV' :
    lower.includes('philipstv')                        ? 'Philips TV' :
    lower.includes('bravia') || lower.includes('sonydt') ? 'Sony TV' :
    lower.includes('hbbtv') || lower.includes('netcast') ? 'Smart TV' :
    lower.includes('crkey')                            ? 'Chromecast' :
    lower.includes('googletv') || lower.includes('google tv') ? 'Google TV' :
    lower.includes('androidtv') || lower.includes('android tv') ? 'Android TV' :
    lower.includes('appletv') || lower.includes('apple tv') ? 'Apple TV' :
    lower.includes('roku')                             ? 'Roku' :
    lower.includes('firetv') || lower.includes('fire tv') || lower.includes('aft') ? 'Amazon Fire TV' :
    lower.includes('silk/')                            ? 'Amazon Fire Tablet' :
    lower.includes('playstation 5') || lower.includes('ps5') ? 'PlayStation 5' :
    lower.includes('playstation 4') || lower.includes('ps4') ? 'PlayStation 4' :
    lower.includes('playstation')                      ? 'PlayStation' :
    lower.includes('xbox')                             ? 'Xbox' :
    null;

  const browser =
    lower.includes('edg/') ? 'Edge' :
    lower.includes('chrome/') && !lower.includes('chromium') ? 'Chrome' :
    lower.includes('chromium') ? 'Chromium' :
    lower.includes('safari/') && !lower.includes('chrome/') ? 'Safari' :
    lower.includes('firefox/') ? 'Firefox' :
    lower.includes('opr/') || lower.includes('opera') ? 'Opera' :
    lower.includes('silk/') ? 'Silk' :
    'Unknown';

  const os =
    lower.includes('iphone') ? 'iOS' :
    lower.includes('ipad') ? 'iPadOS' :
    lower.includes('android') ? 'Android' :
    lower.includes('mac os') ? 'macOS' :
    lower.includes('windows') ? 'Windows' :
    lower.includes('linux') ? 'Linux' :
    lower.includes('cros') ? 'ChromeOS' :
    'Unknown';

  const device_type: string =
    tvPlatform ? 'tv' :
    lower.includes('ipad') || lower.includes('tablet') ? 'tablet' :
    lower.includes('mobi') || lower.includes('iphone') || (lower.includes('android') && !lower.includes('tablet')) ? 'mobile' :
    'desktop';

  // ── Build an intelligent display name ──
  let device_name: string | null = explicitDeviceName?.trim() || null;
  if (!device_name) {
    if (tvPlatform) {
      device_name = tvPlatform;
    } else {
      const deviceLabel =
        lower.includes('iphone') ? 'iPhone' :
        lower.includes('ipad') ? 'iPad' :
        lower.includes('macbook') ? 'MacBook' :
        lower.includes('mac os') ? 'Mac' :
        lower.includes('windows') ? 'Windows PC' :
        lower.includes('android') ? 'Android' :
        lower.includes('linux') ? 'Linux PC' :
        lower.includes('cros') ? 'Chromebook' :
        null;
      device_name = deviceLabel && browser !== 'Unknown'
        ? `${deviceLabel} · ${browser}`
        : deviceLabel ?? (browser !== 'Unknown' ? browser : null);
    }
  }

  return {
    device_name,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null,
    user_agent: userAgent || null,
    browser,
    os,
    device_type,
    country: request.headers.get('x-vercel-ip-country') || null,
    city: request.headers.get('x-vercel-ip-city') || null,
  };
}

export function setSessionCookie(response: NextResponse, kind: 'admin' | 'display', token: string, expires: Date) {
  response.cookies.set(kind === 'admin' ? ADMIN_SESSION_COOKIE : DISPLAY_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [ADMIN_SESSION_COOKIE, DISPLAY_SESSION_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
  }
}

async function getSessionUserByCookie(request: NextRequest, cookieName: string, kind?: 'admin' | 'display') {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return null;

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  let query = supabase
    .from('app_sessions')
    .select('id, user_id, kind, app_users(id, email, username, name, created_at)')
    .eq('session_hash', hashSessionToken(token))
    .is('revoked_at', null)
    .gt('expires_at', now);

  if (kind) query = query.eq('kind', kind);
  const { data } = await query.maybeSingle();
  if (!data?.app_users) return null;

  await supabase.from('app_sessions').update({ last_seen_at: now }).eq('id', data.id);
  return data.app_users as unknown as AppUser;
}

export async function getAdminUser(request: NextRequest) {
  return getSessionUserByCookie(request, ADMIN_SESSION_COOKIE, 'admin');
}

export async function getDisplayUser(request: NextRequest) {
  return (
    await getSessionUserByCookie(request, DISPLAY_SESSION_COOKIE, 'display')
  ) ?? (
    await getSessionUserByCookie(request, ADMIN_SESSION_COOKIE, 'admin')
  );
}

export async function requireAdminUser(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { user, response: null };
}

export async function requireDisplayUser(request: NextRequest) {
  const user = await getDisplayUser(request);
  if (!user) return { user: null, response: NextResponse.json({ error: 'Display locked' }, { status: 401 }) };
  return { user, response: null };
}

export async function recordAuthEvent(
  request: NextRequest,
  event_type: 'signup' | 'login' | 'pin_unlock' | 'logout' | 'failed_login' | 'failed_pin' | 'tv_pair_approved' | 'tv_pair_consumed' | 'account_deleted',
  values: { user_id?: string | null; email?: string | null; device_name?: string | null } = {}
) {
  const supabase = createServiceClient();
  const device = getDeviceInfo(request, values.device_name);
  await supabase.from('auth_events').insert({
    event_type,
    user_id: values.user_id ?? null,
    email: values.email ?? null,
    ...device,
  });
}
