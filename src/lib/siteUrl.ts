/** Canonical public origin, for metadata, robots and sitemap. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://frametv.vercel.app');
