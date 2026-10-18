'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GoogleDriveLogo, FilmStrip, Plus, ArrowsClockwise, Trash, CheckCircle, Images, ShieldCheck, CaretRight, UploadSimple, AppleLogo,
} from '@phosphor-icons/react';
import { Page } from '@/components/m/Page';
import { Section, Row, IconTile } from '@/components/m/List';
import { Button, Empty, TextInput } from '@/components/m/Controls';
import { Sheet } from '@/components/m/Sheet';
import { toast } from '@/components/m/Toast';
import { CoverImage } from '@/components/m/CoverImage';
import { cn } from '@/lib/utils';
import type { Album } from '@/types/db';

function mb(bytes: number) {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

export default function LibraryPage() {
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [usage, setUsage] = useState<{ used: number; quota: number; count: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sheet, setSheet] = useState<null | 'add' | 'drive' | 'video'>(null);
  const [manage, setManage] = useState<Album | null>(null);
  const [driveUrl, setDriveUrl] = useState('');
  const [name, setName] = useState('');
  const [uploadFrom, setUploadFrom] = useState<'upload' | 'apple-photos'>('upload');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [al, ds, us] = await Promise.all([
      fetch('/api/albums').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/display-state').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/videos/usage').then((r) => (r.ok ? r.json() : null)),
    ]);
    setAlbums(Array.isArray(al) ? al : (al.albums ?? []));
    setActiveIds((ds?.state ?? ds)?.active_album_ids ?? []);
    setUsage(us);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    if (q.get('add') === '1') setSheet('add');
    const g = q.get('gphotos');
    if (g === 'unavailable') toast.error('Google Photos isn’t switched on yet. Use a Drive folder or upload for now.');
    if (g === 'denied') toast.error('Google Photos access wasn’t allowed.');
    if (g === 'error') toast.error('Google Photos didn’t connect. Try again.');
    if (g || q.get('add')) window.history.replaceState({}, '', '/admin/albums');
  }, [load]);

  const addDrive = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderUrl: driveUrl }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Couldn’t add that folder.');
      if (j.warning) toast.error(`Album added, but no photos came through: ${j.warning}`);
      else toast(`Added ${j.synced ?? ''} photos`.replace('  ', ' '));
      setDriveUrl('');
      setSheet(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t add that folder.');
    } finally {
      setBusy(false);
    }
  };

  const createVideoAlbum = async () => {
    setBusy(true);
    const res = await fetch('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), source_type: 'upload', display_order: albums.length }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(j.error ?? 'Couldn’t create the album.');
    router.push(`/admin/albums/${j.album.id}${uploadFrom === 'apple-photos' ? '?from=apple' : ''}`);
  };

  const toggleOnDisplay = async (id: string) => {
    const next = activeIds.includes(id) ? activeIds.filter((x) => x !== id) : [...activeIds, id];
    setActiveIds(next);
    const res = await fetch('/api/display-state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_album_ids: next }),
    }).catch(() => null);
    if (!res?.ok) {
      setActiveIds(activeIds);
      toast.error('Couldn’t update your screens.');
    }
  };

  const sync = async (a: Album) => {
    setBusy(true);
    const res = await fetch(`/api/albums/${a.id}/sync`, { method: 'POST' }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast.error('Sync failed. Is the folder still shared?');
    toast('Album synced');
    load();
  };

  const remove = async (a: Album) => {
    const res = await fetch(`/api/albums/${a.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) return toast.error('Couldn’t delete the album.');
    setAlbums((p) => p.filter((x) => x.id !== a.id));
    setManage(null);
    toast('Album deleted');
  };

  const visible = albums.filter((a) => !a.is_archived);
  const pct = usage ? Math.min(100, (usage.used / usage.quota) * 100) : 0;

  return (
    <Page
      title="Library"
      subtitle={loaded ? `${visible.length} album${visible.length === 1 ? '' : 's'} · ${activeIds.length || 'all'} on display` : ' '}
      wide
      actions={
        <Button size="sm" icon={<Plus size={14} weight="bold" />} onClick={() => setSheet('add')}>
          Add photos
        </Button>
      }
    >
      {loaded && visible.length === 0 ? (
        <Empty
          art={
            <div className="relative h-24 w-28">
              <div className="absolute left-0 top-3 h-20 w-16 -rotate-6 rounded-[10px] bg-ember shadow-lg" />
              <div className="absolute right-0 top-0 h-20 w-16 rotate-6 rounded-[10px] bg-[#5856d6] shadow-lg" />
              <div className="absolute left-1/2 top-2 flex h-20 w-16 -translate-x-1/2 items-center justify-center rounded-[10px] bg-cell shadow-xl">
                <Images size={30} className="text-tint" weight="duotone" />
              </div>
            </div>
          }
          title="Add your first album"
          body="Upload from this computer or Apple Photos, or point Mantel at a Google Drive folder."
          action={<Button block size="xl" onClick={() => setSheet('add')}>Add an album</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((a) => {
            const on = activeIds.includes(a.id);
            return (
              <div key={a.id} className="overflow-hidden rounded-[18px] bg-cell shadow-cell">
                <Link href={`/admin/albums/${a.id}`} className="pressable relative block aspect-square bg-fill">
                  {a.cover_photo_id ? (
                    <CoverImage src={`/api/photos/${a.cover_photo_id}/thumbnail`} rotation={a.cover_rotation} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-label-3">
                      {a.source_type === 'upload' ? <FilmStrip size={36} /> : <Images size={36} />}
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-black/45 p-1.5 text-white backdrop-blur">
                    {a.source_type === 'upload' ? <FilmStrip size={14} weight="fill" /> : <GoogleDriveLogo size={14} weight="fill" />}
                  </span>
                </Link>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button type="button" onClick={() => setManage(a)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[15px] font-semibold">{a.name}</p>
                    <p className="text-[12px] text-label-2">{a.source_type === 'upload' ? 'Uploads' : 'Google Drive'}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleOnDisplay(a.id)}
                    aria-pressed={on}
                    aria-label={on ? 'Remove from display' : 'Show on display'}
                    className={cn('pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full', on ? 'bg-tint text-white' : 'bg-fill text-label-3')}
                  >
                    <CheckCircle size={20} weight={on ? 'fill' : 'regular'} />
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setSheet('add')}
            className="pressable flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-separator text-tint"
          >
            <Plus size={32} weight="bold" />
            <span className="text-[15px] font-semibold">Add photos</span>
            <span className="px-4 text-center text-[12px] text-label-2">Computer, Apple Photos, Drive or Google Photos</span>
          </button>
        </div>
      )}

      {usage && (
        <Section header="Mantel storage" footer="Uploads are compressed on your device: high quality, a fraction of the size. Google Drive albums don’t count.">
          <div className="px-4 py-3.5">
            <div className="flex justify-between text-[15px]">
              <span>{mb(usage.used)} of {mb(usage.quota)}</span>
              <span className="text-label-2">{(usage as { photos?: number }).photos ?? 0} photos · {(usage as { videos?: number }).videos ?? usage.count} videos</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-fill-2">
              <div className={cn('h-full rounded-full', pct > 90 ? 'bg-bad' : 'bg-ember')} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </Section>
      )}

      {/* ── Add ── */}
      <Sheet open={sheet === 'add'} onOpenChange={(o) => !o && setSheet(null)} title="Add photos" description="Pick where your photos are. You can mix and match.">
        {[
          { key: 'upload', tone: 'ember' as const, icon: <UploadSimple size={28} weight="bold" />, title: 'From this computer', body: 'Photos and videos, compressed on your device. Uses your Mantel storage.', badge: null, onClick: () => { setUploadFrom('upload'); setSheet('video'); } },
          { key: 'apple', tone: 'gray' as const, icon: <AppleLogo size={28} weight="fill" />, title: 'From Apple Photos', body: 'Pick photos or whole albums from the Photos app on this Mac.', badge: null, onClick: () => { setUploadFrom('apple-photos'); setName('From Photos'); setSheet('video'); } },
          { key: 'drive', tone: 'blue' as const, icon: <GoogleDriveLogo size={28} weight="fill" />, title: 'Google Drive folder', body: 'Best for big libraries. Doesn’t use your Mantel storage, and new photos appear automatically.', badge: 'Most space', onClick: () => setSheet('drive') },
          { key: 'gphotos', tone: 'green' as const, icon: <Images size={28} weight="fill" />, title: 'Google Photos', body: 'Choose photos from your Google Photos library.', badge: null, onClick: () => { window.location.href = '/api/google-photos/start'; } },
        ].map((o) => (
          <button key={o.key} type="button" onClick={o.onClick} className="pressable flex w-full items-center gap-4 rounded-[18px] bg-cell p-4 text-left shadow-cell">
            <IconTile tone={o.tone} size={52}>{o.icon}</IconTile>
            <div className="flex-1">
              <p className="flex items-center gap-2 text-[17px] font-semibold">
                {o.title}
                {o.badge && <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-bold uppercase text-ok">{o.badge}</span>}
              </p>
              <p className="text-[13px] leading-snug text-label-2">{o.body}</p>
            </div>
            <CaretRight size={16} weight="bold" className="text-label-3" />
          </button>
        ))}
        {usage && (
          <p className="px-1 text-[13px] text-label-2">
            You’ve used {mb(usage.used)} of {mb(usage.quota)} Mantel storage. Need more? Put photos in a Google Drive folder. It doesn’t count.
          </p>
        )}
      </Sheet>

      <Sheet open={sheet === 'drive'} onOpenChange={(o) => !o && setSheet(null)} title="Google Drive folder">
        <ol className="space-y-3 rounded-[14px] bg-cell p-4 text-[15px] leading-snug shadow-cell">
          <li className="flex gap-3"><span className="bg-ember flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white">1</span>Open Google Drive and find a folder of photos.</li>
          <li className="flex gap-3"><span className="bg-ember flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white">2</span><span>Tap <b>Share</b> → General access → <b>Anyone with the link</b> (Viewer).</span></li>
          <li className="flex gap-3"><span className="bg-ember flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white">3</span>Copy the link and paste it below.</li>
        </ol>
        <TextInput value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" inputMode="url" autoFocus />
        <p className="flex gap-2 px-1 text-[13px] leading-snug text-label-2">
          <ShieldCheck size={18} className="shrink-0 text-ok" weight="fill" />
          The folder isn’t listed or searchable anywhere. Only people you give the link to can open it, and Mantel never copies your photos.
        </p>
        <Button block size="xl" onClick={addDrive} loading={busy} disabled={!driveUrl.includes('drive.google.com')}>Add folder</Button>
      </Sheet>

      <Sheet open={sheet === 'video'} onOpenChange={(o) => !o && setSheet(null)} title="Name your album" description={uploadFrom === 'apple-photos' ? 'Next, pick photos from the Photos app.' : 'Next, add photos and videos from your computer.'}>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Family, Graduation, Summer 2026" autoFocus />
        <Button block size="xl" onClick={createVideoAlbum} loading={busy} disabled={!name.trim()}>Create album</Button>
      </Sheet>

      {/* ── Manage album ── */}
      <Sheet open={!!manage} onOpenChange={(o) => !o && setManage(null)} title={manage?.name ?? ''}>
        {manage && (
          <Section>
            <Row icon={<IconTile tone="ember"><Images size={18} weight="bold" /></IconTile>} title="Open album" href={`/admin/albums/${manage.id}`} />
            {manage.source_type === 'drive' && (
              <Row icon={<IconTile tone="blue"><ArrowsClockwise size={18} weight="bold" /></IconTile>} title="Sync from Drive now" onClick={() => sync(manage)} loading={busy} />
            )}
            <Row icon={<IconTile tone="red"><Trash size={18} weight="bold" /></IconTile>} title="Delete album" destructive onClick={() => remove(manage)} />
          </Section>
        )}
        {manage?.source_type === 'drive' && (
          <p className="px-1 text-[13px] text-label-2">Deleting removes it from Mantel only. Your Drive folder isn’t touched.</p>
        )}
      </Sheet>
    </Page>
  );
}
