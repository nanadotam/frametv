import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL.replace(/\/$/, '');
  return [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/signup`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${base}/login`, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
