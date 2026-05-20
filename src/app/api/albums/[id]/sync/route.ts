import { NextRequest, NextResponse } from 'next/server';
import { syncDrive } from '@/lib/drive/sync';
import { requireAdminUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const result = await syncDrive(id, auth.user.id);

    return NextResponse.json({
      ok: true,
      synced: result.synced,
      errors: result.errors,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
