import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAdminUser } from '@/lib/auth';
import { GPHOTOS_SCOPE, googlePhotosConfigured, redirectUri } from '@/lib/googlePhotos/oauth';

// GET — sends the user to Google to allow picking from Google Photos.
export async function GET(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.redirect(new URL('/login?next=/admin/albums', request.url));
  if (!googlePhotosConfigured()) return NextResponse.redirect(new URL('/admin/albums?gphotos=unavailable', request.url));

  const state = randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri(request),
    response_type: 'code',
    scope: GPHOTOS_SCOPE,
    state,
    prompt: 'select_account',
    include_granted_scopes: 'true',
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set('mantel_gphotos_state', state, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 600 });
  return res;
}
