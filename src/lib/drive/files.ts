// Public Google Drive API — uses API key only.
// Folders must be shared as "Anyone with the link can view".
// API key priority: GOOGLE_API_KEY env var → google_api_key in settings table.

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export function extractFolderId(driveUrl: string): string | null {
  const match = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function getThumbnailUrl(fileId: string, size = 800): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

export function getImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

/** Resolve the API key: env var first, then settings table. */
export async function resolveApiKey(): Promise<string> {
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
  // Try to fetch from settings table
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'google_api_key')
      .maybeSingle();
    if (data?.value) return data.value as string;
  } catch {
    // ignore — will throw below
  }
  throw new Error(
    'Google API key not configured. Add GOOGLE_API_KEY to .env.local or enter it in Settings → Integrations.'
  );
}

export async function listFolderFiles(
  folderId: string,
  apiKey?: string
): Promise<{ id: string; name: string; mimeType: string; imageMediaMetadata?: { width?: number; height?: number; time?: string } | null; size?: string | null }[]> {
  const key = apiKey ?? (await resolveApiKey());
  const results: { id: string; name: string; mimeType: string; imageMediaMetadata?: { width?: number; height?: number; time?: string } | null; size?: string | null }[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      key,
      q: `'${folderId}' in parents and (mimeType contains 'image/') and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size,imageMediaMetadata)',
      pageSize: '1000',
      orderBy: 'name',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Drive API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    results.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && results.length < 1000);

  return results;
}

export async function listSubFolders(
  parentId: string,
  apiKey?: string
): Promise<{ id: string; name: string }[]> {
  const key = apiKey ?? (await resolveApiKey());
  const params = new URLSearchParams({
    key,
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and not name starts with '_'`,
    fields: 'files(id,name)',
    pageSize: '100',
    orderBy: 'name',
  });

  const res = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`);
  if (!res.ok) throw new Error(`Drive API error ${res.status}`);
  const data = await res.json();
  return data.files ?? [];
}

export async function getFolderByName(name: string, parentId?: string, apiKey?: string): Promise<{ id: string; name: string } | null> {
  const key = apiKey ?? (await resolveApiKey());
  const q = parentId
    ? `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const params = new URLSearchParams({
    key,
    q,
    fields: 'files(id,name)',
    pageSize: '1',
  });

  const res = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`);
  if (!res.ok) throw new Error(`Drive API error ${res.status}`);
  const data = await res.json();
  return data.files?.[0] ?? null;
}

export async function getFolderName(folderId: string, apiKey?: string): Promise<string> {
  let key: string;
  try {
    key = apiKey ?? (await resolveApiKey());
  } catch {
    return `Album (${folderId.slice(0, 8)})`;
  }
  const params = new URLSearchParams({ key, fields: 'name' });
  const res = await fetch(`${DRIVE_API_BASE}/files/${folderId}?${params.toString()}`);
  if (!res.ok) return `Album (${folderId.slice(0, 8)})`;
  const data = await res.json();
  return data.name ?? `Album (${folderId.slice(0, 8)})`;
}
