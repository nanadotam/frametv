'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppleLogo, GoogleDriveLogo, Television, Globe, CheckCircle, ArrowRight, UploadSimple, Images } from '@phosphor-icons/react';
import { useVideoUploads } from '@/lib/video/useVideoUploads';
import BrandMark from '@/components/BrandMark';
import { Button, TextInput } from '@/components/m/Controls';
import { IconTile } from '@/components/m/List';
import { Toaster, toast } from '@/components/m/Toast';
import { LOOKS } from '@/components/looks/catalog';
import { LivePreview } from '@/components/looks/LivePreview';
import { MAC_DOWNLOAD_URL } from '@/lib/links';
import { cn } from '@/lib/utils';
import { startGooglePhotos } from '@/lib/googlePhotos/start';
import { ApplePhotosGuide } from '@/components/m/ApplePhotosGuide';


const STEPS = ['photos', 'look', 'screen'] as const;
type Step = (typeof STEPS)[number];

export default function WelcomePage() {
  const [step, setStep] = useState<Step>('photos');
  const [name, setName] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const [look, setLook] = useState('slideshow-single');
  const [inApp, setInApp] = useState(false);
  const [source, setSource] = useState<null | 'upload' | 'apple' | 'drive' | 'gphotos'>(null);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [appleGuide, setAppleGuide] = useState(false);
  const [quotaLabel, setQuotaLabel] = useState('500 MB');
  const fileInput = useRef<HTMLInputElement>(null);
  const uploads = useVideoUploads({ albumId: albumId ?? '', onAdded: () => {}, onReplaced: () => {}, source: source === 'apple' ? 'apple-photos' : 'upload' });

  // Uploads go into one "My Photos" album that's put straight on display.
  const chooseSource = async (s: 'upload' | 'apple' | 'drive' | 'gphotos') => {
    if (s === 'gphotos') {
      startGooglePhotos((h) => window.location.assign(h));
      return;
    }
    setSource(s);
    if (s === 'apple') setAppleGuide(true);
    if ((s === 'upload' || s === 'apple') && !albumId) {
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: s === 'apple' ? 'From Photos' : 'My Photos', source_type: 'upload', display_order: 0 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSource(null);
        return toast.error(j.error ?? 'Couldn’t create your album.');
      }
      setAlbumId(j.album.id);
      await fetch('/api/display-state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_album_ids: [j.album.id] }),
      });
    }
  };

  useEffect(() => {
    setInApp(!!window.mantel?.isApp);
    fetch('/api/videos/usage').then((r) => (r.ok ? r.json() : null)).then((u) => u && setQuotaLabel(`${Math.round(u.quota / 1024 / 1024)} MB`));
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.kind !== 'admin') window.location.href = '/login?next=/welcome';
        else setName((j.user?.name ?? '').split(' ')[0]);
      });
  }, []);

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
      setAdded(j.synced ?? 0);
      // Put the new album on display straight away.
      if (j.albumId) {
        await fetch('/api/display-state', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active_album_ids: [j.albumId] }),
        });
      }
      setStep('look');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t add that folder.');
    } finally {
      setBusy(false);
    }
  };

  const chooseLook = async () => {
    setBusy(true);
    await fetch('/api/display-state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_mode_id: look }),
    }).catch(() => null);
    setBusy(false);
    setStep('screen');
  };

  const index = STEPS.indexOf(step);

  return (
    <main className="flex min-h-dvh flex-col bg-grouped text-label">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <BrandMark size={34} className="rounded-[9px]" />
        <div className="flex gap-1.5" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className={cn('h-1.5 rounded-full transition-all duration-300', i <= index ? 'w-6 bg-tint' : 'w-1.5 bg-fill-2')} />
          ))}
        </div>
        <a href="/admin" className="text-[15px] font-medium text-label-2">Skip</a>
      </header>

      <div className="mx-auto w-full max-w-xl flex-1 px-5 pb-10 pt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-5"
          >
            {step === 'photos' && (
              <>
                <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em]">
                  {name ? `Hi ${name}! ` : ''}Let’s set up your photo library.
                </h1>
                <p className="text-[17px] leading-relaxed text-label-2">
                  Bring in photos from wherever they live. You can add more sources later in <b className="text-label">Library</b>.
                </p>

                {!source && (
                  <div className="space-y-3">
                    {[
                      { id: 'upload' as const, tone: 'ember' as const, icon: <UploadSimple size={26} weight="bold" />, title: 'From this computer', body: `Drag in photos and videos. Compressed on your device, up to ${quotaLabel} free.` },
                      { id: 'apple' as const, tone: 'gray' as const, icon: <AppleLogo size={26} weight="fill" />, title: 'From Apple Photos', body: 'Pick photos or whole albums from the Photos app.' },
                      { id: 'drive' as const, tone: 'blue' as const, icon: <GoogleDriveLogo size={26} weight="fill" />, title: 'Google Drive folder', body: 'Best for big libraries: unlimited, and new photos appear by themselves.' },
                      { id: 'gphotos' as const, tone: 'green' as const, icon: <Images size={26} weight="fill" />, title: 'Google Photos', body: 'Choose from your Google Photos library.' },
                    ].map((o) => (
                      <button key={o.id} type="button" onClick={() => chooseSource(o.id)} className="pressable flex w-full items-center gap-4 rounded-[18px] bg-cell p-4 text-left shadow-cell">
                        <IconTile tone={o.tone} size={48}>{o.icon}</IconTile>
                        <div className="flex-1">
                          <p className="text-[17px] font-semibold">{o.title}</p>
                          <p className="text-[13px] leading-snug text-label-2">{o.body}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {(source === 'upload' || source === 'apple') && albumId && (
                  <>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/*,video/*,.heic,.heif"
                      multiple
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.length) uploads.enqueue(Array.from(e.target.files)); e.target.value = ''; }}
                    />
                    <button
                      type="button"
                      onClick={() => (source === 'apple' ? setAppleGuide(true) : fileInput.current?.click())}
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setDragging(false); uploads.enqueue(Array.from(e.dataTransfer.files)); }}
                      className={cn('flex w-full flex-col items-center rounded-[22px] border-2 border-dashed px-6 py-12 text-center transition-colors', dragging ? 'border-tint bg-tint/10' : 'border-separator bg-cell')}
                    >
                      {source === 'apple' ? <AppleLogo size={40} weight="fill" className="text-label" /> : <UploadSimple size={40} className="text-tint" />}
                      <p className="mt-3 text-[18px] font-semibold">{source === 'apple' ? 'Click to see how to find your Apple Photos' : 'Drop photos and videos here'}</p>
                      <p className="mt-1 text-[14px] text-label-2">
                        {source === 'apple' ? 'Or drag photos straight out of the Photos app onto this box.' : 'or click to choose them'}
                      </p>
                    </button>
                    {uploads.items.length > 0 && (
                      <p className="text-center text-[15px] text-label-2">
                        {uploads.items.filter((i) => i.status === 'done').length} of {uploads.items.length} added
                        {uploads.busy ? '. Compressing…' : ''}
                      </p>
                    )}
                    <Button block size="xl" onClick={() => setStep('look')} disabled={!uploads.items.some((i) => i.status === 'done')}>
                      Continue
                    </Button>
                    <button type="button" onClick={() => setSource(null)} className="w-full py-2 text-center text-[15px] font-medium text-tint">Choose a different source</button>
                  </>
                )}

                {source === 'drive' && (
                  <>
                    <div className="space-y-3 rounded-[18px] bg-cell p-4 shadow-cell">
                      <p className="text-[15px] leading-snug">
                        In Google Drive, make a folder (e.g. “Mantel”) and drop your photos in. Then <b>Share</b> → <b>Anyone with the link</b> → <b>Copy link</b> and paste it here.
                      </p>
                      <TextInput value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="Paste Drive folder link" inputMode="url" />
                    </div>
                    <Button block size="xl" onClick={addDrive} loading={busy} disabled={!driveUrl.includes('drive.google.com')}>Add photos</Button>
                    <button type="button" onClick={() => setSource(null)} className="w-full py-2 text-center text-[15px] font-medium text-tint">Choose a different source</button>
                  </>
                )}

                {!source && (
                  <button type="button" onClick={() => setStep('look')} className="w-full py-2 text-center text-[15px] font-medium text-tint">
                    I’ll do this later
                  </button>
                )}
              </>
            )}

            {step === 'look' && (
              <>
                {added > 0 && (
                  <p className="inline-flex items-center gap-2 rounded-full bg-ok/15 px-3 py-1.5 text-[15px] font-semibold text-ok">
                    <CheckCircle size={18} weight="fill" /> {added} photos added
                  </p>
                )}
                <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em]">Pick a look.</h1>
                <p className="text-[17px] text-label-2">You can change it any time, or schedule different looks for morning and night.</p>
                <div className="grid grid-cols-2 gap-3">
                  {LOOKS.filter((l) => ['slideshow-single', 'slideshow-grid', 'pinterest', 'scrapbook', 'clock-text', 'scripture'].includes(l.id)).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLook(l.id)}
                      className={cn('pressable overflow-hidden rounded-[16px] bg-cell text-left shadow-cell ring-[3px]', look === l.id ? 'ring-tint' : 'ring-transparent')}
                    >
                      <LivePreview id={l.id} className="aspect-[4/3] w-full" />
                      <p className="px-3 py-2 text-[15px] font-semibold">{l.name}</p>
                    </button>
                  ))}
                </div>
                <Button block size="xl" onClick={chooseLook} loading={busy} icon={<ArrowRight size={20} weight="bold" />}>
                  Continue
                </Button>
              </>
            )}

            {step === 'screen' && (
              <>
                <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em]">Where should it show?</h1>
                <p className="text-[17px] text-label-2">Use as many screens as you like. Each one shows the same memories.</p>
                <div className="space-y-3">
                  {inApp ? (
                    <button type="button" onClick={() => window.mantel?.openScreensaverSetup()} className="pressable flex w-full items-center gap-4 rounded-[18px] bg-cell p-4 text-left shadow-cell">
                      <IconTile tone="gray" size={48}><AppleLogo size={28} weight="fill" /></IconTile>
                      <div>
                        <p className="text-[17px] font-semibold">This Mac’s screensaver</p>
                        <p className="text-[13px] text-label-2">We’ll walk you through it, step by step.</p>
                      </div>
                    </button>
                  ) : (
                    <a href={MAC_DOWNLOAD_URL} className="pressable flex items-center gap-4 rounded-[18px] bg-cell p-4 shadow-cell">
                      <IconTile tone="gray" size={48}><AppleLogo size={28} weight="fill" /></IconTile>
                      <div>
                        <p className="text-[17px] font-semibold">My Mac’s screensaver</p>
                        <p className="text-[13px] text-label-2">Download the Mantel app (free).</p>
                      </div>
                    </a>
                  )}
                  <a href="/admin/devices" className="pressable flex items-center gap-4 rounded-[18px] bg-cell p-4 shadow-cell">
                    <IconTile tone="blue" size={48}><Television size={28} weight="fill" /></IconTile>
                    <div>
                      <p className="text-[17px] font-semibold">A TV</p>
                      <p className="text-[13px] text-label-2">Use the TV’s web browser. No laptop needed.</p>
                    </div>
                  </a>
                  <a href="/display" className="pressable flex items-center gap-4 rounded-[18px] bg-cell p-4 shadow-cell">
                    <IconTile tone="green" size={48}><Globe size={28} weight="bold" /></IconTile>
                    <div>
                      <p className="text-[17px] font-semibold">This browser, right now</p>
                      <p className="text-[13px] text-label-2">Great for a spare iPad or monitor.</p>
                    </div>
                  </a>
                </div>
                <Button block size="xl" variant="gray" onClick={() => (window.location.href = '/admin')}>Go to Mantel</Button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <ApplePhotosGuide
        open={appleGuide}
        onOpenChange={setAppleGuide}
        onChoose={() => {
          setAppleGuide(false);
          fileInput.current?.click();
        }}
      />
      <Toaster />
    </main>
  );
}
