import React, { createContext, useContext, useId, useCallback } from 'react';
import clsx from 'clsx';

export type GlassRadioVariant = 'default' | 'card';
export type GlassRadioSize = 'sm' | 'md' | 'lg';
export type GlassRadioColor = 'primary' | 'destructive' | 'amber' | 'emerald';
export type GlassRadioCardLayout = 'horizontal' | 'vertical';

export interface GlassRadioIndicatorProps {
  checked?: boolean;
  size?: GlassRadioSize;
  color?: GlassRadioColor;
  disabled?: boolean;
  className?: string;
  dotClassName?: string;
}

export interface GlassRadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: GlassRadioVariant;
  size?: GlassRadioSize;
  color?: GlassRadioColor;
  cardLayout?: GlassRadioCardLayout;
  containerClassName?: string;
  indicatorClassName?: string;
  dotClassName?: string;
}

export interface GlassRadioGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  variant?: GlassRadioVariant;
  size?: GlassRadioSize;
  color?: GlassRadioColor;
  cardLayout?: GlassRadioCardLayout;
}

interface GlassRadioGroupContextValue {
  name?: string;
  value?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  variant?: GlassRadioVariant;
  size?: GlassRadioSize;
  color?: GlassRadioColor;
  cardLayout?: GlassRadioCardLayout;
}

const GlassRadioGroupContext = createContext<GlassRadioGroupContextValue | null>(null);

export const useGlassRadioGroup = () => useContext(GlassRadioGroupContext);

/**
 * Visual radio indicator circle with glass styling and smooth dot animation.
 */
