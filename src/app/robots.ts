import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

// Only the public landing + auth pages are worth indexing; everything else
// is a signed-in dashboard, a personal display, or an API.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/signup'],
      disallow: ['/admin', '/display', '/tv', '/api/', '/s/', '/pair/', '/onboarding', '/screensaver/'],
    },
    sitemap: new URL('/sitemap.xml', SITE_URL).toString(),
  };
}
