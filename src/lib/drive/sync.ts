import { createServiceClient } from '@/lib/supabase/server';
import { extractFolderId, getFolderName, listFolderFiles, getThumbnailUrl, getImageUrl } from './files';

/**
 * Import a single public Drive folder as an album.
 * Creates the album row, lists all image files, bulk-inserts photo rows.
 * Re-importing the same folder (same drive_folder_id) re-syncs photos.
 */
export async function syncFolderByUrl(
  folderUrl: string
): Promise<{ synced: number; albumId: string; errors: string[] }> {
  const folderId = extractFolderId(folderUrl);
  if (!folderId) throw new Error('Invalid Drive folder URL — could not extract folder ID.');

  const supabase = createServiceClient();
  const errors: string[] = [];

  // ── 1. Get / create album row ─────────────────────────────────────────────
  // Get folder name first (falls back to "Album (XXXXXXXX)" when API key missing)
  const name = await getFolderName(folderId);

  // Check whether this folder has already been imported
  const { data: existing } = await supabase
    .from('albums')
    .select('id')
    .eq('drive_folder_id', folderId)
    .maybeSingle();

  let albumId: string;

  if (existing) {
    albumId = existing.id;
    // Update name in case folder was renamed
    await supabase.from('albums').update({ name, updated_at: new Date().toISOString() }).eq('id', albumId);
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from('albums')
      .insert({ name, source_type: 'drive', drive_folder_id: folderId, display_order: 0 })
      .select('id')
      .single();

    if (!inserted) {
      throw new Error(
        `Could not create album in database: ${insertErr?.message ?? 'unknown error'}. ` +
        'Make sure the Supabase URL and key are correct and the albums table exists.'
      );
    }
    albumId = inserted.id;
  }

  // ── 2. List files from Drive ──────────────────────────────────────────────
  let files: Awaited<ReturnType<typeof listFolderFiles>> = [];
  try {
    files = await listFolderFiles(folderId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    // Album exists but photos couldn't be fetched (e.g. no API key yet)
    return { synced: 0, albumId, errors };
  }

  if (files.length === 0) {
    errors.push('Drive folder is empty or contains no images.');
    return { synced: 0, albumId, errors };
  }

  // ── 3. Find which files are already tracked ────────────────────────────────
  const { data: existingPhotos } = await supabase
    .from('photos')
    .select('source_id')
    .eq('album_id', albumId)
    .eq('source_type', 'drive');

  const existingIds = new Set((existingPhotos ?? []).map((p: { source_id: string }) => p.source_id));
  const newFiles = files.filter((f) => !existingIds.has(f.id));

  // ── 4. Bulk insert new photos ──────────────────────────────────────────────
  if (newFiles.length > 0) {
    const rows = newFiles.map((file, idx) => ({
      album_id: albumId,
      source_type: 'drive' as const,
      source_id: file.id,
      storage_path: getImageUrl(file.id),
      thumbnail_path: getThumbnailUrl(file.id, 800),
      width: file.imageMediaMetadata?.width ?? null,
      height: file.imageMediaMetadata?.height ?? null,
      aspect_ratio:
        file.imageMediaMetadata?.width && file.imageMediaMetadata?.height
          ? `${file.imageMediaMetadata.width}:${file.imageMediaMetadata.height}`
          : null,
      mime_type: file.mimeType,
      bytes: file.size ? parseInt(file.size) : null,
      taken_at: file.imageMediaMetadata?.time ?? null,
      metadata: { originalName: file.name, driveIndex: idx },
    }));

    // Insert in batches of 500 to stay within Supabase payload limits
    for (let i = 0; i < rows.length; i += 500) {
      const { error: batchErr } = await supabase.from('photos').insert(rows.slice(i, i + 500));
      if (batchErr) errors.push(`Batch ${i / 500 + 1}: ${batchErr.message}`);
    }

    // Set cover photo to first image if album has none
    const { data: albumRow } = await supabase
      .from('albums')
      .select('cover_photo_id')
      .eq('id', albumId)
      .single();

    if (!albumRow?.cover_photo_id) {
      const { data: firstPhoto } = await supabase
        .from('photos')
        .select('id')
        .eq('album_id', albumId)
        .order('metadata->driveIndex', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstPhoto) {
        await supabase.from('albums').update({ cover_photo_id: firstPhoto.id }).eq('id', albumId);
      }
    }
  }

  return { synced: newFiles.length, albumId, errors };
}

/**
 * Re-sync all drive albums (called by cron).
 */
export async function syncDrive(filterAlbumId?: string): Promise<{ synced: number; errors: string[] }> {
  const supabase = createServiceClient();
  let synced = 0;
  const errors: string[] = [];

  const query = supabase
    .from('albums')
    .select('id, drive_folder_id, name')
    .eq('source_type', 'drive')
    .eq('is_archived', false);

  const { data: albums } = filterAlbumId
    ? await query.eq('id', filterAlbumId)
    : await query;

  for (const album of albums ?? []) {
    if (!album.drive_folder_id) continue;
    try {
      const folderUrl = `https://drive.google.com/drive/folders/${album.drive_folder_id}`;
      const result = await syncFolderByUrl(folderUrl);
      synced += result.synced;
      errors.push(...result.errors);
    } catch (err: unknown) {
      errors.push(`Album ${album.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { synced, errors };
}
