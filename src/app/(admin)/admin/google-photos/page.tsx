'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Images, ArrowSquareOut } from '@phosphor-icons/react';
import { Page } from '@/components/m/Page';
import { Button, TextInput } from '@/components/m/Controls';
import { IconTile } from '@/components/m/List';
import { toast } from '@/components/m/Toast';
import { UploadPanel } from '@/components/admin/UploadPanel';
import { useVideoUploads } from '@/lib/video/useVideoUploads';

type Picked = { id: string; url: string; name: string; mimeType: string; takenAt?: string };

/** Copies picked Google Photos into one album through the normal upload queue. */
function Importer({ albumId, items, onDone }: { albumId: string; items: Picked[]; onDone: () => void }) {
  const uploads = useVideoUploads({ albumId, onAdded: () => {}, onReplaced: () => {}, source: 'google-photos' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      // Fetch in small batches so the queue starts compressing straight away.
      for (let i = 0; i < items.length; i += 6) {
        const batch = await Promise.all(
          items.slice(i, i + 6).map(async (it) => {
            const res = await fetch(`/api/google-photos/media?url=${encodeURIComponent(it.url)}`);
            if (!res.ok) return null;
            const blob = await res.blob();
            return new File([blob], it.name || `${it.id}.jpg`, {
              type: blob.type || it.mimeType,
              lastModified: it.takenAt ? Date.parse(it.takenAt) : Date.now(),
            });
          })
        );
        uploads.enqueue(batch.filter((f): f is File => !!f));
      }
    })();
  }, [items, uploads]);

  const done = uploads.items.length > 0 && !uploads.busy && uploads.items.length >= items.length;
  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  return (
    <UploadPanel items={uploads.items} busy={uploads.busy} onRetry={uploads.retry} onCancel={uploads.cancelQueued} onClose={uploads.clearFinished} />
  );
}

function GooglePhotosImport() {
  const params = useSearchParams();
  const session = params.get('session');
  const picker = params.get('picker');
  const [items, setItems] = useState<Picked[] | null>(null);
  const [skippedVideos, setSkippedVideos] = useState(0);
  const [name, setName] = useState('Google Photos');
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);

  // Poll until the user has finished picking in Google's window.
  useEffect(() => {
    if (!session || items) return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/google-photos/session?id=${encodeURIComponent(session)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        clearInterval(id);
        toast.error(j.error ?? 'Google Photos stopped responding. Try again.');
        return;
      }
      if (j.ready) {
        clearInterval(id);
        setItems(j.items);
        setSkippedVideos(j.skippedVideos ?? 0);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [session, items]);

  const createAlbum = async () => {
    setBusy(true);
    const res = await fetch('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() || 'Google Photos', source_type: 'upload', display_order: 999 }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(j.error ?? 'Couldn’t create the album.');
    setAlbumId(j.album.id);
  };

  if (!session || !picker) {
    return (
      <Page title="Google Photos" back={{ href: '/admin/albums', label: 'Library' }}>
        <p className="text-label-2">Start from Library → Add photos → Google Photos.</p>
      </Page>
    );
  }

  return (
    <Page title="Google Photos" back={{ href: '/admin/albums', label: 'Library' }} subtitle="Pick photos in Google’s window. Mantel copies them in, compressed.">
      {!items && (
        <div className="space-y-4 rounded-[20px] bg-cell p-6 text-center shadow-cell">
          <IconTile tone="green" size={64}><Images size={36} weight="fill" /></IconTile>
          <h2 className="text-[22px] font-bold tracking-tight">Choose your photos</h2>
          <p className="text-[15px] text-label-2">
            Google’s photo picker opens in a new window. Select photos (or open an album and select all), then click <b className="text-label">Done</b>. Come back here when you’re finished.
          </p>
          <a href={`${picker}/autoclose`} target="_blank" rel="noreferrer" className="block">
            <Button block size="xl" icon={<ArrowSquareOut size={20} weight="bold" />}>Open Google Photos</Button>
          </a>
          <p className="text-[13px] text-label-3">Waiting for your selection…</p>
        </div>
      )}

      {items && !albumId && (
        <div className="space-y-4 rounded-[20px] bg-cell p-6 shadow-cell">
          <p className="text-[17px] font-semibold">
            {items.length} photo{items.length === 1 ? '' : 's'} picked
            {skippedVideos > 0 && <span className="font-normal text-label-2"> · {skippedVideos} videos skipped (upload those from your computer)</span>}
          </p>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Album name" />
          <Button block size="xl" onClick={createAlbum} loading={busy} disabled={!items.length}>Add to Mantel</Button>
        </div>
      )}

      {albumId && items && (
        <>
          <div className="rounded-[20px] bg-cell p-6 text-center shadow-cell">
            {finished ? (
              <>
                <CheckCircle size={48} weight="fill" className="mx-auto text-ok" />
                <p className="mt-2 text-[20px] font-bold">All done</p>
                <Link href={`/admin/albums/${albumId}`} className="mt-4 block"><Button block>Open album</Button></Link>
              </>
            ) : (
              <p className="text-[15px] text-label-2">Copying and compressing your photos. Keep this page open.</p>
            )}
          </div>
          <Importer albumId={albumId} items={items} onDone={() => setFinished(true)} />
        </>
      )}
    </Page>
  );
}

export default function GooglePhotosPage() {
  return (
    <Suspense fallback={null}>
      <GooglePhotosImport />
    </Suspense>
  );
}
