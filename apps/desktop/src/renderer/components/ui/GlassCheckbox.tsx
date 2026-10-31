import React, { useId, useRef, useEffect, useImperativeHandle } from 'react';
import clsx from 'clsx';
import { Check, Minus } from 'lucide-react';

export type GlassCheckboxVariant = 'default' | 'card' | 'switch';
export type GlassCheckboxSize = 'sm' | 'md' | 'lg';
export type GlassCheckboxColor = 'primary' | 'destructive' | 'amber' | 'emerald';
export type GlassCheckboxCardLayout = 'horizontal' | 'vertical';

export interface GlassCheckboxIndicatorProps {
  checked?: boolean;
  indeterminate?: boolean;
  size?: GlassCheckboxSize;
  color?: GlassCheckboxColor;
  disabled?: boolean;
  variant?: GlassCheckboxVariant;
  className?: string;
  checkClassName?: string;
}

export interface GlassCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  indeterminate?: boolean;
  variant?: GlassCheckboxVariant;
  size?: GlassCheckboxSize;
  color?: GlassCheckboxColor;
  cardLayout?: GlassCheckboxCardLayout;
  containerClassName?: string;
  indicatorClassName?: string;
  checkClassName?: string;
}

/**
 * Visual checkbox indicator with glass styling, smooth checkmark animation,
 * and support for default square, switch pill, and card states.
 */
