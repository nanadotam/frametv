'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Star, Trash2, RotateCw, Info, X } from 'lucide-react';
import { Button } from '@/components/admin/Button';
import type { Album, Photo } from '@/types/db';

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
        className="bg-bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-fg">Photo Info</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/10 transition-colors"
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
              <span className="text-fg-muted shrink-0">{label}</span>
              <span className="text-fg font-medium text-right break-all">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AlbumPhotosPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [infoPhoto, setInfoPhoto] = useState<Photo | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);

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
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pt-2">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-xl bg-fg/10 flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/15 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold font-display text-fg truncate">
            {loading ? 'Loading…' : (album?.name ?? 'Album')}
          </h1>
          <p className="text-xs text-fg-muted">{photos.length} photos</p>
        </div>
        {album?.source_type === 'drive' && (
          <Button size="sm" variant="secondary" onClick={syncDrive} loading={syncing}>
            <RefreshCw size={15} /> Sync from Drive
          </Button>
        )}
      </div>

      {/* Photo grid */}
      {loading ? (
        <div className="text-fg-muted text-sm text-center py-12">Loading photos…</div>
      ) : photos.length === 0 ? (
        <div className="text-fg-muted text-sm text-center py-12">No photos in this album.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo) => {
            const rotation = getRotation(photo);
            const isRotating = rotatingId === photo.id;
            return (
              <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-bg-card aspect-square">
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
                  <div className="w-full h-full flex items-center justify-center text-fg-dim text-sm">
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
                    <button
                      onClick={(e) => rotatePhoto(photo, e)}
                      disabled={isRotating}
                      className="w-9 h-9 rounded-lg flex items-center justify-center bg-black/55 text-white hover:bg-white/20 transition-colors backdrop-blur-sm disabled:opacity-50"
                      title="Rotate 90°"
                    >
                      <RotateCw
                        size={15}
                        className={isRotating ? 'animate-spin' : ''}
                      />
                    </button>
                  </div>
                  {/* Right: delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center bg-black/55 text-white hover:bg-red-500/80 transition-colors backdrop-blur-sm"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

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
