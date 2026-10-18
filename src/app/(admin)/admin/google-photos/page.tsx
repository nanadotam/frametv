'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Images, ArrowSquareOut } from '@phosphor-icons/react';
import { Page } from '@/components/m/Page';
import { Button, Empty, TextInput } from '@/components/m/Controls';
import { IconTile } from '@/components/m/List';
import { toast } from '@/components/m/Toast';
import { UploadPanel } from '@/components/admin/UploadPanel';
import { useVideoUploads } from '@/lib/video/useVideoUploads';

type Picked = { id: string; url: string; name: string; mimeType: string; takenAt?: string };

/** Copies picked Google Photos into one album through the normal upload queue. */
function Importer({ albumId, items, nonce, onDone }: { albumId: string; items: Picked[]; nonce: string; onDone: () => void }) {
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
            const res = await fetch(`/api/google-photos/media?nonce=${nonce}&url=${encodeURIComponent(it.url)}`);
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
  }, [items, uploads, nonce]);

  const done = uploads.items.length > 0 && !uploads.busy && uploads.items.length >= items.length;
  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  return (
    <UploadPanel items={uploads.items} busy={uploads.busy} onRetry={uploads.retry} onCancel={uploads.cancelQueued} onClose={uploads.clearFinished} />
  );
}

function Step({ n, title, active, done, children }: { n: number; title: string; active: boolean; done: boolean; children?: React.ReactNode }) {
  return (
    <div className={`rounded-[18px] bg-cell p-5 shadow-cell transition-opacity ${active || done ? '' : 'opacity-45'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold text-white ${done ? 'bg-ok' : active ? 'bg-ember' : 'bg-label-3'}`}>
          {done ? '✓' : n}
        </span>
        <p className="text-[17px] font-semibold">{title}</p>
        {active && !done && <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-tint border-r-transparent" />}
      </div>
      {active && children && <div className="mt-4 space-y-3 pl-11">{children}</div>}
    </div>
  );
  }

function GooglePhotosImport() {
  const params = useSearchParams();
  const nonce = params.get('nonce') ?? '';
  const [stage, setStage] = useState<'signin' | 'pick' | 'name' | 'import' | 'done' | 'failed'>('signin');
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [pickerOpened, setPickerOpened] = useState(false);
  const [items, setItems] = useState<Picked[]>([]);
  const [skippedVideos, setSkippedVideos] = useState(0);
  const [name, setName] = useState('Google Photos');
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 1. Wait for Google sign-in (happens in the real browser).
  useEffect(() => {
    if (!nonce || stage !== 'signin') return;
    const id = setInterval(async () => {
      const j = await fetch(`/api/google-photos/status?nonce=${nonce}`).then((r) => r.json()).catch(() => null);
      if (!j) return;
      if (j.status === 'ready') {
        setPickerUri(j.pickerUri);
        setStage('pick');
      } else if (j.status === 'error' || j.status === 'expired') {
        setStage('failed');
      }
    }, 2000);
    return () => clearInterval(id);
  }, [nonce, stage]);

  // 2. Wait for the person to finish picking in Google's picker.
  useEffect(() => {
    if (stage !== 'pick' || !pickerOpened) return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/google-photos/session?nonce=${nonce}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        clearInterval(id);
        setStage('failed');
        return;
      }
      if (j.ready) {
        clearInterval(id);
        setItems(j.items);
        setSkippedVideos(j.skippedVideos ?? 0);
        setStage('name');
      }
    }, 2500);
    return () => clearInterval(id);
  }, [stage, pickerOpened, nonce]);

  const openPicker = () => {
    if (!pickerUri) return;
    window.open(`${pickerUri}/autoclose`, '_blank', 'noopener');
    setPickerOpened(true);
  };

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
    setStage('import');
  };


  if (!nonce) {
    return (
      <Page title="Google Photos" back={{ href: '/admin/albums', label: 'Library' }}>
        <p className="text-label-2">Start from Library → Add photos → Google Photos.</p>
      </Page>
    );
  }

  return (
    <Page title="Google Photos" back={{ href: '/admin/albums', label: 'Library' }} subtitle="Bring photos in from Google Photos in three steps.">
      {stage === 'failed' ? (
        <Empty
          art={<IconTile tone="red" size={64}><Images size={34} weight="fill" /></IconTile>}
          title="Google Photos didn’t connect"
          body="The sign-in was cancelled or took too long. Make sure you sign in with the Google account Mantel was set up for, then try again."
          action={<Link href="/admin/albums?add=1"><Button block>Try again</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          <Step n={1} title="Sign in to Google" active={stage === 'signin'} done={stage !== 'signin'}>
            <p className="text-[15px] text-label-2">
              Google’s sign-in opened in your web browser. Choose your account and click <b className="text-label">Allow</b>.
              If Google says the app isn’t verified, click <b className="text-label">Continue</b>; it’s your own Mantel.
            </p>
            <p className="text-[13px] text-label-3">This page carries on by itself when you’re done.</p>
          </Step>

          <Step n={2} title="Pick your photos" active={stage === 'pick'} done={['name', 'import', 'done'].includes(stage)}>
            {!pickerOpened ? (
              <Button icon={<ArrowSquareOut size={18} weight="bold" />} onClick={openPicker}>Open Google Photos</Button>
            ) : (
              <>
                <p className="text-[15px] text-label-2">
                  In Google Photos, select photos (or open an album and select all), then click <b className="text-label">Done</b>. Come back here after.
                </p>
                <button type="button" onClick={openPicker} className="text-[15px] font-semibold text-tint">Open it again</button>
              </>
            )}
          </Step>

          <Step n={3} title="Add them to Mantel" active={['name', 'import', 'done'].includes(stage)} done={stage === 'done'}>
            {stage === 'name' && (
              <>
                <p className="text-[15px]">
                  <b>{items.length} photo{items.length === 1 ? '' : 's'}</b> picked
                  {skippedVideos > 0 && <span className="text-label-2"> · {skippedVideos} videos skipped (upload those from your computer)</span>}
                </p>
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Album name" />
                <Button block size="xl" onClick={createAlbum} loading={busy} disabled={!items.length}>Add to Mantel</Button>
              </>
            )}
            {stage === 'import' && <p className="text-[15px] text-label-2">Copying and compressing your photos. Keep this page open.</p>}
            {stage === 'done' && albumId && (
              <Link href={`/admin/albums/${albumId}`}><Button block icon={<CheckCircle size={18} weight="fill" />}>Open album</Button></Link>
            )}
          </Step>
        </div>
      )}

      {albumId && (stage === 'import' || stage === 'done') && (
        <Importer
          albumId={albumId}
          items={items}
          nonce={nonce}
          onDone={() => {
            setStage('done');
            fetch(`/api/google-photos/status?nonce=${nonce}`, { method: 'DELETE' }).catch(() => {});
          }}
        />
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
