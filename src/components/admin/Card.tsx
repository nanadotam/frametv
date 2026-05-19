import { cn } from '@/lib/utils';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ title, children, className, padding = true }: CardProps) {
  return (
    <div className={cn('rounded-xl bg-bg-card', padding && 'p-4', className)}>
      {title && (
        <h3 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">{title}</h3>
      )}
      {children}
    </div>
  );
}

export default Card;
