import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getOrCreateShareToken } from '@/lib/shareToken';

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const token = await getOrCreateShareToken(auth.user.id);
  return NextResponse.json({ token });
}
