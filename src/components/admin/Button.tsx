'use client';

import { forwardRef, useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface RippleItem {
  id: number;
  x: number;
  y: number;
  size: number;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
  primary: 'bg-accent text-bg hover:bg-accent-hover font-semibold',
  secondary: 'border border-fg/20 text-fg bg-transparent hover:bg-fg/5',
  danger: 'bg-danger text-white hover:bg-red-600 font-semibold',
  ghost: 'text-fg/70 hover:text-fg hover:bg-fg/5',
};

const sizeClasses: Record<string, string> = {
  sm: 'h-10 px-3 text-sm min-w-[48px]',
  md: 'h-12 px-4 text-sm min-w-[48px]',
  lg: 'h-14 px-6 text-base min-w-[48px]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, loading, onClick, disabled, ...props }, ref) => {
    const [ripples, setRipples] = useState<RippleItem[]>([]);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const sz = Math.max(rect.width, rect.height) * 2;
        const x = e.clientX - rect.left - sz / 2;
        const y = e.clientY - rect.top - sz / 2;
        const id = Date.now() + Math.random();
        setRipples((prev) => [...prev, { id, x, y, size: sz }]);
        setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
        onClick?.(e);
      },
      [onClick]
    );

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        onClick={handleClick}
        className={cn(
          'relative overflow-hidden rounded-xl inline-flex items-center justify-center gap-2 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {ripples.map((r) => (
          <span
            key={r.id}
            className="pointer-events-none absolute rounded-full bg-white/20 animate-ripple"
            style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
          />
        ))}
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export default Button;
