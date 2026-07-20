'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Tv, Settings, Monitor, Zap, Images, LayoutGrid, CalendarDays, LogOut } from 'lucide-react';

export default function Home() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then((res) => {
      setIsSignedIn(res.ok);
    }).catch(() => {
      setIsSignedIn(false);
    });
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
            <Tv size={18} className="text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-lg leading-none tracking-tight">FrameTV</p>
            <p className="text-xs text-muted-foreground mt-0.5">Choose a view</p>
          </div>
        </div>
        {isSignedIn ? (
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        ) : null}
      </header>

      {/* Two-card hub */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-4xl">

          {/* Admin Panel Card */}
          <Link href="/admin" className="group block">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-10 min-h-[340px] flex flex-col justify-between transition-all duration-300 hover:scale-[1.025] hover:shadow-2xl hover:shadow-primary/15 hover:border-primary/40 active:scale-[0.985] cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none rounded-3xl" />

              <div className="relative">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:scale-110">
                    <Settings size={28} className="text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold tracking-tight">Admin Panel</p>
                    <p className="text-base text-muted-foreground mt-0.5">Control your display</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { icon: Zap,          label: 'Remote' },
                    { icon: Images,       label: 'Albums' },
                    { icon: LayoutGrid,   label: 'Modes' },
                    { icon: CalendarDays, label: 'Schedule' },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2.5 bg-background/70 rounded-xl px-4 py-3 border border-border/60 transition-colors group-hover:border-primary/20"
                    >
                      <Icon size={15} className="text-primary shrink-0" />
                      <span className="text-sm font-semibold">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mt-8 flex items-center gap-2 text-primary font-bold text-xl transition-all group-hover:gap-3">
                Open Admin
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </div>
            </div>
          </Link>

          {/* Display Card */}
          <Link href="/display" target="_blank" className="group block">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 text-white p-8 md:p-10 min-h-[340px] flex flex-col justify-between transition-all duration-300 hover:scale-[1.025] hover:shadow-2xl hover:shadow-violet-500/20 hover:border-violet-500/30 active:scale-[0.985] cursor-pointer">
              {/* Cinematic gradients */}
              <div className="absolute inset-0 bg-gradient-to-br from-violet-900/25 via-transparent to-pink-900/15 pointer-events-none rounded-3xl" />
              <div className="absolute -top-20 -right-20 w-72 h-72 bg-violet-600/12 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-pink-600/8 rounded-full blur-3xl pointer-events-none" />

              <div className="relative">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-lg shadow-violet-500/30 transition-transform duration-300 group-hover:scale-110">
                    <Monitor size={28} className="text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold tracking-tight">Display</p>
                    <p className="text-base text-white/50 mt-0.5">TV &amp; fullscreen view</p>
                  </div>
                </div>

                <div className="space-y-0">
                  <p className="text-6xl md:text-7xl font-black tracking-tighter text-white/90 leading-none">Now</p>
                  <p className="text-6xl md:text-7xl font-black tracking-tighter text-white/20 leading-none">Playing</p>
                </div>
              </div>

              <div className="relative mt-8 flex items-center gap-3 text-violet-300 font-bold text-xl transition-all group-hover:gap-4">
                <span className="transition-all duration-300">Open Display</span>
                <span className="text-white/40">↗</span>
                <span className="ml-auto text-xs bg-white/10 rounded-full px-3 py-1 text-white/40 font-medium tracking-wide">
                  NEW TAB
                </span>
              </div>
            </div>
          </Link>

        </div>
      </div>
    </main>
  );
}
