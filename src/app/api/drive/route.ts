import { NextRequest, NextResponse } from 'next/server';
import { extractFolderId } from '@/lib/drive/files';
import { syncFolderByUrl } from '@/lib/drive/sync';
import { requireAdminUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const { folderUrl } = await request.json();

    if (!folderUrl) {
      return NextResponse.json({ error: 'folderUrl is required' }, { status: 400 });
    }

    const folderId = extractFolderId(folderUrl);
    if (!folderId) {
      return NextResponse.json(
        { error: 'Could not find a folder ID in that URL. Paste a full Google Drive folder link.' },
        { status: 400 }
      );
    }

    const { synced, albumId, errors } = await syncFolderByUrl(folderUrl, auth.user.id);

    return NextResponse.json({
      albumId,
      synced,
      errors,
      warning: errors.length > 0 ? errors[0] : undefined,
    }, { status: 201 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/drive] POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
