import { NextResponse } from 'next/server';
import { getSpotifyAuthUrl } from '@/lib/spotify/auth';

export async function GET() {
  const url = getSpotifyAuthUrl();
  return NextResponse.redirect(url);
}
