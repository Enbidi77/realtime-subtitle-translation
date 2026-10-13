import React from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

export interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  leftIcon?: React.ReactNode;
}

export const GlassSelect = React.forwardRef<HTMLSelectElement, GlassSelectProps>(
  ({ leftIcon, children, className, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <span className="absolute left-3 text-muted-foreground pointer-events-none flex items-center justify-center">
            {leftIcon}
          </span>
        )}
        <select
          ref={ref}
          disabled={disabled}
          className={clsx(
            'glass-input w-full py-2 pr-9 text-xs appearance-none font-medium cursor-pointer app-no-drag disabled:cursor-not-allowed disabled:opacity-50 transition-all',
            leftIcon ? 'pl-9' : 'pl-3.5',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <span className="absolute right-3 text-muted-foreground pointer-events-none flex items-center justify-center">
          <ChevronDown className="w-3.5 h-3.5" />
        </span>
      </div>
    );
  }
);

GlassSelect.displayName = 'GlassSelect';

