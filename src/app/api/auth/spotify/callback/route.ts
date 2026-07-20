import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/spotify/auth';
import { getAdminUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/settings?spotify=error&reason=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/admin/settings?spotify=error&reason=no_code', request.url)
    );
  }

  const user = await getAdminUser(request);
  if (!user) {
    return NextResponse.redirect(
      new URL('/login?next=/admin/settings', request.url)
    );
  }

  try {
    const origin = new URL(request.url).origin;
    await exchangeCode(code, origin, user.id);
    return NextResponse.redirect(
      new URL('/admin/settings?spotify=connected', request.url)
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(
        `/admin/settings?spotify=error&reason=${encodeURIComponent(message)}`,
        request.url
      )
    );
  }
}
