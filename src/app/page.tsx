'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AppleLogo, DownloadSimple, GoogleDriveLogo, Television, DeviceTabletSpeaker, Globe, ShieldCheck,
  UserCirclePlus, MonitorPlay, Key, Lightning,
} from '@phosphor-icons/react';
import BrandMark from '@/components/BrandMark';
import { SHOWCASE, photo, UNSPLASH_REF } from '@/lib/showcase';

const ease = [0.2, 0.8, 0.2, 1] as const;

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** A MacBook-ish frame running a crossfading slideshow, sitting on a mantel. */
function HeroDevice() {
  const now = useClock();
  const [i, setI] = useState(0);
  const slides = [SHOWCASE[0], SHOWCASE[5], SHOWCASE[6], SHOWCASE[12], SHOWCASE[1]];
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % slides.length), 4200);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <div className="relative mx-auto w-full max-w-[880px]">
      <div className="relative rounded-[22px] bg-[#1d1d1f] p-[1.4%] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.55)] ring-1 ring-black/10">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[12px] bg-black">
          {slides.map((p, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={photo(p, 1600, 1000)}
              alt={p.alt}
              className="absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1600ms] ease-out"
              style={{ opacity: n === i ? 1 : 0, transform: n === i ? 'scale(1.04)' : 'scale(1)' }}
              loading={n === 0 ? 'eager' : 'lazy'}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          {now && (
            <div className="absolute bottom-[6%] right-[5%] text-right text-white drop-shadow-lg">
              <p className="text-[clamp(28px,5vw,64px)] font-semibold leading-none tracking-tight tabular-nums">
                {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '')}
              </p>
              <p className="mt-1 text-[clamp(10px,1.3vw,15px)] font-medium uppercase tracking-[0.2em] text-white/80">
                {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="mx-auto h-[14px] w-[112%] -translate-x-[5.4%] rounded-b-[18px] bg-gradient-to-b from-[#d9d9de] to-[#a9a9b0] dark:from-[#3a3a3e] dark:to-[#1f1f22]" />
      {/* the mantel */}
      <div className="mx-auto mt-6 h-5 w-[120%] -translate-x-[8.3%] rounded-[8px] bg-gradient-to-b from-[#f6e3c6] to-[#b98b5e] shadow-[0_18px_30px_-12px_rgb(120_60_20/0.5)] dark:from-[#6b4a2e] dark:to-[#3a2616]" />
    </div>
  );
}

function LookCard({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease }}
      className="overflow-hidden rounded-[24px] bg-cell shadow-cell"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-black">{children}</div>
      <div className="p-5">
        <h3 className="text-[20px] font-bold tracking-tight">{title}</h3>
        <p className="mt-1 text-[15px] leading-snug text-label-2">{blurb}</p>
      </div>
    </motion.div>
  );
}

const img = (n: number, w = 600, h?: number, cls = 'h-full w-full object-cover') => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={photo(SHOWCASE[n], w, h)} alt={SHOWCASE[n].alt} className={cls} loading="lazy" />
);

