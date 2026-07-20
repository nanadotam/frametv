'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tv, Images, LayoutGrid, Settings, Home, Radio, LogOut, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';

const NAV = [
  { href: '/admin',           label: 'Remote',    icon: Home },
  { href: '/admin/albums',    label: 'Albums',    icon: Images },
  { href: '/admin/music',     label: 'Music',     icon: Music2 },
  { href: '/admin/modes',     label: 'Modes',     icon: LayoutGrid },
  { href: '/admin/settings',  label: 'Settings',  icon: Settings },
];

const SECONDARY_NAV = [
  { href: '/admin/flipboard', label: 'FlipBoard', icon: Radio },
  { href: '/admin/schedule',  label: 'Schedule',  icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
              <Tv size={15} className="text-white" />
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
                      ? 'bg-gradient-to-r from-emerald-500/22 to-sky-500/14 text-emerald-50 ring-1 ring-emerald-400/25 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}

            <div className="pt-3 mt-3 border-t border-border/70">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                More
              </p>
              {SECONDARY_NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    pathname.startsWith(href)
                      ? 'bg-gradient-to-r from-emerald-500/22 to-sky-500/14 text-emerald-50 ring-1 ring-emerald-400/25 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Icon size={16} className="opacity-75" />
                  {label}
                </Link>
              ))}
            </div>
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
            <button
              type="button"
              onClick={logout}
              className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <LogOut size={13} />
              Log out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>

        {/* Bottom nav — mobile (5 items, icon + label) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur border-t border-border flex">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                  active ? 'text-emerald-300' : 'text-muted-foreground'
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </TooltipProvider>
  );
}
