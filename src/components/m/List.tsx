'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CaretRight, CircleNotch } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/** Inset grouped section (Settings.app style). */
export function Section({
  header,
  footer,
  children,
  className,
  plain = false,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No card background — for grids and custom content. */
  plain?: boolean;
}) {
  return (
    <section className={className}>
      {header && (
        <h2 className="mb-1.5 px-4 text-[13px] font-medium uppercase tracking-wide text-label-2">{header}</h2>
      )}
      <div className={cn(!plain && 'overflow-hidden rounded-[14px] bg-cell shadow-cell divide-y divide-separator [&>*]:border-separator')}>
        {children}
      </div>
      {footer && <p className="mt-1.5 px-4 text-[13px] leading-snug text-label-2">{footer}</p>}
    </section>
  );
}

const TILE_TONES = {
  ember: 'bg-ember',
  blue: 'bg-[#0a84ff]',
  green: 'bg-[#30b94d]',
  purple: 'bg-[#af52de]',
  pink: 'bg-[#ff2d55]',
  orange: 'bg-[#ff9500]',
  teal: 'bg-[#30b0c7]',
  indigo: 'bg-[#5856d6]',
  gray: 'bg-[#8e8e93]',
  red: 'bg-[#ff3b30]',
  yellow: 'bg-[#ffcc00]',
} as const;

export type TileTone = keyof typeof TILE_TONES;

/** Rounded-square coloured icon, like the ones in iOS Settings. */
export function IconTile({ tone = 'ember', size = 30, children }: { tone?: TileTone; size?: number; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]',
        TILE_TONES[tone]
      )}
      style={{ width: size, height: size, borderRadius: size * 0.27 }}
    >
      {children}
    </span>
  );
}

/** One row in a Section. Becomes a link or button when given href/onClick. */
export function Row({
  icon,
  title,
  subtitle,
  detail,
  trailing,
  href,
  external,
  onClick,
  chevron,
  destructive,
  tint,
  loading,
  disabled,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  tint?: boolean;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const interactive = !!(href || onClick);
  const showChevron = chevron ?? (!!href && !external);
  const body = (
    <>
      {icon}
      <div className="min-w-0 flex-1 py-[11px]">
        <p
          className={cn(
            'truncate text-[17px] leading-[22px]',
            destructive && 'text-bad',
            tint && 'text-tint'
          )}
        >
          {title}
        </p>
        {subtitle && <p className="mt-0.5 text-[13px] leading-[18px] text-label-2">{subtitle}</p>}
      </div>
      {detail !== undefined && <span className="max-w-[45%] truncate text-[17px] text-label-2">{detail}</span>}
      {loading && <CircleNotch size={18} className="animate-spin text-label-2" />}
      {trailing}
      {showChevron && <CaretRight size={14} weight="bold" className="shrink-0 text-label-3" />}
    </>
  );

  const cls = cn(
    'flex min-h-[44px] w-full items-center gap-3 px-4 text-left',
    interactive && 'transition-colors active:bg-fill',
    disabled && 'pointer-events-none opacity-50',
    className
  );

  if (href) {
    return external ? (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>{body}</a>
    ) : (
      <Link href={href} className={cls}>{body}</Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** iOS switch. */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50',
        checked ? 'bg-ok' : 'bg-fill-2'
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)] transition-transform duration-200',
          checked && 'translate-x-[20px]'
        )}
      />
    </button>
  );
}

/** Row with a switch on the right. */
export function ToggleRow({
  icon,
  title,
  subtitle,
  checked,
  onChange,
  disabled,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Row
      icon={icon}
      title={title}
      subtitle={subtitle}
      trailing={<Toggle checked={checked} onChange={onChange} disabled={disabled} label={typeof title === 'string' ? title : undefined} />}
    />
  );
}
