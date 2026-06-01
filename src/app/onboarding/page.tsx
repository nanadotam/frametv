'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock3, Hash, Monitor, Music2, Settings, Smartphone, Zap } from 'lucide-react';

const TOTAL = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('frametv:onboarded')) {
      router.replace('/');
      return;
    }
    setReady(true);
  }, [router]);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const finish = () => {
    localStorage.setItem('frametv:onboarded', '1');
    router.replace('/');
  };

  if (!ready) return null;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 64 : -64, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -64 : 64, opacity: 0 }),
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Progress dots */}
      <div className="flex gap-2 mb-10">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? 24 : 8,
              height: 8,
              background: i <= step ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
              opacity: i < step ? 0.5 : 1,
            }}
          />
        ))}
      </div>

      {/* Step panel */}
      <div className="w-full max-w-lg" style={{ minHeight: 440 }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            {step === 0 && <StepWelcome />}
            {step === 1 && <StepTwoViews />}
            {step === 2 && <StepDrive />}
            {step === 3 && <StepTips />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-5 mt-10">
        {step > 0 && (
          <button
            type="button"
            onClick={() => go(step - 1)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
        )}
        <button
          type="button"
          onClick={step < TOTAL - 1 ? () => go(step + 1) : finish}
          className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-base transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}
        >
          {step === TOTAL - 1 ? "Let's go →" : 'Next'}
        </button>
      </div>

      {step < TOTAL - 1 && (
        <button
          type="button"
          onClick={finish}
          className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      )}
    </main>
  );
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="flex flex-col items-center text-center gap-7">
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
          boxShadow: '0 16px 48px rgba(99,102,241,0.4)',
        }}
      >
        📺
      </div>
      <div className="space-y-3">
        <h1 className="text-4xl font-black tracking-tight">Welcome to FrameTV</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Your personal smart display for photos, music, and more.
        </p>
        <p className="text-sm text-muted-foreground/60">
          Let&apos;s take 60 seconds to get you set up.
        </p>
      </div>
    </div>
  );
}

// ─── Step 1: Two views ────────────────────────────────────────────────────────

function StepTwoViews() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black tracking-tight">Two sides to FrameTV</h2>
        <p className="text-muted-foreground">One for you, one for your TV.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Admin card */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.08) 0%, transparent 70%)' }}
          />
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'hsl(var(--primary))', boxShadow: '0 4px 16px hsl(var(--primary)/0.3)' }}
          >
            <Settings size={22} className="text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm">Admin Panel</p>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              Control your display from any phone or browser
            </p>
          </div>
        </div>

        {/* Display card */}
        <div
          className="relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 text-white"
          style={{
            background: '#09090b',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.25) 0%, rgba(219,39,119,0.12) 100%)' }}
          />
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}
          >
            <Monitor size={22} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">Display</p>
            <p className="text-xs mt-1 leading-snug" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Full-screen on your TV, always on
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center px-2 leading-relaxed">
        Bookmark the display URL on your TV browser and leave it open. Use the Admin Panel from your phone to control everything.
      </p>
    </div>
  );
}

// ─── Step 2: Drive ────────────────────────────────────────────────────────────

function StepDrive() {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center space-y-2">
        <div className="text-5xl">📁</div>
        <h2 className="text-3xl font-black tracking-tight">Add photos from Drive</h2>
        <p className="text-sm text-muted-foreground">
          FrameTV syncs directly from your Google Drive folders.
        </p>
      </div>

      <ol className="space-y-3">
        {[
          'Open Google Drive and find a folder with your photos.',
          'Right-click the folder → Share → "Anyone with the link" → View only.',
          'Copy the share link.',
          'In FrameTV → Albums → "Add Drive folder" → paste the link.',
        ].map((text, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="w-7 h-7 rounded-xl flex items-center justify-center text-sm font-black shrink-0 mt-0.5"
              style={{ background: 'hsl(var(--primary)/0.15)', color: 'hsl(var(--primary))' }}
            >
              {i + 1}
            </span>
            <span className="text-sm text-muted-foreground leading-snug pt-1">{text}</span>
          </li>
        ))}
      </ol>

      <div
        className="rounded-xl px-4 py-3 text-xs leading-relaxed"
        style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.25)',
          color: '#fbbf24',
        }}
      >
        <strong>Important:</strong> The folder must be set to <strong>View only</strong> — &ldquo;Anyone with the link can view.&rdquo; Private folders won&apos;t sync.
      </div>
    </div>
  );
}

// ─── Step 3: Tips ─────────────────────────────────────────────────────────────

function StepTips() {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center space-y-2">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Zap size={30} />
        </div>
        <h2 className="text-3xl font-black tracking-tight">You&apos;re almost ready</h2>
        <p className="text-sm text-muted-foreground">A few things to know before you dive in.</p>
      </div>

      <div className="space-y-2.5">
        {[
          { icon: Hash, text: 'Your display PIN unlocks the TV screen — use it when prompted on the display.' },
          { icon: Music2, text: 'Connect Spotify in Settings to show album art and control music from your phone.' },
          { icon: Clock3, text: 'Enable the clock overlay to show the time and date over your photos.' },
          { icon: Smartphone, text: 'The Remote tab works from any device — bookmark /admin on your phone.' },
        ].map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-start gap-3 rounded-xl px-4 py-3 border border-border bg-card"
          >
            <Icon size={18} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground leading-snug">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
