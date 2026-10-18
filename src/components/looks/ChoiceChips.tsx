'use client';

import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Drop-in stand-in for the shadcn Select API (Select / SelectTrigger /
 * SelectValue / SelectContent / SelectItem) that renders every option as a
 * tappable chip instead of a dropdown: everything is visible at once, it's
 * one tap to change, and it can't fight a surrounding dialog for focus.
 */

type ItemProps = { value: string; children: ReactNode };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SelectItem(_: ItemProps) {
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SelectTrigger(_: { children?: ReactNode; className?: string }) {
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SelectValue(_: { placeholder?: string }) {
  return null;
}
export function SelectContent({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function collectItems(node: ReactNode, out: ItemProps[] = []) {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ children?: ReactNode } & Partial<ItemProps>>;
    if (el.type === SelectItem) out.push({ value: String(el.props.value), children: el.props.children });
    else if (el.props.children) collectItems(el.props.children, out);
  });
  return out;
}

export function Select({
  value,
  onValueChange,
  children,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}) {
  const items = collectItems(children);
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onValueChange?.(it.value)}
            className={cn(
              'pressable h-9 rounded-full px-3.5 text-[14px] font-medium transition-colors',
              active ? 'bg-tint text-white' : 'bg-fill text-label hover:bg-fill-2'
            )}
          >
            {it.children}
          </button>
        );
      })}
    </div>
  );
}
