import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser, createSessionToken, hashSessionToken, getDeviceInfo } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  // One long-lived token per Mac, scoped to 'screensaver': it opens the
  // read-only display (as /s/<token>) and lets the companion app read modes
  // and switch the active one — nothing else. Being per-device, it can be
  // revoked from Devices without touching other screens.
  const supabase = createServiceClient();
  const deviceToken = createSessionToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
  await supabase.from('app_sessions').insert({
    user_id: auth.user.id,
    session_hash: hashSessionToken(deviceToken),
    kind: 'screensaver',
    expires_at: expires.toISOString(),
    ...getDeviceInfo(request, 'Mantel Screensaver (Mac)'),
  });

  return NextResponse.json({ token: deviceToken, deviceToken });
}
