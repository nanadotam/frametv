import { NextRequest, NextResponse } from 'next/server';
import { searchByMood } from '@/lib/unsplash/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mood = searchParams.get('mood');
    const page = parseInt(searchParams.get('page') ?? '1', 10);

    if (!mood) {
      return NextResponse.json({ error: 'mood query parameter is required' }, { status: 400 });
    }

    const result = await searchByMood(mood, page);

    return NextResponse.json(
      {
        photos: result.results,
        total: result.total,
        total_pages: result.total_pages,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        },
      }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
