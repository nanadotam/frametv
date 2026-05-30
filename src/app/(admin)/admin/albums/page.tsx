'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { HardDrive, ImageIcon, Trash2, Star, RefreshCw, Plus, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Album } from '@/types/db';
import PageGuide from '@/components/admin/PageGuide';

export default function AlbumsPage() {
  const [albums, setAlbums]               = useState<Album[]>([]);
  const [loading, setLoading]             = useState(true);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveUrl, setDriveUrl]           = useState('');
  const [driveLoading, setDriveLoading]   = useState(false);
  const [driveError, setDriveError]       = useState('');
  const [activeAlbumIds, setActiveAlbumIds] = useState<string[]>([]);
  const [syncing, setSyncing]             = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAlbums = useCallback(async () => {
    try {
      const [albumsRes, dsRes] = await Promise.all([fetch('/api/albums'), fetch('/api/display-state')]);
      if (albumsRes.ok) {
        const json = await albumsRes.json();
        setAlbums(Array.isArray(json) ? json : (json.albums ?? []));
      }
      if (dsRes.ok) {
        const json = await dsRes.json();
        const ds = json.state ?? json;
        setActiveAlbumIds(ds.active_album_ids ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlbums(); }, [fetchAlbums]);

  const handleAddDrive = async () => {
    if (!driveUrl.trim()) return;
    setDriveLoading(true);
    setDriveError('');
    try {
      const res = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderUrl: driveUrl }),
      });
      if (!res.ok) {
        const err = await res.json();
        setDriveError(err.error ?? 'Failed to import folder');
        return;
      }
      const json = await res.json();
      await fetchAlbums();
      if (json.warning) {
        setDriveError(`Album created but no photos synced: ${json.warning}`);
      } else {
        setDriveUrl('');
        setDriveModalOpen(false);
      }
    } catch {
      setDriveError('Network error');
    } finally {
      setDriveLoading(false);
    }
  };

  const syncAlbum = async (albumId: string) => {
    setSyncing(albumId);
    await fetch(`/api/albums/${albumId}/sync`, { method: 'POST' });
    setSyncing(null);
    await fetchAlbums();
  };

  const handleDeleteClick = (id: string) => {
    if (confirmDelete === id) {
      fetch(`/api/albums/${id}`, { method: 'DELETE' });
      setAlbums((prev) => prev.filter((a) => a.id !== id));
      setConfirmDelete(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    } else {
      setConfirmDelete(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const toggleActive = async (id: string) => {
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

  const visible = albums.filter((a) => !a.is_archived);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">

      <PageGuide
        pageKey="albums"
        icon={<HardDrive size={18} className="text-primary" />}
        title="Albums"
        about="Albums are collections of photos from your Google Drive folders. Add a folder and toggle it active — the photos inside will start playing on your TV display automatically."
        steps={[
          'Open Google Drive and find a folder with your photos.',
          'Right-click the folder → Share → change to "Anyone with the link" can view.',
          'Copy the share link.',
          'Click "Add Drive folder" and paste the link — your photos will sync.',
          'Toggle an album active to start showing it on TV.',
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Albums</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {visible.length} album{visible.length !== 1 ? 's' : ''} · {activeAlbumIds.length} active on TV
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDriveModalOpen(true)} className="gap-1.5">
          <HardDrive size={14} /> Add Drive folder
        </Button>
      </div>

      {/* Active albums callout */}
      {activeAlbumIds.length > 0 && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl p-3 text-sm">
          <Star size={15} className="text-primary shrink-0" fill="currentColor" />
          <span className="font-medium text-primary">
            {activeAlbumIds.length} album{activeAlbumIds.length !== 1 ? 's' : ''} currently showing on TV
          </span>
        </div>
      )}

      {/* Album grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card animate-pulse h-52" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No albums yet</p>
          <p className="text-sm mt-1">Add a Google Drive folder to get started</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={() => setDriveModalOpen(true)}
          >
            <HardDrive size={14} /> Add Drive folder
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.sort((a, b) => a.display_order - b.display_order).map((album) => {
            const isActive   = activeAlbumIds.includes(album.id);
            const isSyncing  = syncing === album.id;
            const isArming   = confirmDelete === album.id;
            return (
              <Card
                key={album.id}
                className={cn('overflow-hidden transition-all', isActive && 'ring-2 ring-primary border-primary')}
              >
                <div className="aspect-video bg-muted relative flex items-center justify-center">
                  {album.cover_photo_id ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/photos/${album.cover_photo_id}/thumbnail`}
                      alt={album.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={28} className="text-muted-foreground/40" />
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {isActive && (
                      <Badge className="bg-primary text-primary-foreground text-xs gap-1 shadow">
                        <Star size={9} fill="currentColor" /> Active
                      </Badge>
                    )}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="text-xs capitalize">{album.source_type}</Badge>
                  </div>
                </div>

                <CardContent className="p-3 space-y-3">
                  <h3 className="font-semibold text-sm truncate">{album.name}</h3>
                  <div className="flex gap-1.5 flex-wrap">
                    <Button
                      size="sm"
                      variant={isActive ? 'default' : 'outline'}
                      className={cn('flex-1 h-10 text-xs gap-1', isActive && 'bg-primary')}
                      onClick={() => toggleActive(album.id)}
                    >
                      <Star size={11} fill={isActive ? 'currentColor' : 'none'} />
                      {isActive ? 'Active' : 'Set active'}
                    </Button>
                    <Link href={`/admin/albums/${album.id}`}>
                      <Button size="sm" variant="outline" className="h-10 text-xs">View</Button>
                    </Link>
                    {album.source_type === 'drive' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 w-10 p-0"
                        onClick={() => syncAlbum(album.id)}
                        disabled={isSyncing}
                        title="Sync from Drive"
                      >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        'h-10 p-0 transition-all',
                        isArming
                          ? 'w-16 text-[10px] font-bold text-destructive bg-destructive/10 hover:bg-destructive/20 px-2'
                          : 'w-10 hover:text-destructive'
                      )}
                      onClick={() => handleDeleteClick(album.id)}
                      title={isArming ? 'Tap again to confirm' : 'Delete album'}
                    >
                      {isArming ? 'Sure?' : <Trash2 size={14} />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add from Drive modal */}
      <Dialog open={driveModalOpen} onOpenChange={setDriveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add album from Google Drive</DialogTitle>
            <DialogDescription>
              Paste a public Drive folder URL. The folder must be shared as &quot;Anyone with the link can view.&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="drive-url">Folder URL</Label>
              <Input
                id="drive-url"
                placeholder="https://drive.google.com/drive/folders/..."
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How to get the link:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Right-click the folder in Google Drive</li>
                <li>Click <strong>Share</strong> → <strong>Anyone with the link</strong></li>
                <li>Set permission to <strong>Viewer</strong></li>
                <li>Click <strong>Copy link</strong> and paste it above</li>
              </ol>
            </div>
            {driveError && <p className="text-sm text-destructive">{driveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDriveModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDrive} disabled={driveLoading || !driveUrl.trim()} className="gap-1.5">
              <Plus size={14} />
              {driveLoading ? 'Importing…' : 'Import folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
