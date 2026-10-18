import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { deleteAuth, readAuth } from '@/lib/googlePhotos/oauth';

// GET ?nonce= — has the person finished signing in to Google yet?
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;
  const row = await readAuth(request.nextUrl.searchParams.get('nonce') ?? '');
  if (!row || row.userId !== auth.user.id) return NextResponse.json({ status: 'expired' });
  return NextResponse.json({ status: row.value.status, pickerUri: row.value.picker_uri ?? null, error: row.value.error ?? null });
}

// DELETE ?nonce= — forget the Google token once the import is done.
export async function DELETE(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;
  const nonce = request.nextUrl.searchParams.get('nonce') ?? '';
  const row = await readAuth(nonce);
  if (row?.userId === auth.user.id) await deleteAuth(nonce);
  return NextResponse.json({ ok: true });
}
