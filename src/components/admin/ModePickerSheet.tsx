'use client';

import type { ComponentType } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MODE_CATEGORIES } from '@/lib/modeMetadata';

type ModeMeta = {
  id: string;
  label: string;
  category: string;
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
};

// Same grid, same tone system as before — only where it renders changed
// (permanent page real estate -> on-demand sheet). Bottom sheet on mobile,
// centered dialog on desktop, via responsive utility overrides on the
// Radix primitives directly (Modal's fixed layout doesn't flex this far).
export default function ModePickerSheet({
  open,
  onOpenChange,
  modes,
  activeModeId,
  pendingModeId,
  loading,
  onSelectMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modes: ModeMeta[];
  activeModeId: string | null | undefined;
  pendingModeId: string | null;
  loading: boolean;
  onSelectMode: (modeId: string) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed z-50 bg-bg-card border border-fg/10 shadow-2xl flex flex-col',
            // Mobile: bottom sheet
            'inset-x-0 bottom-0 top-auto max-h-[85vh] rounded-t-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            // Desktop: centered dialog
            'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:bottom-auto',
            'sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:max-h-[80vh] sm:rounded-2xl',
            'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95'
          )}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-fg/10 shrink-0">
            <Dialog.Title className="text-base font-semibold">Change mode</Dialog.Title>
            <Dialog.Close asChild>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/10 transition-colors">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto px-5 py-5 space-y-5">
            {MODE_CATEGORIES.map((category) => {
              const CategoryIcon = category.icon;
              const categoryModes = modes.filter((mode) => mode.category === category.id);
              if (categoryModes.length === 0) return null;
              return (
                <div key={category.id} className="space-y-2.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className={cn('flex size-7 items-center justify-center rounded-lg border', category.tone.iconBg, category.tone.iconBorder)}>
                      <CategoryIcon size={14} className={category.tone.text} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{category.label}</p>
                      <p className="text-[11px] text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {categoryModes.map((m) => {
                      const active = activeModeId === m.id;
                      const pending = pendingModeId === m.id;
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          onClick={() => onSelectMode(m.id)}
                          disabled={loading && !pending}
                          className={cn(
                            'flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all cursor-pointer',
                            'hover:scale-[1.03] active:scale-[0.97]',
                            active
                              ? cn(category.tone.active, 'shadow-md ring-2')
                              : cn('bg-card border-border text-muted-foreground hover:text-foreground', category.tone.hover)
                          )}
                        >
                          <span className={cn('flex size-10 items-center justify-center rounded-xl border', active ? 'border-current/25 bg-white/10' : cn(category.tone.iconBg, category.tone.iconBorder, category.tone.text))}>
                            <Icon size={22} strokeWidth={active ? 2.6 : 2} />
                          </span>
                          <span className="leading-tight text-center">{m.label}</span>
                          {pending
                            ? <Loader2 size={12} className="animate-spin" />
                            : active && <span className="w-1.5 h-1.5 rounded-full bg-current/80" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
