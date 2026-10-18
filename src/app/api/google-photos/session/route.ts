import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { pickerFetch, readToken } from '@/lib/googlePhotos/oauth';

type PickedItem = { id: string; type: string; mediaFile: { baseUrl: string; mimeType: string; filename: string } ; createTime?: string };

// GET ?id= — has the user finished picking? Once they have, returns the
// picked items (images only; Google Photos videos need a heavier path).
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;
  const token = readToken(request);
  const id = request.nextUrl.searchParams.get('id');
  if (!token || !id) return NextResponse.json({ error: 'Google Photos session expired. Start again.' }, { status: 401 });

  const session = (await pickerFetch(token, `/sessions/${encodeURIComponent(id)}`)) as { mediaItemsSet?: boolean };
  if (!session.mediaItemsSet) return NextResponse.json({ ready: false });

  const items: PickedItem[] = [];
  let pageToken = '';
  do {
    const page = (await pickerFetch(
      token,
      `/mediaItems?sessionId=${encodeURIComponent(id)}&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`
    )) as { mediaItems?: PickedItem[]; nextPageToken?: string };
    items.push(...(page.mediaItems ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken && items.length < 2000);

  return NextResponse.json({
    ready: true,
    items: items
      .filter((i) => i.type === 'PHOTO' || i.mediaFile?.mimeType?.startsWith('image/'))
      .map((i) => ({ id: i.id, url: i.mediaFile.baseUrl, name: i.mediaFile.filename, mimeType: i.mediaFile.mimeType, takenAt: i.createTime })),
    skippedVideos: items.filter((i) => i.type === 'VIDEO').length,
  });
}
