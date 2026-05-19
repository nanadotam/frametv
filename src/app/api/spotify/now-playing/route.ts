import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/spotify/auth';
import { getNowPlayingWithQueue } from '@/lib/spotify/now-playing';

export async function GET() {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json({ current: null, reason: 'not_authenticated' });
    }

    const result = await getNowPlayingWithQueue(accessToken);

    if (!result) {
      return NextResponse.json({ current: null, reason: 'nothing_playing' });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
