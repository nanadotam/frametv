// Unsplash client — PRD §7.8
// Rate limits: 50 req/hr (demo), 5000/hr (production)
// Results cached 24h via Next.js fetch cache

const UNSPLASH_BASE = 'https://api.unsplash.com';
export const UTM = 'utm_source=frametv&utm_medium=referral';

export interface UnsplashPhoto {
  id: string;
  urls: {
    regular: string;
    full: string;
    small: string;
  };
  user: {
    name: string;
    links: {
      html: string;
    };
  };
  links: {
    download_location: string;
  };
  width: number;
  height: number;
  alt_description: string | null;
}

export interface UnsplashSearchResult {
  results: UnsplashPhoto[];
  total: number;
  total_pages: number;
}

export async function searchByMood(
  mood: string,
  page = 1
): Promise<UnsplashSearchResult> {
  const url = new URL(`${UNSPLASH_BASE}/search/photos`);
  url.searchParams.set('query', mood);
  url.searchParams.set('per_page', '30');
  url.searchParams.set('page', String(page));
  url.searchParams.set('orientation', 'landscape');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
    },
    next: { revalidate: 60 * 60 * 24 }, // cache 24h
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unsplash search failed: ${res.status} — ${text}`);
  }

  return res.json() as Promise<UnsplashSearchResult>;
}

export async function trackDownload(downloadLocation: string): Promise<void> {
  // Required by Unsplash API guidelines when displaying a photo
  await fetch(downloadLocation, {
    headers: {
      Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
    },
  });
}