export const GlassRadioIndicator: React.FC<GlassRadioIndicatorProps> = ({
  checked = false,
  size = 'md',
  color = 'primary',
  disabled = false,
  className,
  dotClassName,
}) => {
  const sizeStyles: Record<GlassRadioSize, { container: string; dot: string }> = {
    sm: {
      container: 'w-4 h-4',
      dot: 'w-1.5 h-1.5',
    },
    md: {
      container: 'w-5 h-5',
      dot: 'w-2.5 h-2.5',
    },
    lg: {
      container: 'w-6 h-6',
      dot: 'w-3 h-3',
    },
  };

  const colorStyles: Record<GlassRadioColor, { outerChecked: string; dot: string }> = {
    primary: {
      outerChecked: 'border-primary bg-primary/10 shadow-[0_0_12px_rgba(59,130,246,0.3)]',
      dot: 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]',
    },
    destructive: {
      outerChecked: 'border-destructive bg-destructive/10 shadow-[0_0_12px_rgba(239,68,68,0.3)]',
      dot: 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]',
    },
    amber: {
      outerChecked: 'border-amber-400 bg-amber-400/10 shadow-[0_0_12px_rgba(245,158,11,0.3)]',
      dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
    },
    emerald: {
      outerChecked: 'border-emerald-400 bg-emerald-400/10 shadow-[0_0_12px_rgba(16,185,129,0.3)]',
      dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
    },
  };

  const selectedSize = sizeStyles[size] || sizeStyles.md;
  const selectedColor = colorStyles[color] || colorStyles.primary;

  return (
    <span
      className={clsx(
        'relative rounded-full flex items-center justify-center shrink-0 transition-all duration-200 backdrop-blur-xs select-none',
        selectedSize.container,
        checked
          ? selectedColor.outerChecked
          : 'border border-glass-border bg-glass-surface-input dark:border-white/15 dark:bg-white/5 hover:border-white/40 dark:hover:border-white/30',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      aria-hidden="true"
    >
      <span
        className={clsx(
          'rounded-full transition-all duration-200 ease-out transform',
          selectedSize.dot,
          selectedColor.dot,
          checked ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
          dotClassName
        )}
      />
    </span>
  );
};

GlassRadioIndicator.displayName = 'GlassRadioIndicator';

/**
 * Radio Group component managing mutual exclusivity, context, and accessibility.
 */
export const GlassRadioGroup: React.FC<GlassRadioGroupProps> = ({
  name: propName,
  value: controlledValue,
  defaultValue,
  onChange,
  disabled = false,
  orientation = 'vertical',
  variant,
  size,
  color,
  cardLayout,
  className,
  children,
  ...props
}) => {
  const generatedName = useId();
  const name = propName || generatedName;

  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | number | undefined>(
    defaultValue
  );
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : uncontrolledValue;

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const val = event.target.value;
      if (!isControlled) {
        setUncontrolledValue(val);
      }
      onChange?.(val);
    },
    [isControlled, onChange]
  );

  return (
    <GlassRadioGroupContext.Provider
      value={{
        name,
        value: currentValue,
        onChange: handleChange,
        disabled,
        variant,
        size,
        color,
        cardLayout,
      }}
    >
      <div
        role="radiogroup"
        aria-orientation={orientation}
        className={clsx(
          'flex',
          orientation === 'vertical' ? 'flex-col gap-2' : 'flex-row gap-3 items-stretch flex-wrap',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </GlassRadioGroupContext.Provider>
  );
};

GlassRadioGroup.displayName = 'GlassRadioGroup';

/**
 * Glassmorphic Radio input component supporting inline default and card tile variants.
 */
export const GlassRadio = React.forwardRef<HTMLInputElement, GlassRadioProps>(
  (
    {
      id: propId,
      name: propName,
      value,
      checked: propChecked,
      disabled: propDisabled,
      onChange,
      label,
      description,
      icon,
      badge,
      variant: propVariant,
      size: propSize,
      color: propColor,
      cardLayout: propCardLayout,
      containerClassName,
      indicatorClassName,
      dotClassName,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = propId || generatedId;

    const group = useGlassRadioGroup();

    const name = propName ?? group?.name;
    const variant = propVariant ?? group?.variant ?? 'default';
    const size = propSize ?? group?.size ?? 'md';
    const color = propColor ?? group?.color ?? 'primary';
    const cardLayout =
      propCardLayout ?? group?.cardLayout ?? (variant === 'card' ? 'horizontal' : undefined);
    const disabled = propDisabled ?? group?.disabled ?? false;

    const isChecked =
      propChecked !== undefined
        ? propChecked
        : group?.value !== undefined && value !== undefined
        ? String(group.value) === String(value)
        : false;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      group?.onChange?.(e);
    };

    // Color definitions for card styling
    const cardActiveColorStyles: Record<GlassRadioColor, string> = {
      primary: 'bg-primary/10 border-primary/50 text-foreground shadow-sm shadow-primary/10',
      destructive:
        'bg-destructive/10 border-destructive/50 text-foreground shadow-sm shadow-destructive/10',
      amber: 'bg-amber-500/10 border-amber-500/50 text-foreground shadow-sm shadow-amber-500/10',
      emerald:
        'bg-emerald-500/10 border-emerald-500/50 text-foreground shadow-sm shadow-emerald-500/10',
    };

    const iconActiveColorStyles: Record<GlassRadioColor, string> = {
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
            isChecked
              ? cardActiveColorStyles[color]
              : 'bg-glass-subtle hover:bg-glass border-glass-border hover:border-white/20 text-muted-foreground hover:text-foreground',
            disabled
              ? 'opacity-40 cursor-not-allowed pointer-events-none'
              : 'focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-1 focus-within:ring-offset-background',
            containerClassName
          )}
        >
          <input
            ref={ref}
            id={inputId}
            type="radio"
            name={name}
            value={value}
            checked={isChecked}
            disabled={disabled}
            onChange={handleChange}
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
                  <GlassRadioIndicator
                    checked={isChecked}
                    size={size}
                    color={color}
                    disabled={disabled}
                    className={indicatorClassName}
                    dotClassName={dotClassName}
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
                    isChecked
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
                    <GlassRadioIndicator
                      checked={isChecked}
                      size={size}
                      color={color}
                      disabled={disabled}
                      className={indicatorClassName}
                      dotClassName={dotClassName}
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

    // --- DEFAULT INLINE VARIANT ---
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
          ref={ref}
          id={inputId}
          type="radio"
          name={name}
          value={value}
          checked={isChecked}
          disabled={disabled}
          onChange={handleChange}
          className={clsx('sr-only peer', className)}
          {...props}
        />

        <GlassRadioIndicator
          checked={isChecked}
          size={size}
          color={color}
          disabled={disabled}
          className={clsx(
            'peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
            color === 'primary' && 'peer-focus-visible:ring-primary/60',
            color === 'destructive' && 'peer-focus-visible:ring-destructive/60',
            color === 'amber' && 'peer-focus-visible:ring-amber-400/60',
            color === 'emerald' && 'peer-focus-visible:ring-emerald-400/60',
            (label || description || children) && (size === 'sm' ? 'mt-0.5' : 'mt-0.5'),
            indicatorClassName
          )}
          dotClassName={dotClassName}
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

GlassRadio.displayName = 'GlassRadio';

