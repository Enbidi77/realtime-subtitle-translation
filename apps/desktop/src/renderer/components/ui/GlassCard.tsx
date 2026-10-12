import React from 'react';
import clsx from 'clsx';

export type GlassCardVariant = 'default' | 'elevated' | 'subtle' | 'interactive';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassCardVariant;
  glow?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ variant = 'default', glow = false, className, children, ...props }, ref) => {
    const variantClasses = {
      default: 'glass-panel',
      elevated: 'glass-panel-elevated',
      subtle: 'glass-panel-subtle',
      interactive:
        'glass-panel hover:border-glass-border-elevated hover:shadow-glass-elevated hover:-translate-y-0.5 cursor-pointer transition-all duration-200',
    };

    return (
      <div
        ref={ref}
        className={clsx(
          variantClasses[variant],
          glow && 'shadow-glass-glow',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

