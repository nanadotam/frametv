import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getVideoUsage } from '@/lib/video/quota';

// GET /api/videos/usage — bytes used by this account's uploaded videos vs. its allowance.
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;
  return NextResponse.json(await getVideoUsage(auth.user.id));
}
