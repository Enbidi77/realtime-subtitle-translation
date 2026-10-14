import React from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

export type GlassSelectSize = 'xs' | 'sm' | 'md';

export interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  leftIcon?: React.ReactNode;
  size?: GlassSelectSize;
  containerClassName?: string;
}

export const GlassSelect = React.forwardRef<HTMLSelectElement, GlassSelectProps>(
  (
    {
      leftIcon,
      size = 'md',
      containerClassName,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeStyles: Record<GlassSelectSize, string> = {
      xs: 'py-1 text-xs rounded-lg',
      sm: 'py-1.5 text-xs rounded-lg',
      md: 'py-2 text-xs rounded-xl',
    };

    const paddingRight: Record<GlassSelectSize, string> = {
      xs: 'pr-6',
      sm: 'pr-7',
      md: 'pr-9',
    };

    const paddingLeft: Record<GlassSelectSize, string> = {
      xs: leftIcon ? 'pl-7' : 'pl-2.5',
      sm: leftIcon ? 'pl-8' : 'pl-3',
      md: leftIcon ? 'pl-9' : 'pl-3.5',
    };

    const chevronStyles: Record<GlassSelectSize, { iconSize: string; position: string }> = {
      xs: { iconSize: 'w-3 h-3', position: 'right-2' },
      sm: { iconSize: 'w-3 h-3', position: 'right-2.5' },
      md: { iconSize: 'w-3.5 h-3.5', position: 'right-3' },
    };

    return (
      <div className={clsx('relative flex items-center', containerClassName || 'w-full')}>
        {leftIcon && (
          <span className="absolute left-2.5 text-muted-foreground pointer-events-none flex items-center justify-center">
            {leftIcon}
          </span>
        )}
        <select
          ref={ref}
          disabled={disabled}
          className={clsx(
            'glass-input w-full appearance-none font-medium cursor-pointer app-no-drag disabled:cursor-not-allowed disabled:opacity-50 transition-all',
            sizeStyles[size],
            paddingLeft[size],
            paddingRight[size],
            className
          )}
          {...props}
        >
          {children}
        </select>
        <span
          className={clsx(
            'absolute text-muted-foreground pointer-events-none flex items-center justify-center',
            chevronStyles[size].position
          )}
        >
          <ChevronDown className={chevronStyles[size].iconSize} />
        </span>
      </div>
    );
  }
);

GlassSelect.displayName = 'GlassSelect';

