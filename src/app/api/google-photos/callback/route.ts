import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { pickerFetch, redirectUri, TOKEN_COOKIE } from '@/lib/googlePhotos/oauth';

// GET — Google sends the user back here; we start a picking session and
// hand over to the import page, which opens Google's picker.
export async function GET(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.redirect(new URL('/login?next=/admin/albums', request.url));

  const p = request.nextUrl.searchParams;
  const fail = (why: string) => NextResponse.redirect(new URL(`/admin/albums?gphotos=${why}`, request.url));
  if (p.get('error')) return fail('denied');
  if (!p.get('code') || p.get('state') !== request.cookies.get('mantel_gphotos_state')?.value) return fail('error');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: p.get('code')!,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri(request),
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) return fail('error');
  const { access_token, expires_in } = (await tokenRes.json()) as { access_token: string; expires_in: number };

  const session = (await pickerFetch(access_token, '/sessions', { method: 'POST', body: '{}' })) as { id: string; pickerUri: string };

  const res = NextResponse.redirect(
    new URL(`/admin/google-photos?session=${encodeURIComponent(session.id)}&picker=${encodeURIComponent(session.pickerUri)}`, request.url)
  );
  res.cookies.set(TOKEN_COOKIE, access_token, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: Math.min(expires_in ?? 3600, 3600) });
  res.cookies.delete('mantel_gphotos_state');
  return res;
}
