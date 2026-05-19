'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tv, Images, CalendarDays, LayoutGrid, Settings, Home, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';

const NAV = [
  { href: '/admin',            label: 'Now Playing', icon: Home },
  { href: '/admin/albums',     label: 'Albums',      icon: Images },
  { href: '/admin/schedule',   label: 'Schedule',    icon: CalendarDays },
  { href: '/admin/modes',      label: 'Modes',       icon: LayoutGrid },
  { href: '/admin/reminders',  label: 'Reminders',   icon: BellRing },
  { href: '/admin/settings',   label: 'System',      icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Tv size={15} className="text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none tracking-tight">FrameTV</p>
              <p className="text-xs text-muted-foreground mt-0.5">Admin Panel</p>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <Separator />
          <div className="p-3">
            <Link
              href="/display"
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-dashed border-border"
            >
              <Tv size={13} />
              Open Display ↗
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>

        {/* Bottom nav — mobile */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur border-t border-border flex">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-3 text-[9px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </TooltipProvider>
  );
}
