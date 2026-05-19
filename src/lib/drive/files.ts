// Public Google Drive API — uses API key only.
// Folders must be shared as "Anyone with the link can view".

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const API_KEY = process.env.GOOGLE_API_KEY!;

export function extractFolderId(driveUrl: string): string | null {
  const match = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function listFolderFiles(
  folderId: string
): Promise<{ id: string; name: string; mimeType: string; imageMediaMetadata?: { width?: number; height?: number; time?: string } | null; size?: string | null }[]> {
  const results: { id: string; name: string; mimeType: string; imageMediaMetadata?: { width?: number; height?: number; time?: string } | null; size?: string | null }[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      key: API_KEY,
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
  parentId: string
): Promise<{ id: string; name: string }[]> {
  const params = new URLSearchParams({
    key: API_KEY,
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

export async function getFolderByName(name: string, parentId?: string): Promise<{ id: string; name: string } | null> {
  const q = parentId
    ? `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const params = new URLSearchParams({
    key: API_KEY,
    q,
    fields: 'files(id,name)',
    pageSize: '1',
  });

  const res = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`);
  if (!res.ok) throw new Error(`Drive API error ${res.status}`);
  const data = await res.json();
  return data.files?.[0] ?? null;
}

// Thumbnail URL — works for publicly shared files
export function getThumbnailUrl(fileId: string, size = 800): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

// Direct image URL — works for publicly shared files
export function getImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

export async function getFolderName(folderId: string): Promise<string> {
  const params = new URLSearchParams({
    key: API_KEY,
    fields: 'name',
  });
  const res = await fetch(`${DRIVE_API_BASE}/files/${folderId}?${params.toString()}`);
  if (!res.ok) return `Album (${folderId.slice(0, 8)})`;
  const data = await res.json();
  return data.name ?? `Album (${folderId.slice(0, 8)})`;
}
