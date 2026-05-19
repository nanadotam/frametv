'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, CloudUpload, ImageIcon, HardDrive, Archive, Star } from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { Card } from '@/components/admin/Card';
import { Modal } from '@/components/admin/Modal';
import { Badge } from '@/components/admin/Badge';
import type { Album } from '@/types/db';

const sourceBadgeVariant = (s: Album['source_type']) => {
  if (s === 'drive') return 'accent' as const;
  if (s === 'picker') return 'success' as const;
  return 'muted' as const;
};

const sourceLabel = (s: Album['source_type']) => {
  if (s === 'drive') return 'Drive';
  if (s === 'picker') return 'Photos';
  return 'Upload';
};

export default function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveUrl, setDriveUrl] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [activeAlbumIds, setActiveAlbumIds] = useState<string[]>([]);

  const fetchAlbums = useCallback(async () => {
    try {
      const res = await fetch('/api/albums');
      if (res.ok) {
        const json = await res.json();
        setAlbums(Array.isArray(json) ? json : (json.albums ?? []));
      }
      const dsRes = await fetch('/api/display-state');
      if (dsRes.ok) {
        const json = await dsRes.json();
        const ds = json.state ?? json;
        setActiveAlbumIds(ds.active_album_ids ?? []);
      }
    } catch {
      // dev stub
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlbums(); }, [fetchAlbums]);

  const handleAddDrive = async () => {
    if (!driveUrl.trim()) return;
    setDriveLoading(true);
    try {
      await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: 'drive', drive_url: driveUrl }),
      });
      setDriveUrl('');
      setDriveModalOpen(false);
      await fetchAlbums();
    } finally {
      setDriveLoading(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadLoading(true);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('photos', f));
    try {
      await fetch('/api/albums/upload', { method: 'POST', body: fd });
      await fetchAlbums();
    } finally {
      setUploadLoading(false);
    }
  };

  const archiveAlbum = async (id: string) => {
    await fetch(`/api/albums/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: true }),
    });
    setAlbums((prev) => prev.filter((a) => a.id !== id));
  };

  const setActive = async (id: string) => {
    const next = activeAlbumIds.includes(id)
      ? activeAlbumIds.filter((x) => x !== id)
      : [...activeAlbumIds, id];
    await fetch('/api/display-state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_album_ids: next }),
    });
    setActiveAlbumIds(next);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pt-2">
        <h1 className="text-2xl font-semibold font-display text-fg">Albums</h1>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDriveModalOpen(true)}
          >
            <HardDrive size={16} /> Add from Drive
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            loading={uploadLoading}
          >
            <CloudUpload size={16} /> Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleUpload(e.dataTransfer.files);
        }}
        className="border-2 border-dashed border-fg/15 rounded-xl p-6 text-center text-fg-muted text-sm mb-5 hover:border-fg/30 transition-colors cursor-default"
      >
        Drag &amp; drop photos here to upload
      </div>

      {/* Album grid */}
      {loading ? (
        <div className="text-fg-muted text-sm text-center py-12">Loading albums…</div>
      ) : albums.filter((a) => !a.is_archived).length === 0 ? (
        <div className="text-fg-muted text-sm text-center py-12">No albums yet. Add from Drive, Google Photos, or upload.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums
            .filter((a) => !a.is_archived)
            .sort((a, b) => a.display_order - b.display_order)
            .map((album) => {
              const isActive = activeAlbumIds.includes(album.id);
              return (
                <Card key={album.id} padding={false} className="overflow-hidden">
                  {/* Cover */}
                  <div className="aspect-video bg-bg-soft flex items-center justify-center relative">
                    {album.cover_photo_id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/photos/${album.cover_photo_id}/thumbnail`}
                        alt={album.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon size={32} className="text-fg-dim" />
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge variant={sourceBadgeVariant(album.source_type)}>
                        {sourceLabel(album.source_type)}
                      </Badge>
                    </div>
                    {isActive && (
                      <div className="absolute top-2 left-2">
                        <Badge variant="accent">Active</Badge>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3 space-y-3">
                    <div>
                      <h3 className="font-medium text-fg text-sm truncate">{album.name}</h3>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <Link
                        href={`/admin/albums/${album.id}`}
                        className="flex-1 text-center text-xs py-2 rounded-lg bg-fg/10 text-fg hover:bg-fg/15 transition-colors min-h-[40px] flex items-center justify-center"
                      >
                        View photos
                      </Link>
                      <button
                        onClick={() => setActive(album.id)}
                        className={`flex-1 text-xs py-2 rounded-lg transition-colors min-h-[40px] flex items-center justify-center gap-1 ${
                          isActive
                            ? 'bg-accent/20 text-accent'
                            : 'bg-fg/10 text-fg hover:bg-fg/15'
                        }`}
                      >
                        <Star size={12} fill={isActive ? 'currentColor' : 'none'} />
                        {isActive ? 'Active' : 'Set active'}
                      </button>
                      <button
                        onClick={() => archiveAlbum(album.id)}
                        className="p-2 rounded-lg bg-fg/5 text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                        title="Archive"
                      >
                        <Archive size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* Add from Drive modal */}
      <Modal
        open={driveModalOpen}
        onOpenChange={setDriveModalOpen}
        title="Add album from Google Drive"
        description="Paste a Google Drive folder URL to import photos."
      >
        <div className="space-y-4">
          <input
            type="url"
            placeholder="https://drive.google.com/drive/folders/..."
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-bg-soft border border-fg/15 text-fg text-sm placeholder:text-fg-dim focus:outline-none focus:border-accent"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" size="md" onClick={() => setDriveModalOpen(false)}>
              Cancel
            </Button>
            <Button size="md" onClick={handleAddDrive} loading={driveLoading}>
              <Plus size={16} /> Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
