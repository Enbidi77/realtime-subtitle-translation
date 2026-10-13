import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export type GlassButtonVariant = 'primary' | 'glass' | 'subtle' | 'destructive' | 'ghost';
export type GlassButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      variant = 'glass',
      size = 'md',
      isLoading = false,
      icon,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-xl select-none transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] cursor-pointer app-no-drag';

    const variantStyles: Record<GlassButtonVariant, string> = {
      primary:
        'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-primary/25 border border-white/20 hover:brightness-110 active:brightness-95',
      glass:
        'glass-button text-foreground hover:bg-glass hover:border-glass-border-elevated',
      subtle:
        'bg-glass-subtle text-foreground/80 hover:text-foreground hover:bg-glass hover:border-glass-border border border-transparent',
      destructive:
        'bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 hover:border-destructive/50',
      ghost:
        'text-muted-foreground hover:text-foreground hover:bg-glass-subtle border border-transparent',
    };

    const sizeStyles: Record<GlassButtonSize, string> = {
      xs: 'text-[11px] px-2.5 py-1 gap-1.5 rounded-lg',
      sm: 'text-xs px-3 py-1.5 gap-2 rounded-lg',
      md: 'text-xs px-4 py-2 gap-2 rounded-xl',
      lg: 'text-sm px-5 py-2.5 gap-2.5 rounded-xl',
      icon: 'w-9 h-9 p-0 rounded-xl',
      'icon-sm': 'w-7 h-7 p-0 rounded-lg',
    };

    return (
      <button
        ref={ref}
        type={props.type || 'button'}
        disabled={disabled || isLoading}
        className={clsx(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          icon && <span className="flex-shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

GlassButton.displayName = 'GlassButton';

