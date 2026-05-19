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

    return NextResponse.json({ albumId, synced, errors }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
