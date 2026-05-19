// Drive sync — API key approach (public shared folders, no OAuth)
// Walks Drive/FrameTV/<Album>/ and caches photo metadata in Supabase.
// Photos are NOT downloaded to Supabase Storage — we serve them directly
// from Google Drive CDN via getThumbnailUrl/getImageUrl (much simpler).

import { createServiceClient } from '@/lib/supabase/server';
import { listFolderFiles, listSubFolders, getThumbnailUrl, getImageUrl } from './files';

const FRAMETV_ROOT_FOLDER_ID = process.env.FRAMETV_ROOT_FOLDER_ID!;

export async function syncDrive(filterAlbumId?: string): Promise<{ synced: number; errors: string[] }> {
  const supabase = createServiceClient();
  let synced = 0;
  const errors: string[] = [];

  // 1. Get album subfolders from the FrameTV root
  let albumFolders: { id: string; name: string }[] = [];
  try {
    albumFolders = await listSubFolders(FRAMETV_ROOT_FOLDER_ID);
  } catch (err: unknown) {
    throw new Error(`Could not list FrameTV root folder: ${err instanceof Error ? err.message : String(err)}`);
  }

  for (const folder of albumFolders) {
    try {
      // 2. Upsert album row
      const { data: album } = await supabase
        .from('albums')
        .upsert(
          { name: folder.name, source_type: 'drive', drive_folder_id: folder.id },
          { onConflict: 'drive_folder_id' }
        )
        .select()
        .single();

      if (!album) continue;
      if (filterAlbumId && album.id !== filterAlbumId) continue;

      // 3. List photos in this folder
      const files = await listFolderFiles(folder.id);

      for (const file of files) {
        try {
          // Skip if already tracked
          const { data: existing } = await supabase
            .from('photos')
            .select('id')
            .eq('source_type', 'drive')
            .eq('source_id', file.id)
            .maybeSingle();

          if (existing) continue;

          const width = file.imageMediaMetadata?.width ?? null;
          const height = file.imageMediaMetadata?.height ?? null;
          const aspect = width && height ? `${width}:${height}` : null;
          const isCover = file.name.toLowerCase().startsWith('cover.');

          await supabase.from('photos').insert({
            album_id: album.id,
            source_type: 'drive',
            source_id: file.id,
            // Use Drive CDN directly — no Supabase Storage needed
            storage_path: getImageUrl(file.id),
            thumbnail_path: getThumbnailUrl(file.id, 800),
            width,
            height,
            aspect_ratio: aspect,
            mime_type: file.mimeType,
            bytes: file.size ? parseInt(file.size) : null,
            taken_at: file.imageMediaMetadata?.time ?? null,
            metadata: { originalName: file.name },
          });

          // If this is the cover photo, update album
          if (isCover) {
            const { data: inserted } = await supabase
              .from('photos')
              .select('id')
              .eq('source_id', file.id)
              .single();
            if (inserted) {
              await supabase.from('albums').update({ cover_photo_id: inserted.id }).eq('id', album.id);
            }
          }

          synced++;
        } catch (fileErr: unknown) {
          errors.push(`File ${file.id} (${file.name}): ${fileErr instanceof Error ? fileErr.message : String(fileErr)}`);
        }
      }
    } catch (folderErr: unknown) {
      errors.push(`Folder ${folder.id} (${folder.name}): ${folderErr instanceof Error ? folderErr.message : String(folderErr)}`);
    }
  }

  return { synced, errors };
}

// Sync a single folder given its Drive folder URL (for manual "Add from Drive")
export async function syncFolderByUrl(folderUrl: string): Promise<{ synced: number; albumId: string; errors: string[] }> {
  const { extractFolderId, getFolderName } = await import('./files');
  const folderId = extractFolderId(folderUrl);
  if (!folderId) throw new Error('Invalid Drive folder URL');

  const supabase = createServiceClient();

  // Get folder name — falls back to "Album (XXXXXXXX)" if no API key yet
  const name = await getFolderName(folderId);

  // Upsert the album row. This works with anon key once migration 002 is applied.
  const { data: album, error: albumError } = await supabase
    .from('albums')
    .upsert(
      { name, source_type: 'drive', drive_folder_id: folderId },
      { onConflict: 'drive_folder_id' }
    )
    .select()
    .single();

  if (!album) {
    const msg = albumError?.message ?? 'unknown database error';
    throw new Error(
      `Failed to create album: ${msg}. ` +
      'Make sure migration 002_anon_write.sql has been run in your Supabase SQL editor.'
    );
  }

  // Sync photos — may fail if API key not set yet; that's OK, album still exists.
  const errors: string[] = [];
  let synced = 0;
  try {
    ({ synced } = await syncDrive(album.id));
  } catch (err: unknown) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return { synced, albumId: album.id, errors };
}
