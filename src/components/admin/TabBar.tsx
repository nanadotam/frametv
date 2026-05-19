'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Image, Calendar, Layout, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Now Playing', href: '/admin', icon: Home },
  { label: 'Albums', href: '/admin/albums', icon: Image },
  { label: 'Schedule', href: '/admin/schedule', icon: Calendar },
  { label: 'Modes', href: '/admin/modes', icon: Layout },
  { label: 'System', href: '/admin/settings', icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  return pathname.startsWith(href);
}

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-bg-card border-t border-fg/10 md:hidden">
      <div className="flex items-stretch h-16">
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[48px] transition-colors',
                active ? 'text-accent' : 'text-fg-muted hover:text-fg'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
              {active && <span className="absolute bottom-0 w-10 h-0.5 bg-accent rounded-t-full" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-bg-soft border-r border-fg/10 fixed top-0 left-0 z-40 pt-6">
      <div className="px-4 mb-6">
        <span className="text-lg font-semibold font-display text-fg tracking-tight">FrameTV</span>
        <span className="text-xs text-fg-muted ml-1">Admin</span>
      </div>
      <nav className="flex flex-col gap-1 px-2">
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors min-h-[48px]',
                active
                  ? 'bg-accent/15 text-accent'
                  : 'text-fg-muted hover:text-fg hover:bg-fg/5'
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-sm font-medium">{label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default { BottomTabBar, Sidebar };
