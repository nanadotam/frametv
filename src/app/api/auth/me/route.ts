import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, getDisplayUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const adminUser = await getAdminUser(request);
  if (adminUser) return NextResponse.json({ user: adminUser, kind: 'admin' });

  const displayUser = await getDisplayUser(request);
  if (displayUser) return NextResponse.json({ user: displayUser, kind: 'display' });

  return NextResponse.json({ user: null, kind: null }, { status: 401 });
}