export default function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSignedIn(j?.kind === 'admin'))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-dvh bg-grouped text-label">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 border-b border-separator/60 bg-glass backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size={30} className="rounded-[8px]" />
            <span className="text-[19px] font-bold tracking-tight">Mantel</span>
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <Link href="/help" className="hidden px-3 text-[15px] font-medium text-label-2 hover:text-label sm:block">Help</Link>
            {signedIn ? (
              <Link href="/admin" className="pressable rounded-full bg-fill px-4 py-1.5 text-[15px] font-semibold">Open Mantel</Link>
            ) : (
              <Link href="/login" className="pressable rounded-full px-3 py-1.5 text-[15px] font-semibold text-tint">Sign in</Link>
            )}
            <Link href="/download" className="pressable bg-ember rounded-full px-4 py-1.5 text-[15px] font-semibold text-white">Download</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-40 h-[620px] bg-[radial-gradient(60%_60%_at_50%_30%,rgb(255_154_60/0.35),transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-14 text-center sm:pt-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>
            <BrandMark size={96} className="mx-auto rounded-[24px] shadow-[0_20px_40px_-14px_rgb(242_98_46/0.7)]" />
            <h1 className="mx-auto mt-8 max-w-3xl text-[clamp(42px,7.5vw,84px)] font-bold leading-[1.02] tracking-[-0.035em]">
              Your memories, <span className="text-ember">on display.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[clamp(17px,2.2vw,21px)] leading-relaxed text-label-2">
              Mantel turns your Mac’s screensaver, your TV or any spare screen into a living picture frame of the people and places you love.
            </p>
            <div className="mx-auto mt-9 flex max-w-xl flex-col gap-3 sm:flex-row sm:justify-center [&>a]:whitespace-nowrap">
              <Link href="/download" className="pressable bg-ember inline-flex h-[58px] items-center justify-center gap-2 rounded-[18px] px-7 text-[18px] font-semibold text-white shadow-[0_10px_30px_-10px_var(--m-tint)]">
                <AppleLogo size={22} weight="fill" /> Download for Mac
              </Link>
              <Link href={signedIn ? '/admin' : '/signup'} className="pressable inline-flex h-[58px] items-center justify-center rounded-[18px] bg-fill px-7 text-[18px] font-semibold">
                {signedIn ? 'Open Mantel' : 'Use it in a browser'}
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-label-2">Free · macOS 13 Ventura or later · Also works on TVs, iPads and any browser</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.15, ease }} className="mt-16 px-[6%]">
            <HeroDevice />
          </motion.div>
        </div>
      </section>

      {/* ── Looks ── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-[clamp(32px,5vw,52px)] font-bold tracking-[-0.03em]">A look for every room.</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[18px] text-label-2">Switch with a tap from your phone, or schedule a calm slideshow by day and a clock by night.</p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <LookCard title="Slideshow" blurb="One photo at a time, softly crossfading, with a clock if you like.">{img(2, 800, 500)}</LookCard>
          <LookCard title="Gallery Wall" blurb="A mosaic that changes one tile at a time.">
            <div className="grid h-full grid-cols-3 grid-rows-2 gap-[3px] p-[3px]">
              {[3, 7, 9, 13, 4, 11].map((n) => <div key={n} className="overflow-hidden rounded-[4px]">{img(n, 300, 300)}</div>)}
            </div>
          </LookCard>
          <LookCard title="Pinboard" blurb="Endless drifting columns of your photos.">
            <div className="flex h-full gap-[4px] p-[4px]">
              {[[5, 10, 0], [8, 12, 14], [1, 6, 3]].map((col, c) => (
                <div key={c} className="flex flex-1 flex-col gap-[4px]" style={{ marginTop: c === 1 ? -40 : c === 2 ? -16 : 0 }}>
                  {col.map((n, r) => <div key={n} className="overflow-hidden rounded-[6px]" style={{ height: [110, 80, 100][(c + r) % 3] }}>{img(n, 300)}</div>)}
                </div>
              ))}
            </div>
          </LookCard>
          <LookCard title="Scrapbook" blurb="Polaroids taped and tossed across the screen.">
            <div className="absolute inset-0 bg-[#e9dcc7]">
              {[[8, 10, -8, 13], [40, 20, 6, 4], [22, 46, -3, 12]].map(([l, t, r, n]) => (
                <div key={n} className="absolute bg-white p-[6px] pb-[22px] shadow-xl" style={{ left: `${l}%`, top: `${t}%`, width: '34%', transform: `rotate(${r}deg)` }}>
                  <div className="aspect-square overflow-hidden">{img(n, 300, 300)}</div>
                </div>
              ))}
            </div>
          </LookCard>
          <LookCard title="Clock" blurb="A big, quiet clock that fades from day to night.">
            <div className="flex h-full flex-col items-center justify-center bg-[#0c0c0e] text-white">
              <span className="text-[64px] font-semibold leading-none tracking-tight tabular-nums">9:41</span>
              <span className="mt-2 text-[12px] uppercase tracking-[0.25em] text-white/60">Sunday · October 18</span>
            </div>
          </LookCard>
          <LookCard title="Video Loops" blurb="Silent clips from your trips and celebrations, on repeat.">
            {img(14, 800, 500)}
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25"><div className="h-full w-2/5 bg-white" /></div>
          </LookCard>
        </div>
        <p className="mt-6 text-center text-[15px] text-label-2">Plus Verse of the Day, Vinyl and Cover Flow for Spotify, a Flip Board, and more.</p>
      </section>

      {/* ── How it works ── */}
      <section className="bg-cell py-20">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-center text-[clamp(32px,5vw,52px)] font-bold tracking-[-0.03em]">Set up in three steps.</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              { icon: <UserCirclePlus size={30} weight="fill" />, t: 'Make an account', b: 'Free. Just your name, email and a password.' },
              { icon: <GoogleDriveLogo size={30} weight="fill" />, t: 'Add a Drive folder', b: 'Paste a Google Drive folder link. Your photos stay in your Drive.' },
              { icon: <MonitorPlay size={30} weight="fill" />, t: 'Pick your screen', b: 'Set it as your Mac screensaver, or open it on a TV or iPad.' },
            ].map((s, n) => (
              <motion.div
                key={s.t}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: n * 0.1, ease }}
                className="text-center"
              >
                <span className="bg-ember mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] text-white shadow-lg">{s.icon}</span>
                <p className="mt-2 text-[13px] font-bold uppercase tracking-wider text-tint">Step {n + 1}</p>
                <h3 className="mt-1 text-[22px] font-bold tracking-tight">{s.t}</h3>
                <p className="mx-auto mt-2 max-w-xs text-[16px] leading-relaxed text-label-2">{s.b}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Any screen ── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-[clamp(32px,5vw,52px)] font-bold leading-[1.05] tracking-[-0.03em]">Your laptop doesn’t have to stay on.</h2>
            <p className="mt-4 text-[18px] leading-relaxed text-label-2">
              The Mac screensaver is just one way in. Open Mantel in a smart TV’s browser, on an old iPad on the shelf, or on any
              monitor. Each screen shows the same memories, and you control them all from your phone.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { i: <Television size={28} weight="fill" />, t: 'Smart TVs', c: 'bg-[#0a84ff]' },
                { i: <DeviceTabletSpeaker size={28} weight="fill" />, t: 'iPads', c: 'bg-[#30b94d]' },
                { i: <Globe size={28} weight="bold" />, t: 'Any browser', c: 'bg-[#5856d6]' },
              ].map((d) => (
                <div key={d.t} className="rounded-[18px] bg-cell p-4 text-center shadow-cell">
                  <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-[13px] text-white ${d.c}`}>{d.i}</span>
                  <p className="mt-2 text-[15px] font-semibold">{d.t}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mx-auto aspect-[16/10] w-full max-w-xl">
            <div className="absolute inset-[0_8%_14%_0] overflow-hidden rounded-[14px] border-[10px] border-[#111] shadow-2xl">{img(6, 900, 560)}</div>
            <div className="absolute bottom-0 right-0 w-[38%] overflow-hidden rounded-[18px] border-[8px] border-[#111] shadow-2xl">
              <div className="aspect-[3/4]">{img(13, 400, 530)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Private ── */}
      <section className="bg-cell py-20">
        <div className="mx-auto grid max-w-5xl gap-6 px-5 sm:grid-cols-3">
          {[
            { i: <ShieldCheck size={26} weight="fill" />, t: 'Your photos stay yours', b: 'Photos are shown straight from your own Google Drive. We don’t copy them, sell them or train on them.' },
            { i: <Key size={26} weight="fill" />, t: 'You hold the key', b: 'A recovery key you save yourself means no one, not even us, can reset your account but you.' },
            { i: <Lightning size={26} weight="fill" />, t: 'Light on your Mac', b: 'The screensaver only runs while your Mac is idle, and pauses when you’re back.' },
          ].map((f) => (
            <div key={f.t} className="rounded-[22px] bg-grouped p-6">
              <span className="text-tint">{f.i}</span>
              <h3 className="mt-3 text-[19px] font-bold tracking-tight">{f.t}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-label-2">{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Download CTA ── */}
      <section className="mx-auto max-w-3xl px-5 py-24 text-center">
        <BrandMark size={84} className="mx-auto rounded-[20px] shadow-xl" />
        <h2 className="mt-6 text-[clamp(32px,5vw,52px)] font-bold tracking-[-0.03em]">Put it on the Mantel.</h2>
        <p className="mx-auto mt-3 max-w-lg text-[18px] text-label-2">
          One download. The app sets up the screensaver for you and walks you through every step.
        </p>
        <Link href="/download" className="pressable bg-ember mt-8 inline-flex h-[58px] items-center justify-center gap-2 rounded-[18px] px-8 text-[18px] font-semibold text-white shadow-[0_10px_30px_-10px_var(--m-tint)]">
          <DownloadSimple size={22} weight="bold" /> Download for Mac
        </Link>
        <p className="mx-auto mt-5 max-w-md text-[13px] leading-relaxed text-label-2">
          Mantel isn’t on the Mac App Store yet, so macOS will ask you to confirm before opening it the first time. That’s normal, and{' '}
          <Link href="/help#mac" className="font-semibold text-tint">here’s exactly what to click</Link>.
        </p>
      </section>

      <footer className="border-t border-separator">
        <div className="mx-auto max-w-6xl px-5 py-8 text-[13px] text-label-2">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-2 font-semibold text-label"><BrandMark size={20} className="rounded-[5px]" /> Mantel</span>
            <Link href="/help">Help</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Create account</Link>
          </div>
          <p className="mt-4 leading-relaxed text-label-3">
            Sample photos from{' '}
            <a href={`https://unsplash.com/${UNSPLASH_REF}`} className="underline">Unsplash</a> by{' '}
            {SHOWCASE.map((p, n) => (
              <span key={p.id}>
                <a href={`https://unsplash.com/@${p.user}${UNSPLASH_REF}`} className="underline">{p.by}</a>
                {n < SHOWCASE.length - 1 ? ', ' : '.'}
              </span>
            ))}
          </p>
        </div>
      </footer>
    </div>
  );
}
