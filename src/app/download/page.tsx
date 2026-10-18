'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle, DownloadSimple } from '@phosphor-icons/react';
import BrandMark from '@/components/BrandMark';
import { Toaster } from '@/components/m/Toast';
import { AskAI, MacInstallSteps } from '@/components/help/MacInstallSteps';
import { MAC_DOWNLOAD_URL } from '@/lib/links';

/**
 * Starts the Mac download straight from GitHub Releases (no GitHub page in
 * between) and shows what to do while it downloads.
 */
export default function DownloadPage() {
  const [started, setStarted] = useState(false);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    const mac = /Macintosh|Mac OS X/.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent);
    setIsMac(mac);
    if (!mac) return;
    // GitHub serves the asset as an attachment, so navigating to it starts
    // the download and leaves this page (and its instructions) in place.
    const t = setTimeout(() => {
      window.location.href = MAC_DOWNLOAD_URL;
      setStarted(true);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="min-h-dvh bg-grouped text-label">
      <header className="mx-auto flex h-14 max-w-3xl items-center px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={28} className="rounded-[7px]" />
          <span className="text-[18px] font-bold tracking-tight">Mantel</span>
        </Link>
      </header>

      <div className="mx-auto max-w-3xl px-5 pb-20 pt-8">
        {isMac ? (
          <div className="text-center">
            <span className="bg-ember mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg">
              {started ? <CheckCircle size={34} weight="fill" /> : <DownloadSimple size={30} weight="bold" />}
            </span>
            <h1 className="mt-5 text-[clamp(30px,5vw,44px)] font-bold tracking-[-0.03em]">Your download has started</h1>
            <p className="mt-2 text-[17px] text-label-2">
              Not downloading?{' '}
              <a href={MAC_DOWNLOAD_URL} className="font-semibold text-tint">Click here to try again</a>.
            </p>
          </div>
        ) : (
          <div className="text-center">
            <h1 className="text-[clamp(30px,5vw,44px)] font-bold tracking-[-0.03em]">Mantel for Mac</h1>
            <p className="mx-auto mt-2 max-w-md text-[17px] text-label-2">
              Open this page on your Mac to download the app. On this device you can{' '}
              <Link href="/signup" className="font-semibold text-tint">use Mantel in the browser</Link> instead.
            </p>
            <a href={MAC_DOWNLOAD_URL} className="mt-4 inline-block text-[15px] font-semibold text-tint">Download anyway</a>
          </div>
        )}

        <section className="mt-12 rounded-[24px] bg-cell p-6 shadow-cell sm:p-8">
          <h2 className="mb-6 text-[24px] font-bold tracking-tight">Installing takes about two minutes</h2>
          <MacInstallSteps />
        </section>

        <div className="mt-6">
          <AskAI />
        </div>
      </div>
      <Toaster />
    </main>
  );
}
