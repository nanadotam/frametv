'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppleLogo, GoogleDriveLogo, Television, Globe, CheckCircle, ArrowRight } from '@phosphor-icons/react';
import BrandMark from '@/components/BrandMark';
import { Button, TextInput } from '@/components/m/Controls';
import { IconTile } from '@/components/m/List';
import { Toaster, toast } from '@/components/m/Toast';
import { LOOKS, LookArt } from '@/components/looks/catalog';
import { MAC_DOWNLOAD_URL } from '@/lib/links';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    /** Exposed by the Mantel desktop app's preload script. */
    mantel?: { isApp: true; openScreensaverSetup: () => void };
  }
}

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

  useEffect(() => {
    setInApp(!!window.mantel?.isApp);
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
                  {name ? `Hi ${name}! ` : ''}Let’s add your photos.
                </h1>
                <p className="text-[17px] leading-relaxed text-label-2">
                  Mantel shows photos straight from a Google Drive folder. They stay in <b className="text-label">your</b> Drive, safe
                  and backed up, and anything you add there shows up on your screens automatically.
                </p>
                <div className="space-y-3 rounded-[18px] bg-cell p-4 shadow-cell">
                  <div className="flex items-center gap-3">
                    <IconTile tone="blue" size={40}><GoogleDriveLogo size={24} weight="fill" /></IconTile>
                    <p className="text-[15px] leading-snug">
                      In Drive: <b>Share</b> → <b>Anyone with the link</b> → <b>Copy link</b>, then paste it here.
                    </p>
                  </div>
                  <TextInput value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="Paste Drive folder link" inputMode="url" />
                </div>
                <Button block size="xl" onClick={addDrive} loading={busy} disabled={!driveUrl.includes('drive.google.com')}>
                  Add photos
                </Button>
                <button type="button" onClick={() => setStep('look')} className="w-full py-2 text-center text-[15px] font-medium text-tint">
                  I’ll do this later
                </button>
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
                      <LookArt id={l.id} className="aspect-[4/3] w-full" />
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
      <Toaster />
    </main>
  );
}
