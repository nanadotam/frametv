import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  scope: '/display',
  register: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: /\.(?:jpg|jpeg|png|webp|avif)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'photos',
          expiration: { maxEntries: 5000, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        // Uploaded-photo thumbnail proxy (same-origin, safe to cache)
        urlPattern: ({ url }: { url: URL }) => /^\/api\/photos\/[^/]+\/thumbnail/.test(url.pathname),
        handler: 'CacheFirst',
        options: {
          cacheName: 'photo-thumbs',
          expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
      {
        urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/photos'),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'photo-metadata',
          expiration: { maxAgeSeconds: 60 * 60 * 6 },
        },
      },
      {
        urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/_next/static'),
        handler: 'CacheFirst',
        options: { cacheName: 'next-static' },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  images: {
    remotePatterns: [
      { hostname: '*.supabase.co' },
      { hostname: 'images.unsplash.com' },
      { hostname: 'i.scdn.co' },
      { hostname: 'lh3.googleusercontent.com' },
      { hostname: 'drive.google.com' },
    ],
  },
};

export default withPWA(nextConfig);
