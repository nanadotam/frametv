import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser, createSessionToken, hashSessionToken, getDeviceInfo } from '@/lib/auth';
import { getOrCreateShareToken } from '@/lib/shareToken';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const token = await getOrCreateShareToken(auth.user.id);

  // Long-lived bearer token for the companion app's mode-picker — scoped to
  // 'screensaver' (read modes, change active mode only), separate from the
  // display link above which is read-only and separate from a full admin
  // session which would be far too broad to hand to a native app.
  const supabase = createServiceClient();
  const deviceToken = createSessionToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
  await supabase.from('app_sessions').insert({
    user_id: auth.user.id,
    session_hash: hashSessionToken(deviceToken),
    kind: 'screensaver',
    expires_at: expires.toISOString(),
    ...getDeviceInfo(request, 'FrameTV Screensaver (Mac)'),
  });

  return NextResponse.json({ token, deviceToken });
}
