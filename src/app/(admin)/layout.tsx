'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Icon } from '@phosphor-icons/react';
import { PlayCircle, Images, SquaresFour, Devices, GearSix, ArrowSquareOut, MonitorPlay } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import BrandMark from '@/components/BrandMark';
import { Toaster } from '@/components/m/Toast';

// Five tabs, Apple-style: everything else (music, flipboard, schedule,
// reminders) lives inside Looks or Settings rather than crowding the bar.
const TABS: { href: string; label: string; icon: Icon; match: string[] }[] = [
  { href: '/admin', label: 'Now', icon: PlayCircle, match: [] },
  { href: '/admin/albums', label: 'Library', icon: Images, match: ['/admin/albums'] },
  { href: '/admin/modes', label: 'Looks', icon: SquaresFour, match: ['/admin/modes', '/admin/music', '/admin/flipboard', '/admin/reminders'] },
  { href: '/admin/devices', label: 'Devices', icon: Devices, match: ['/admin/devices', '/admin/screensaver'] },
  { href: '/admin/settings', label: 'Settings', icon: GearSix, match: ['/admin/settings', '/admin/schedule', '/admin/help'] },
];

function isActive(pathname: string, tab: (typeof TABS)[number]) {
  if (tab.href === '/admin') return pathname === '/admin';
  return tab.match.some((m) => pathname.startsWith(m));
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <div className="flex h-dvh overflow-hidden bg-grouped text-label">
        {/* Sidebar — iPad / Mac */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-separator bg-cell/60 backdrop-blur-xl md:flex">
          <div className="flex items-center gap-3 px-5 pb-4 pt-6">
            <BrandMark size={36} className="rounded-[9px] shadow-md" />
            <p className="text-[20px] font-bold tracking-tight">Mantel</p>
          </div>
          <nav className="flex-1 space-y-0.5 px-3">
            {TABS.map((tab) => {
              const active = isActive(pathname, tab);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'flex items-center gap-3 rounded-[10px] px-3 py-2 text-[15px] font-medium transition-colors',
                    active ? 'bg-tint text-white' : 'text-label hover:bg-fill'
                  )}
                >
                  <Icon size={22} weight={active ? 'fill' : 'regular'} className={active ? '' : 'text-tint'} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-2 p-3">
            <Link
              href="/admin/screensaver"
              onClick={(e) => {
                // Inside the Mac app, open its guided installer instead.
                if (window.mantel?.isApp) {
                  e.preventDefault();
                  window.mantel.openScreensaverSetup();
                }
              }}
              className="pressable bg-ember flex items-center gap-3 rounded-[12px] px-3 py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_-10px_var(--m-tint)]"
            >
              <MonitorPlay size={22} weight="fill" />
              Set up screensaver
            </Link>
            <Link
              href="/display"
              target="_blank"
              className="flex items-center justify-between rounded-[12px] bg-fill px-3 py-2.5 text-[15px] font-medium hover:bg-fill-2"
            >
              Open display
              <ArrowSquareOut size={18} className="text-label-2" />
            </Link>
          </div>
        </aside>

        <main className="relative flex-1 overflow-y-auto overscroll-contain">{children}</main>

        {/* Tab bar — phones */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-glass backdrop-blur-xl backdrop-saturate-150 safe-bottom md:hidden">
          <div className="flex">
            {TABS.map((tab) => {
              const active = isActive(pathname, tab);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-[2px] pb-1 pt-[7px] text-[10px] font-medium',
                    active ? 'text-tint' : 'text-label-2'
                  )}
                >
                  <Icon size={27} weight={active ? 'fill' : 'regular'} />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
