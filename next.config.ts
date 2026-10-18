import type { NextConfig } from 'next';
// Offline caching for the display lives in public/sw.js (hand-written —
// the next-pwa plugin doesn't run under Turbopack builds).

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

export default nextConfig;
