import React from 'react';
import clsx from 'clsx';

export type GlassBadgeVariant =
  | 'live'
  | 'accent'
  | 'neutral'
  | 'warning'
  | 'destructive'
  | 'success';

export interface GlassBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: GlassBadgeVariant;
  pulse?: boolean;
}

export const GlassBadge: React.FC<GlassBadgeProps> = ({
  variant = 'neutral',
  pulse = false,
  className,
  children,
  ...props
}) => {
  const variantStyles: Record<GlassBadgeVariant, string> = {
    live: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    accent: 'bg-primary/15 text-primary border border-primary/30',
    neutral: 'bg-glass-subtle text-muted-foreground border border-glass-border',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    destructive: 'bg-destructive/15 text-destructive border border-destructive/30',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium backdrop-blur-md shadow-xs select-none',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}
      {children}
    </span>
  );
};

