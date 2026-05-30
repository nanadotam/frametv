import { NextRequest, NextResponse } from 'next/server';
import { requireDisplayUser } from '@/lib/auth';
import { getAccessToken } from '@/lib/spotify/auth';

export async function GET(request: NextRequest) {
  const auth = await requireDisplayUser(request);
  if (auth.response) return auth.response;

  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Spotify not connected' }, { status: 401 });

  return NextResponse.json({ token });
}
