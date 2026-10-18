import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { readAuth } from '@/lib/googlePhotos/oauth';

// GET ?nonce=&url= — proxies one picked photo (Google needs our token), at
// up to 2560 px so the browser can compress and upload it like any photo.
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;
  const row = await readAuth(request.nextUrl.searchParams.get('nonce') ?? '');
  const url = request.nextUrl.searchParams.get('url') ?? '';
  if (!row || row.userId !== auth.user.id || !row.value.token) return NextResponse.json({ error: 'Google Photos session expired.' }, { status: 401 });
  if (!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//.test(url)) return NextResponse.json({ error: 'Bad URL' }, { status: 400 });

  const res = await fetch(`${url}=w2560-h2560`, { headers: { Authorization: `Bearer ${row.value.token}` } });
  if (!res.ok || !res.body) return NextResponse.json({ error: 'Could not fetch photo' }, { status: 502 });
  return new Response(res.body, { headers: { 'Content-Type': res.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'no-store' } });
}
