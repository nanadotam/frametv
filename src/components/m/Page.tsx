'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/**
 * iOS-style page: a large title that collapses into a compact, blurred
 * navigation bar once you scroll past it.
 */
export function Page({
  title,
  subtitle,
  back,
  actions,
  children,
  className,
  wide = false,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-full">
      <header
        className={cn(
          'sticky top-0 z-30 safe-top transition-colors duration-200',
          collapsed ? 'bg-glass backdrop-blur-xl backdrop-saturate-150 border-b border-separator' : 'border-b border-transparent'
        )}
      >
        <div className={cn('mx-auto flex h-12 items-center gap-2 px-4', wide ? 'max-w-5xl' : 'max-w-2xl')}>
          <div className="flex min-w-0 flex-1 items-center">
            {back && (
              <Link href={back.href} className="pressable -ml-2 flex items-center gap-0.5 rounded-lg px-1 py-1 text-[17px] text-tint">
                <CaretLeft size={22} weight="bold" />
                <span className="truncate">{back.label}</span>
              </Link>
            )}
          </div>
          <p
            className={cn(
              'pointer-events-none absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold transition-opacity duration-200',
              collapsed ? 'opacity-100' : 'opacity-0'
            )}
          >
            {title}
          </p>
          <div className="flex flex-1 items-center justify-end gap-1">{actions}</div>
        </div>
      </header>

      <div className={cn('mx-auto px-4 pb-28 md:pb-12', wide ? 'max-w-5xl' : 'max-w-2xl', className)}>
        <div className="pb-4 pt-1">
          <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em]">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-label-2">{subtitle}</p>}
        </div>
        <div ref={sentinel} className="h-px" aria-hidden />
        <div className="space-y-7">{children}</div>
      </div>
    </div>
  );
}
