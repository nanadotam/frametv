'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Single-line, collapsed-by-default section — the "Setup" zone (Quick
// Settings, Devices, Share Link, Status detail) shouldn't compete with
// Transport/Brightness/Mode for space on every visit; each costs one tap
// to open, zero cost when ignored.
export default function AccordionSection({
  icon,
  label,
  meta,
  open,
  onOpenChange,
  children,
  className,
}: {
  icon?: ReactNode;
  label: string;
  meta?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="text-sm font-medium truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {meta}
          {open
            ? <ChevronUp size={14} className="text-muted-foreground" />
            : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </Card>
  );
}
