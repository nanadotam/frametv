import { NextRequest, NextResponse } from 'next/server';
import { extractFolderId } from '@/lib/drive/files';
import { syncFolderByUrl } from '@/lib/drive/sync';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folderUrl } = body;

    if (!folderUrl) {
      return NextResponse.json({ error: 'folderUrl is required' }, { status: 400 });
    }

    const folderId = extractFolderId(folderUrl);
    if (!folderId) {
      return NextResponse.json(
        { error: 'Could not extract folder ID. Paste a full Google Drive folder URL.' },
        { status: 400 }
      );
    }

    const { synced, albumId, errors } = await syncFolderByUrl(folderUrl);

    return NextResponse.json({
      albumId,
      synced,
      errors,
      // Surface any non-fatal errors (e.g. missing API key) to the UI
      warning: errors.length > 0 ? errors[0] : undefined,
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[drive/route] POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
