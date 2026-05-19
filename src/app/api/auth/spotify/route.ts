import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyAuthUrl } from '@/lib/spotify/auth';

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const url = getSpotifyAuthUrl(origin);
  return NextResponse.redirect(url);
}
