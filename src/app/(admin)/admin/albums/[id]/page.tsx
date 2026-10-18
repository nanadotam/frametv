'use client';

import Link from 'next/link';
import { UploadSimple, AppleLogo, ArrowsClockwise, GoogleDriveLogo } from '@phosphor-icons/react';
import { Button as MButton } from '@/components/m/Controls';
import { toast } from '@/components/m/Toast';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw, Star, Trash2, RotateCw, Info, X, Play, Copy } from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import type { Album, Photo } from '@/types/db';
import { UploadPanel } from '@/components/admin/UploadPanel';
import {
  useVideoUploads,
  type DuplicateChoice,
  type DuplicatePrompt,
} from '@/lib/video/useVideoUploads';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRotation(photo: Photo): number {
  const meta = photo.metadata as Record<string, unknown> | null;
  const r = meta?.rotation;
  return typeof r === 'number' ? r : 0;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Info Modal ───────────────────────────────────────────────────────────────

function InfoModal({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const rotation = getRotation(photo);
  const meta = photo.metadata as Record<string, unknown> | null;

  const rows: { label: string; value: string }[] = [
    { label: 'Dimensions',    value: photo.width && photo.height ? `${photo.width} × ${photo.height} px` : '—' },
    { label: 'Aspect ratio',  value: photo.aspect_ratio?.toString() ?? (photo.width && photo.height ? (photo.width / photo.height).toFixed(3) : '—') },
    { label: 'File size',     value: formatBytes(photo.bytes) },
    { label: 'MIME type',     value: photo.mime_type ?? '—' },
    { label: 'Source',        value: photo.source_type },
    ...(photo.media_type === 'video' ? [{ label: 'Duration', value: formatDuration(photo.duration_ms) || '—' }] : []),
    { label: 'Taken',         value: formatDate(photo.taken_at) },
    { label: 'Added',         value: formatDate(photo.created_at) },
    { label: 'Rotation',      value: rotation ? `${rotation}°` : 'None' },
    ...(meta ? Object.entries(meta)
      .filter(([k]) => k !== 'rotation')
      .map(([k, v]) => ({ label: k, value: String(v) })) : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-cell border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-label">{photo.media_type === 'video' ? 'Video Info' : 'Photo Info'}</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-label-2 hover:text-label hover:bg-fg/10 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Thumbnail strip */}
        <div className="h-36 bg-bg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/${photo.id}/thumbnail?size=200`}
            alt=""
            className="w-full h-full object-cover"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>

        {/* Metadata rows */}
        <div className="px-5 py-4 space-y-2.5 max-h-64 overflow-y-auto">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 text-xs">
              <span className="text-label-2 shrink-0">{label}</span>
              <span className="text-label font-medium text-right break-all">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Duplicate Dialog ─────────────────────────────────────────────────────────

function DuplicateDialog({
  prompt,
  onChoose,
}: {
  prompt: DuplicatePrompt;
  onChoose: (choice: DuplicateChoice, applyToAll: boolean) => void;
}) {
  const [applyToAll, setApplyToAll] = useState(false);
  const here = prompt.kind === 'here';
  const albums = [...new Set(prompt.matches.map((m) => m.albumName))];
  const choose = (c: DuplicateChoice) => onChoose(c, applyToAll);

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) choose('cancel'); }}
      title={here ? 'Video already in this album' : 'Video exists in another album'}
      description={prompt.file.name}
    >
      <p className="text-sm text-label-2 mb-5">
        {here
          ? 'This video has already been uploaded here. Replace the existing copy with a fresh upload, or skip it?'
          : <>This video is already in <span className="text-label font-medium">{albums.join(', ')}</span>. Copy it from there instantly, or upload and compress it again?</>}
      </p>

      <div className="flex flex-col gap-2">
        {here ? (
          <Button onClick={() => choose('replace')}>
            <RefreshCw size={15} /> Replace
          </Button>
        ) : (
          <>
            <Button onClick={() => choose('copy')}>
              <Copy size={15} /> Copy from {albums.length === 1 ? albums[0] : 'other album'}
            </Button>
            <Button variant="secondary" onClick={() => choose('upload')}>
              Upload anyway
            </Button>
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => choose('skip')}>Skip</Button>
          <Button variant="ghost" onClick={() => choose('cancel')}>
            {prompt.remaining > 0 ? 'Cancel all' : 'Cancel'}
          </Button>
        </div>
      </div>

      {prompt.remaining > 0 && (
        <label className="mt-4 flex items-center gap-2 text-xs text-label-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            className="accent-accent"
          />
          Do this for every remaining {here ? 'video already in this album' : 'video found in another album'}
        </label>
      )}
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AlbumPhotosPage() {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [infoPhoto, setInfoPhoto] = useState<Photo | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);
  const uploads = useVideoUploads({
    albumId: id,
    onAdded: (video) => setPhotos((prev) => [...prev, video]),
    // New upload takes the first old copy's place in the grid
    onReplaced: (video, oldIds) =>
      setPhotos((prev) => {
        const old = new Set(oldIds);
        const at = prev.findIndex((p) => old.has(p.id));
        const rest = prev.filter((p) => !old.has(p.id));
        if (at < 0) return [...rest, video];
        rest.splice(Math.min(at, rest.length), 0, video);
        return rest;
      }),
  });

  const videoCount = photos.filter((p) => p.media_type === 'video').length;

  const fetchData = useCallback(async () => {
    try {
      const [albumRes, photosRes] = await Promise.all([
        fetch(`/api/albums/${id}`),
        fetch(`/api/albums/${id}/photos`),
      ]);
      if (albumRes.ok) { const j = await albumRes.json(); setAlbum(j.album ?? j); }
      if (photosRes.ok) setPhotos(await photosRes.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('from') === 'apple') {
      toast('Click “From Apple Photos”, then choose Photos in the sidebar of the window that opens');
    }
  }, []);

  const toggleFavorite = async (photo: Photo) => {
    const next = !photo.is_favorite;
    setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, is_favorite: next } : p));
    await fetch(`/api/photos/${photo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: next }),
    });
  };

  const deletePhoto = async (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
  };

  const rotatePhoto = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation();
    setRotatingId(photo.id);
    const current = getRotation(photo);
    const next = (current + 90) % 360;
    // Optimistic update
    setPhotos((prev) => prev.map((p) => {
      if (p.id !== photo.id) return p;
      return { ...p, metadata: { ...(p.metadata as Record<string, unknown> ?? {}), rotation: next } };
    }));
    // Also update info modal if open
    setInfoPhoto((prev) => prev?.id === photo.id
      ? { ...prev, metadata: { ...(prev.metadata as Record<string, unknown> ?? {}), rotation: next } }
      : prev
    );
    await fetch(`/api/photos/${photo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotation: next }),
    });
    setRotatingId(null);
  };

  const handleVideoFiles = (files: FileList | null) => {
    if (!files?.length) return;
    uploads.enqueue(Array.from(files));
    if (videoInput.current) videoInput.current.value = '';
  };

  const syncDrive = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/albums/${id}/sync`, { method: 'POST' });
      await fetchData();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      className="relative px-4 pt-4 pb-28 md:p-6 max-w-5xl mx-auto min-h-full"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleVideoFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-tint/15 backdrop-blur-[2px]">
          <div className="rounded-[24px] bg-elevated px-10 py-8 text-center shadow-2xl">
            <UploadSimple size={44} className="mx-auto text-tint" />
            <p className="mt-3 text-[20px] font-bold text-label">Drop to add to {album?.name}</p>
            <p className="text-[15px] text-label-2">Photos are compressed on your device</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="mb-5 pt-2">
        <Link href="/admin/albums" className="mb-1 inline-block text-[17px] text-tint">‹ Library</Link>
        <h1 className="truncate text-[34px] font-bold leading-tight tracking-[-0.02em] text-label">
          {loading ? 'Loading…' : (album?.name ?? 'Album')}
        </h1>
        <p className="text-[15px] text-label-2">
          {photos.length - videoCount} photo{photos.length - videoCount === 1 ? '' : 's'}
          {videoCount > 0 && ` · ${videoCount} video${videoCount !== 1 ? 's' : ''}`}
          {album?.source_type === 'drive' && ' · from Google Drive'}
        </p>
        <input
          ref={videoInput}
          type="file"
          accept="image/*,video/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => handleVideoFiles(e.target.files)}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {album?.source_type === 'drive' && album.drive_folder_id && (
            <a href={`https://drive.google.com/drive/folders/${album.drive_folder_id}`} target="_blank" rel="noreferrer">
              <MButton size="md" icon={<GoogleDriveLogo size={18} weight="fill" />}>Add photos in Google Drive</MButton>
            </a>
          )}
          <MButton
            size="md"
            variant={album?.source_type === 'drive' ? 'gray' : 'filled'}
            icon={<UploadSimple size={18} weight="bold" />}
            onClick={() => videoInput.current?.click()}
          >
            {album?.source_type === 'drive' ? 'Upload from this computer' : 'Add photos & videos'}
          </MButton>
          <MButton
            size="md"
            variant="gray"
            icon={<AppleLogo size={18} weight="fill" />}
            onClick={() => {
              toast('Choose “Photos” in the sidebar, then pick photos or a whole album');
              setTimeout(() => videoInput.current?.click(), 600);
            }}
          >
            From Apple Photos
          </MButton>
          {album?.source_type === 'drive' && (
            <MButton size="md" variant="gray" icon={<ArrowsClockwise size={18} weight="bold" />} onClick={syncDrive} loading={syncing}>
              Sync from Drive
            </MButton>
          )}
        </div>
        <p className="mt-3 text-[13px] text-label-2">
          {album?.source_type === 'drive'
            ? 'New photos you put in the Drive folder appear here automatically. You can also drag photos onto this page to upload them.'
            : 'Tip: drag photos straight from Finder or the Photos app onto this page. They’re compressed on your device to save space without losing quality.'}
        </p>
      </div>

      {/* Photo grid */}
      {loading ? (
        <div className="text-label-2 text-sm text-center py-12">Loading photos…</div>
      ) : photos.length === 0 ? (
        <button
          type="button"
          onClick={() => videoInput.current?.click()}
          className="flex w-full flex-col items-center rounded-[20px] border-2 border-dashed border-separator px-6 py-14 text-center"
        >
          <UploadSimple size={36} className="text-tint" />
          <p className="mt-3 text-[17px] font-semibold text-label">{album?.source_type === 'drive' ? 'No photos synced yet' : 'Drop photos and videos here'}</p>
          <p className="mt-1 text-[15px] text-label-2">{album?.source_type === 'drive' ? 'Add photos to the Drive folder, then tap Sync from Drive' : 'or click to choose from your computer or Apple Photos'}</p>
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo) => {
            const isVideo = photo.media_type === 'video';
            const rotation = isVideo ? 0 : getRotation(photo);
            const isRotating = rotatingId === photo.id;
            return (
              <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-cell aspect-square">
                {/* Thumbnail */}
                {photo.thumbnail_path || photo.storage_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/photos/${photo.id}/thumbnail?size=200`}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-300"
                    style={{ transform: `rotate(${rotation}deg)` }}
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-label-3 text-sm">
                    No preview
                  </div>
                )}

                {/* Hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                {/* Top-right actions: info */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setInfoPhoto(photo); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/55 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
                    title="Photo info"
                  >
                    <Info size={14} />
                  </button>
                </div>

                {/* Bottom actions */}
                <div className="absolute bottom-2 left-2 right-2 flex justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Left: favorite + rotate */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleFavorite(photo)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center backdrop-blur-sm transition-colors ${
                        photo.is_favorite
                          ? 'bg-accent/80 text-bg'
                          : 'bg-black/55 text-white hover:bg-accent/80 hover:text-bg'
                      }`}
                      title={photo.is_favorite ? 'Unfavorite' : 'Favorite'}
                    >
                      <Star size={15} fill={photo.is_favorite ? 'currentColor' : 'none'} />
                    </button>
                    {!isVideo && <button
                      onClick={(e) => rotatePhoto(photo, e)}
                      disabled={isRotating}
                      className="w-9 h-9 rounded-lg flex items-center justify-center bg-black/55 text-white hover:bg-white/20 transition-colors backdrop-blur-sm disabled:opacity-50"
                      title="Rotate 90°"
                    >
                      <RotateCw
                        size={15}
                        className={isRotating ? 'animate-spin' : ''}
                      />
                    </button>}
                  </div>
                  {/* Right: delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center bg-black/55 text-white hover:bg-bad/80 transition-colors backdrop-blur-sm"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Video badge */}
                {isVideo && (
                  <div className="absolute bottom-2 right-2 group-hover:opacity-0 transition-opacity flex items-center gap-1 text-[10px] font-semibold text-white bg-black/55 rounded px-1.5 py-0.5 backdrop-blur-sm">
                    <Play size={10} fill="currentColor" /> {formatDuration(photo.duration_ms)}
                  </div>
                )}

                {/* Favorite badge */}
                {photo.is_favorite && (
                  <div className="absolute top-2 left-2 group-hover:opacity-0 transition-opacity">
                    <Star size={13} className="text-accent drop-shadow" fill="currentColor" />
                  </div>
                )}

                {/* Rotation badge (non-zero) */}
                {rotation !== 0 && (
                  <div className="absolute bottom-2 right-2 group-hover:opacity-0 transition-opacity">
                    <span className="text-[10px] font-semibold text-white/70 bg-black/40 rounded px-1 py-0.5 backdrop-blur-sm">
                      {rotation}°
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {uploads.duplicatePrompt && (
        <DuplicateDialog
          key={uploads.duplicatePrompt.file.name + uploads.duplicatePrompt.remaining}
          prompt={uploads.duplicatePrompt}
          onChoose={uploads.answerDuplicate}
        />
      )}

      <UploadPanel
        items={uploads.items}
        busy={uploads.busy}
        onRetry={uploads.retry}
        onCancel={uploads.cancelQueued}
        onClose={uploads.clearFinished}
      />

      {/* Info modal */}
      {infoPhoto && (
        <InfoModal
          photo={infoPhoto}
          onClose={() => setInfoPhoto(null)}
        />
      )}
    </div>
  );
}
