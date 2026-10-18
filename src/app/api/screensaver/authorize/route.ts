import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { mintScreensaverToken } from '@/lib/screensaverCode';

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  // One long-lived token per Mac, scoped to 'screensaver': it opens the
  // read-only display (as /s/<token>) and lets the Options panel read
  // looks and switch the active one — nothing else. Revocable per device.
  const deviceToken = await mintScreensaverToken(request, auth.user.id);
  return NextResponse.json({ token: deviceToken, deviceToken });
}
