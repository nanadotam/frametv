import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAdminUser } from '@/lib/auth';
import { createAuth, GPHOTOS_SCOPE, googlePhotosConfigured, redirectUri } from '@/lib/googlePhotos/oauth';

// GET ?format=json — { url, nonce }: open `url` in the real browser, then
// poll /api/google-photos/status?nonce=. Without format=json, redirects
// straight to Google (and comes back to the import page afterwards).
export async function GET(request: NextRequest) {
  const user = await getAdminUser(request);
  const json = request.nextUrl.searchParams.get('format') === 'json';
  if (!user) return json ? NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) : NextResponse.redirect(new URL('/login?next=/admin/albums', request.url));
  if (!googlePhotosConfigured()) {
    return json
      ? NextResponse.json({ error: 'Google Photos isn’t switched on yet.' }, { status: 503 })
      : NextResponse.redirect(new URL('/admin/albums?gphotos=unavailable', request.url));
  }

  const nonce = randomBytes(16).toString('hex');
  await createAuth(user.id, nonce);
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri(request),
    response_type: 'code',
    scope: GPHOTOS_SCOPE,
    state: nonce,
    prompt: 'select_account',
  })}`;

  return json ? NextResponse.json({ url, nonce }) : NextResponse.redirect(url);
}
