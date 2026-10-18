'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/**
 * Bottom sheet on phones, centred card on wider screens. Built on Radix
 * Dialog so focus trapping, Escape and scroll-lock come for free.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex max-h-[92dvh] flex-col bg-grouped text-label shadow-2xl outline-none',
            'inset-x-0 bottom-0 rounded-t-[22px] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px] sm:data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:zoom-in-95',
            size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
          )}
        >
          <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-fill-2 sm:hidden" aria-hidden />
          <div className="flex items-start gap-3 px-5 pb-3 pt-3 sm:pt-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-[20px] font-bold tracking-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[15px] text-label-2">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="pressable flex h-[30px] w-[30px] items-center justify-center rounded-full bg-fill text-label-2"
              aria-label="Close"
            >
              <X size={15} weight="bold" />
            </Dialog.Close>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">{children}</div>
          {footer && <div className="border-t border-separator px-4 py-3 safe-bottom">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
