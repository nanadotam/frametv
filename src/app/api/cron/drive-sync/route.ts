import { NextRequest, NextResponse } from 'next/server';
import { syncDrive } from '@/lib/drive/sync';

export async function GET(request: NextRequest) {
  // Protect the cron endpoint with a shared secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncDrive();
    return NextResponse.json({ ok: true, synced: result.synced, errors: result.errors });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
