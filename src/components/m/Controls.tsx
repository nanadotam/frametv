'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'filled' | 'tinted' | 'gray' | 'plain' | 'destructive';
type ButtonSize = 'xl' | 'lg' | 'md' | 'sm';

const VARIANTS: Record<ButtonVariant, string> = {
  filled: 'bg-ember text-white shadow-[0_6px_20px_-6px_var(--m-tint)]',
  tinted: 'bg-tint/15 text-tint',
  gray: 'bg-fill text-label',
  plain: 'text-tint',
  destructive: 'bg-bad/12 text-bad',
};

const SIZES: Record<ButtonSize, string> = {
  xl: 'h-[58px] rounded-[18px] px-6 text-[18px] font-semibold',
  lg: 'h-[50px] rounded-[14px] px-5 text-[17px] font-semibold',
  md: 'h-[40px] rounded-[12px] px-4 text-[15px] font-semibold',
  sm: 'h-[30px] rounded-full px-3 text-[13px] font-semibold',
};

/** Big, obvious buttons (Shazam/Apple style). */
export function Button({
  variant = 'filled',
  size = 'lg',
  block,
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'pressable inline-flex select-none items-center justify-center gap-2 whitespace-nowrap disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className
      )}
    >
      {loading ? <CircleNotch size={18} weight="bold" className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** Round icon-only button (transport controls, toolbar actions). */
export function IconButton({
  label,
  size = 44,
  variant = 'gray',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: number; variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn('pressable inline-flex shrink-0 items-center justify-center rounded-full disabled:opacity-45', VARIANTS[variant], className)}
      style={{ width: size, height: size }}
    >
      {children}
    </button>
  );
}

/** Segmented control. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex rounded-[9px] bg-fill p-[2px]', className)} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-[7px] px-2 py-[6px] text-[13px] font-semibold transition-all',
              active ? 'bg-elevated text-label shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]' : 'text-label'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Grouped text field — sits inside a Section like an iOS form cell. */
export function Field({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="flex min-h-[44px] items-center gap-3 px-4">
      {label && <span className="w-28 shrink-0 text-[17px]">{label}</span>}
      <input
        {...rest}
        className={cn(
          'min-w-0 flex-1 bg-transparent py-[11px] text-[17px] text-label outline-none placeholder:text-label-3',
          className
        )}
      />
    </label>
  );
}

/** Stand-alone large text input (auth screens). */
export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        'h-[52px] w-full rounded-[14px] bg-fill px-4 text-[17px] text-label outline-none ring-tint/60 transition-shadow placeholder:text-label-3 focus:ring-2',
        className
      )}
    />
  );
}

/** Small capsule chip, selectable. */
export function Chip({
  selected,
  onClick,
  children,
  loading,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'pressable inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-medium transition-colors',
        selected ? 'bg-tint text-white' : 'bg-fill text-label'
      )}
    >
      {loading && <CircleNotch size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

/** Teaching empty state. */
export function Empty({
  art,
  title,
  body,
  action,
}: {
  art: ReactNode;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-5">{art}</div>
      <h3 className="text-[22px] font-bold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-label-2">{body}</p>
      {action && <div className="mt-6 w-full max-w-xs">{action}</div>}
    </div>
  );
}
