import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyAuthUrl } from '@/lib/spotify/auth';
import { getAdminUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=/admin/settings', request.url));
  }

  const origin = new URL(request.url).origin;
  const url = getSpotifyAuthUrl(origin);
  return NextResponse.redirect(url);
}
