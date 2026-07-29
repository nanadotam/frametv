import type { Photo } from '@/types/db';

// Sentinel albumId recognized by usePhotos to short-circuit to the native
// frametv-local:// scheme handler instead of /api/photos. Never a real row
// in the `albums` table — these photos never touch Supabase.
export const LOCAL_ALBUM_ID = 'local';

interface LocalManifestEntry {
  id: string;
  width: number;
  height: number;
  aspect_ratio: number;
  filename: string;
}

// Only resolves inside the macOS screensaver's WKWebView, where native code
// registers the frametv-local:// scheme handler. In a normal browser this
// scheme is unregistered and the fetch rejects — caught below so the page
// degrades to "no local photos" instead of a thrown query error.
export async function fetchLocalPhotos(): Promise<Photo[]> {
  try {
    const res = await fetch('frametv-local://index');
    if (!res.ok) return [];
    const { photos } = (await res.json()) as { photos: LocalManifestEntry[] };
    return photos.map(localEntryToPhoto);
  } catch {
    return [];
  }
}

function localEntryToPhoto(entry: LocalManifestEntry): Photo {
  const url = `frametv-local://photo/${entry.id}`;
  return {
    id: entry.id,
    user_id: null,
    album_id: LOCAL_ALBUM_ID,
    source_type: 'upload',
    source_id: null,
    storage_path: url,
    thumbnail_path: url,
    width: entry.width,
    height: entry.height,
    aspect_ratio: entry.aspect_ratio,
    taken_at: null,
    mime_type: null,
    bytes: null,
    is_favorite: false,
    metadata: { originalName: entry.filename },
    created_at: '',
    updated_at: '',
  };
}