export const GlassCheckboxIndicator: React.FC<GlassCheckboxIndicatorProps> = ({
  checked = false,
  indeterminate = false,
  size = 'md',
  color = 'primary',
  disabled = false,
  variant = 'default',
  className,
  checkClassName,
}) => {
  const isChecked = checked || indeterminate;

  // --- SWITCH VARIANT INDICATOR ---
  if (variant === 'switch') {
    const switchSizes: Record<
      GlassCheckboxSize,
      { track: string; knob: string; translate: string }
    > = {
      sm: { track: 'w-7 h-4', knob: 'w-3 h-3', translate: 'translate-x-3' },
      md: { track: 'w-9 h-5', knob: 'w-3.5 h-3.5', translate: 'translate-x-4' },
      lg: { track: 'w-11 h-6', knob: 'w-4.5 h-4.5', translate: 'translate-x-5' },
    };

    const switchColors: Record<GlassCheckboxColor, string> = {
      primary: 'bg-primary border-primary shadow-[0_0_12px_rgba(59,130,246,0.35)]',
      destructive:
        'bg-destructive border-destructive shadow-[0_0_12px_rgba(239,68,68,0.35)]',
      amber: 'bg-amber-500 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.35)]',
      emerald:
        'bg-emerald-500 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]',
    };

    const currentSwitch = switchSizes[size] || switchSizes.md;

    return (
      <span
        className={clsx(
          'relative inline-flex items-center shrink-0 rounded-full border transition-all duration-200 select-none p-0.5 backdrop-blur-xs',
          currentSwitch.track,
          isChecked
            ? switchColors[color]
            : 'bg-slate-700/60 dark:bg-white/10 border-glass-border hover:border-white/30',
          disabled && 'opacity-40 cursor-not-allowed',
          className
        )}
        aria-hidden="true"
      >
        <span
          className={clsx(
            'rounded-full bg-white shadow-xs transition-transform duration-200 transform',
            currentSwitch.knob,
            isChecked ? currentSwitch.translate : 'translate-x-0'
          )}
        />
      </span>
    );
  }

  // --- DEFAULT SQUARE CHECKBOX INDICATOR ---
  const sizeStyles: Record<
    GlassCheckboxSize,
    { container: string; icon: string; stroke: number }
  > = {
    sm: { container: 'w-4 h-4 rounded-[5px]', icon: 'w-2.5 h-2.5', stroke: 3 },
    md: { container: 'w-4.5 h-4.5 rounded-[6px]', icon: 'w-3 h-3', stroke: 3 },
    lg: { container: 'w-5.5 h-5.5 rounded-lg', icon: 'w-3.5 h-3.5', stroke: 3 },
  };

  const colorStyles: Record<
    GlassCheckboxColor,
    { checked: string; iconColor: string }
  > = {
    primary: {
      checked:
        'bg-primary border-primary text-white shadow-[0_0_10px_rgba(59,130,246,0.35)]',
      iconColor: 'text-white',
    },
    destructive: {
      checked:
        'bg-destructive border-destructive text-white shadow-[0_0_10px_rgba(239,68,68,0.35)]',
      iconColor: 'text-white',
    },
    amber: {
      checked:
        'bg-amber-500 border-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.35)]',
      iconColor: 'text-white',
    },
    emerald: {
      checked:
        'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.35)]',
      iconColor: 'text-white',
    },
  };

  const selectedSize = sizeStyles[size] || sizeStyles.md;
  const selectedColor = colorStyles[color] || colorStyles.primary;

  return (
    <span
      className={clsx(
        'relative flex items-center justify-center shrink-0 border transition-all duration-150 backdrop-blur-xs select-none',
        selectedSize.container,
        isChecked
          ? selectedColor.checked
          : 'border-glass-border bg-glass-surface-input dark:border-white/20 dark:bg-white/5 hover:border-primary/50 dark:hover:border-white/40 hover:bg-glass',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      aria-hidden="true"
    >
      {indeterminate ? (
        <Minus
          className={clsx(
            selectedSize.icon,
            selectedColor.iconColor,
            'transition-all duration-150 transform scale-100 opacity-100',
            checkClassName
          )}
          strokeWidth={selectedSize.stroke}
        />
      ) : (
        <Check
          className={clsx(
            selectedSize.icon,
            selectedColor.iconColor,
            'transition-all duration-150 transform',
            checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
            checkClassName
          )}
          strokeWidth={selectedSize.stroke}
        />
      )}
    </span>
  );
};

GlassCheckboxIndicator.displayName = 'GlassCheckboxIndicator';

/**
 * Glassmorphic Checkbox component supporting inline default, switch toggle, and card tile variants.
 */
export const GlassCheckbox = React.forwardRef<HTMLInputElement, GlassCheckboxProps>(
  (
    {
      id: propId,
      name,
      value,
      checked = false,
      indeterminate = false,
      disabled = false,
      onChange,
      label,
      description,
      icon,
      badge,
      variant = 'default',
      size = 'md',
      color = 'primary',
      cardLayout = 'horizontal',
      containerClassName,
      indicatorClassName,
      checkClassName,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = propId || generatedId;
    const innerInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => innerInputRef.current as HTMLInputElement);

    useEffect(() => {
      if (innerInputRef.current) {
        innerInputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    // Color definitions for card active state
    const cardActiveColorStyles: Record<GlassCheckboxColor, string> = {
      primary: 'bg-primary/10 border-primary/50 text-foreground shadow-sm shadow-primary/10',
      destructive:
        'bg-destructive/10 border-destructive/50 text-foreground shadow-sm shadow-destructive/10',
      amber: 'bg-amber-500/10 border-amber-500/50 text-foreground shadow-sm shadow-amber-500/10',
      emerald:
        'bg-emerald-500/10 border-emerald-500/50 text-foreground shadow-sm shadow-emerald-500/10',
    };

    const iconActiveColorStyles: Record<GlassCheckboxColor, string> = {
      primary: 'bg-primary text-white',
      destructive: 'bg-destructive text-white',
      amber: 'bg-amber-500 text-white',
      emerald: 'bg-emerald-500 text-white',
    };

    // --- CARD VARIANT ---
    if (variant === 'card') {
      return (
        <label
          htmlFor={inputId}
          className={clsx(
            'group relative flex rounded-xl border transition-all duration-150 cursor-pointer select-none backdrop-blur-md app-no-drag',
            cardLayout === 'vertical' ? 'flex-col p-3.5' : 'items-start gap-3.5 p-3.5',
            checked
              ? cardActiveColorStyles[color]
              : 'bg-glass-subtle hover:bg-glass border-glass-border hover:border-white/20 text-muted-foreground hover:text-foreground',
            disabled
              ? 'opacity-40 cursor-not-allowed pointer-events-none'
              : 'focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-1 focus-within:ring-offset-background',
            containerClassName
          )}
        >
          <input
            ref={innerInputRef}
            id={inputId}
            type="checkbox"
            name={name}
            value={value}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className={clsx('sr-only peer', className)}
            {...props}
          />

          {cardLayout === 'vertical' ? (
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between w-full mb-1 gap-2">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5 min-w-0">
                  {icon && <span className="shrink-0">{icon}</span>}
                  {label && <span className="truncate">{label}</span>}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {badge}
                  <GlassCheckboxIndicator
                    checked={checked}
                    indeterminate={indeterminate}
                    size={size}
                    color={color}
                    disabled={disabled}
                    variant={variant}
                    className={indicatorClassName}
                    checkClassName={checkClassName}
                  />
                </div>
              </div>
              {description && (
                <span className="text-[11px] text-muted-foreground leading-relaxed block">
                  {description}
                </span>
              )}
              {children}
            </div>
          ) : (
            <>
              {icon && (
                <div
                  className={clsx(
                    'mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg transition-colors shrink-0',
                    checked
                      ? iconActiveColorStyles[color]
                      : 'bg-glass-subtle text-muted-foreground group-hover:text-foreground'
                  )}
                >
                  {icon}
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground leading-snug">
                    {label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {badge}
                    <GlassCheckboxIndicator
                      checked={checked}
                      indeterminate={indeterminate}
                      size={size}
                      color={color}
                      disabled={disabled}
                      variant={variant}
                      className={indicatorClassName}
                      checkClassName={checkClassName}
                    />
                  </div>
                </div>
                {description && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                )}
                {children}
              </div>
            </>
          )}
        </label>
      );
    }

    // --- DEFAULT & SWITCH VARIANTS ---
    return (
      <label
        htmlFor={inputId}
        className={clsx(
          'inline-flex items-start gap-2.5 cursor-pointer select-none transition-colors app-no-drag',
          disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'hover:text-foreground',
          containerClassName
        )}
      >
        <input
          ref={innerInputRef}
          id={inputId}
          type="checkbox"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className={clsx('sr-only peer', className)}
          {...props}
        />

        <GlassCheckboxIndicator
          checked={checked}
          indeterminate={indeterminate}
          size={size}
          color={color}
          disabled={disabled}
          variant={variant}
          className={clsx(
            'peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
            color === 'primary' && 'peer-focus-visible:ring-primary/60',
            color === 'destructive' && 'peer-focus-visible:ring-destructive/60',
            color === 'amber' && 'peer-focus-visible:ring-amber-400/60',
            color === 'emerald' && 'peer-focus-visible:ring-emerald-400/60',
            (label || description || children) && 'mt-0.5',
            indicatorClassName
          )}
          checkClassName={checkClassName}
        />

        {(label || description || children || badge) && (
          <div className="flex flex-col gap-0.5 text-xs min-w-0">
            <div className="flex items-center gap-2">
              {icon && <span className="shrink-0">{icon}</span>}
              {label && <span className="font-medium text-foreground">{label}</span>}
              {badge}
            </div>
            {description && (
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                {description}
              </span>
            )}
            {children}
          </div>
        )}
      </label>
    );
  }
);

GlassCheckbox.displayName = 'GlassCheckbox';

