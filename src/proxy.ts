import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

// Smart TV browser User-Agent patterns.
// Covers Samsung Tizen, LG webOS, HbbTV (Panasonic/Philips/Hisense),
// Amazon Fire TV, Hisense VIDAA, Sony Bravia, Roku, and Chromecast.
// Xbox and Android TV/Google TV are intentionally excluded — they run
// modern Chromium and handle the full React display page fine.
const TV_UA = /Tizen|webOS|Web0S|SMART-TV|SmartTV|HbbTV|NetCast|CrKey|Roku|AmazonWebAppPlatform|VIDAA|BRAVIA/i;

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Route TV browsers visiting /display to the lightweight /tv page.
  // Append ?full to the URL to bypass this and get the full React display.
  if (
    pathname === '/display' &&
    !request.nextUrl.searchParams.has('full') &&
    TV_UA.test(request.headers.get('user-agent') ?? '')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/tv';
    url.search = '';
    return NextResponse.rewrite(url);
  }

  if (pathname.startsWith('/admin') && !request.cookies.get('frametv_session')?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — keeps auth tokens alive
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on all routes except static files and _next internals
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js).*)',
  ],
};
