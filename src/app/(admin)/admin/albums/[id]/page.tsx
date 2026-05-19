'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/admin/Button';
import type { Album, Photo } from '@/types/db';

export default function AlbumPhotosPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [albumRes, photosRes] = await Promise.all([
        fetch(`/api/albums/${id}`),
        fetch(`/api/albums/${id}/photos`),
      ]);
      if (albumRes.ok) setAlbum(await albumRes.json());
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-bg-card aspect-square">
              {/* Thumbnail */}
              {photo.thumbnail_path || photo.storage_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/photos/${photo.id}/thumbnail`}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-fg-dim text-sm">
                  No preview
                </div>
              )}
              {/* Overlay actions */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-2 left-2 right-2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => toggleFavorite(photo)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center backdrop-blur-sm transition-colors ${
                    photo.is_favorite
                      ? 'bg-accent/80 text-bg'
                      : 'bg-black/50 text-white hover:bg-accent/80 hover:text-bg'
                  }`}
                  title={photo.is_favorite ? 'Unfavorite' : 'Favorite'}
                >
                  <Star size={16} fill={photo.is_favorite ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => deletePhoto(photo.id)}
                  className="w-10 h-10 rounded-lg flex items-center justify-center bg-black/50 text-white hover:bg-danger/80 transition-colors backdrop-blur-sm"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {/* Favorite badge always visible */}
              {photo.is_favorite && (
                <div className="absolute top-2 right-2">
                  <Star size={14} className="text-accent" fill="currentColor" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
