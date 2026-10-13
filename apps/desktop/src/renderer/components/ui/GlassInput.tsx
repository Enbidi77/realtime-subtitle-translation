import React from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

export interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClear?: () => void;
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ leftIcon, rightIcon, onClear, value, className, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <span className="absolute left-3 text-muted-foreground pointer-events-none flex items-center justify-center">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          value={value}
          className={clsx(
            'glass-input w-full py-2 text-xs placeholder:text-muted-foreground/70 app-no-drag transition-all',
            leftIcon ? 'pl-9' : 'pl-3.5',
            rightIcon || onClear ? 'pr-9' : 'pr-3.5',
            className
          )}
          {...props}
        />
        {onClear && value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2.5 p-1 rounded-full cursor-pointer app-no-drag text-muted-foreground hover:text-foreground hover:bg-glass-subtle transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {!onClear && rightIcon && (
          <span className="absolute right-3 text-muted-foreground pointer-events-none flex items-center justify-center">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';

