import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ChevronDown, Check } from 'lucide-react';

export type GlassSelectSize = 'xs' | 'sm' | 'md';

export interface GlassSelectOption {
  value: string | number;
  label: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface GlassSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: GlassSelectSize;
  containerClassName?: string;
  dropdownClassName?: string;
  options?: GlassSelectOption[];
  placeholder?: string;
}

/**
 * Recursively extracts options from React children (<option> elements or fragments).
 */
function extractOptions(children: React.ReactNode): GlassSelectOption[] {
  const items: GlassSelectOption[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    if (child.type === React.Fragment) {
      items.push(...extractOptions((child.props as any).children));
      return;
    }

    const childProps = child.props as any;
    if (
      child.type === 'option' ||
      (typeof child.type === 'string' && child.type.toLowerCase() === 'option')
    ) {
      items.push({
        value: childProps.value !== undefined ? childProps.value : String(childProps.children ?? ''),
        label: childProps.children,
        disabled: Boolean(childProps.disabled),
        icon: childProps['data-icon'],
        description: childProps['data-description'],
      });
    }
  });

  return items;
}

/**
 * GlassSelect - A high-performance liquid glass dropdown select component.
 * Replaces native OS select popups with a floating frosted glass menu inspired by macOS/iOS liquid glass.
 */
export const GlassSelect = React.forwardRef<HTMLSelectElement, GlassSelectProps>(
  (
    {
      leftIcon,
      rightIcon,
      size = 'md',
      containerClassName,
      dropdownClassName,
      options,
      placeholder,
      children,
      className,
      disabled,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

    const isControlled = value !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState<string | number>(() => {
      if (defaultValue !== undefined) return defaultValue as string | number;
      return '';
    });

    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectRef = useRef<HTMLSelectElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchStringRef = useRef('');

    const [dropdownPosition, setDropdownPosition] = useState<{
      top?: number;
      bottom?: number;
      left: number;
      minWidth: number;
      maxWidth: number;
    }>({
      left: 0,
      minWidth: 180,
      maxWidth: 480,
    });

    // Expose hidden HTMLSelectElement to parent ref
    useImperativeHandle(ref, () => selectRef.current as HTMLSelectElement);

    useEffect(() => {
      setMounted(true);
    }, []);

    const parsedOptions = useMemo(() => {
      if (options && options.length > 0) return options;
      return extractOptions(children);
    }, [options, children]);

    const effectiveValue = useMemo(() => {
      if (isControlled) return value;
      if (uncontrolledValue !== '') return uncontrolledValue;
      return parsedOptions[0]?.value ?? '';
    }, [isControlled, value, uncontrolledValue, parsedOptions]);

    const selectedOption = useMemo(() => {
      return parsedOptions.find((opt) => String(opt.value) === String(effectiveValue));
    }, [parsedOptions, effectiveValue]);

    const displayLabel =
      selectedOption?.label ?? placeholder ?? (effectiveValue !== '' ? String(effectiveValue) : '\u00A0');

    // Recalculates floating menu position anchored to trigger
    const updatePosition = useCallback(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownEstimatedHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      const showAbove = spaceBelow < dropdownEstimatedHeight && spaceAbove > spaceBelow;

      const minWidth = Math.max(rect.width, 200);
      const maxWidth = Math.min(480, window.innerWidth - 24);

      let left = rect.left;
      if (left + minWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - minWidth - 12);
      }

      setDropdownPosition({
        top: showAbove ? undefined : rect.bottom + 6,
        bottom: showAbove ? window.innerHeight - rect.top + 6 : undefined,
        left,
        minWidth,
        maxWidth: Math.max(minWidth, maxWidth),
      });
    }, []);

    const handleToggle = () => {
      if (disabled) return;
      if (!isOpen) {
        updatePosition();
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    const handleSelect = (option: GlassSelectOption) => {
      if (option.disabled) return;

      if (!isControlled) {
        setUncontrolledValue(option.value);
      }

      setIsOpen(false);
      triggerRef.current?.focus();

      if (selectRef.current) {
        selectRef.current.value = String(option.value);
      }

      if (onChange) {
        const syntheticEvent = {
          target: {
            name: props.name || '',
            value: option.value,
          },
          currentTarget: {
            name: props.name || '',
            value: option.value,
          },
          preventDefault: () => {},
          stopPropagation: () => {},
          persist: () => {},
          nativeEvent: new Event('change'),
          bubbles: true,
          cancelable: true,
          defaultPrevented: false,
          eventPhase: 3,
          isTrusted: true,
          timeStamp: Date.now(),
          type: 'change',
        } as unknown as React.ChangeEvent<HTMLSelectElement>;

        onChange(syntheticEvent);
      }
    };

    // When dropdown opens, initialize highlight to selected item & scroll into view
    useEffect(() => {
      if (isOpen) {
        updatePosition();
        const selectedIdx = parsedOptions.findIndex(
          (opt) => String(opt.value) === String(effectiveValue)
        );
        const initialIdx = selectedIdx >= 0 ? selectedIdx : 0;
        setHighlightedIndex(initialIdx);

        const timer = setTimeout(() => {
          if (initialIdx >= 0 && itemRefs.current[initialIdx]) {
            itemRefs.current[initialIdx]?.scrollIntoView({ block: 'nearest' });
          }
        }, 15);

        return () => clearTimeout(timer);
      }
    }, [isOpen, effectiveValue, parsedOptions, updatePosition]);

    // Handle outside clicks, escape, scroll & resize
    useEffect(() => {
      if (!isOpen) return;

      const handlePointerDown = (e: MouseEvent | TouchEvent) => {
        const target = e.target as Node;
        if (
          triggerRef.current?.contains(target) ||
          dropdownRef.current?.contains(target)
        ) {
          return;
        }
        setIsOpen(false);
      };

      const handleScroll = (e: Event) => {
        if (dropdownRef.current?.contains(e.target as Node)) {
          return;
        }
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          setIsOpen(false);
        } else {
          updatePosition();
        }
      };

      const handleResize = () => {
        updatePosition();
      };

      document.addEventListener('mousedown', handlePointerDown);
      document.addEventListener('touchstart', handlePointerDown);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);

      return () => {
        document.removeEventListener('mousedown', handlePointerDown);
        document.removeEventListener('touchstart', handlePointerDown);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }, [isOpen, updatePosition]);

    // Keyboard accessibility navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          updatePosition();
          setIsOpen(true);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === 'Tab') {
        setIsOpen(false);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev + 1;
          while (next < parsedOptions.length && parsedOptions[next].disabled) {
            next++;
          }
          return next < parsedOptions.length ? next : prev;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && parsedOptions[next].disabled) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < parsedOptions.length) {
          const option = parsedOptions[highlightedIndex];
          if (!option.disabled) {
            handleSelect(option);
          }
        }
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        const firstValid = parsedOptions.findIndex((opt) => !opt.disabled);
        if (firstValid >= 0) setHighlightedIndex(firstValid);
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        for (let i = parsedOptions.length - 1; i >= 0; i--) {
          if (!parsedOptions[i].disabled) {
            setHighlightedIndex(i);
            break;
          }
        }
        return;
      }

      // Quick type-ahead search
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchStringRef.current += e.key.toLowerCase();
        searchTimeoutRef.current = setTimeout(() => {
          searchStringRef.current = '';
        }, 500);

        const matchIdx = parsedOptions.findIndex((opt) => {
          if (opt.disabled) return false;
          const text = typeof opt.label === 'string' ? opt.label : String(opt.value);
          return text.toLowerCase().startsWith(searchStringRef.current);
        });

        if (matchIdx >= 0) {
          setHighlightedIndex(matchIdx);
        }
      }
    };

    // Scroll highlighted item into view
    useEffect(() => {
      if (isOpen && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
        itemRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
      }
    }, [isOpen, highlightedIndex]);

    const sizeConfig: Record<
      GlassSelectSize,
      {
        trigger: string;
        paddingLeft: string;
        paddingRight: string;
        chevronSize: string;
        chevronPos: string;
        item: string;
        checkSize: string;
      }
    > = {
      xs: {
        trigger: 'h-[30px] text-xs rounded-lg',
        paddingLeft: leftIcon ? 'pl-7' : 'pl-2.5',
        paddingRight: 'pr-7',
        chevronSize: 'w-3 h-3',
        chevronPos: 'right-2',
        item: 'py-1.5 px-2.5 text-xs rounded-lg',
        checkSize: 'w-3 h-3',
      },
      sm: {
        trigger: 'h-[34px] text-xs rounded-lg',
        paddingLeft: leftIcon ? 'pl-8' : 'pl-3',
        paddingRight: 'pr-8',
        chevronSize: 'w-3 h-3',
        chevronPos: 'right-2.5',
        item: 'py-2 px-3 text-xs rounded-lg',
        checkSize: 'w-3.5 h-3.5',
      },
      md: {
        trigger: 'h-[38px] text-xs rounded-xl',
        paddingLeft: leftIcon ? 'pl-9' : 'pl-3.5',
        paddingRight: 'pr-9',
        chevronSize: 'w-3.5 h-3.5',
        chevronPos: 'right-3',
        item: 'py-2 px-3.5 text-xs rounded-xl',
        checkSize: 'w-3.5 h-3.5',
      },
    };

    return (
      <div className={clsx('relative flex items-center', containerClassName || 'w-full')}>
        {leftIcon && (
          <span className="absolute left-2.5 text-muted-foreground pointer-events-none flex items-center justify-center z-10">
            {leftIcon}
          </span>
        )}

        {/* Custom liquid glass trigger button */}
        <button
          type="button"
          ref={triggerRef}
          disabled={disabled}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={clsx(
            'glass-input w-full font-medium text-left cursor-pointer app-no-drag disabled:cursor-not-allowed disabled:opacity-50 transition-all flex items-center relative select-none hover:border-white/80 dark:hover:border-white/20 hover:bg-white/70 dark:hover:bg-white/10',
            isOpen && 'ring-2 ring-primary/30 border-primary/60 bg-white/95 dark:bg-white/15 shadow-sm',
            sizeConfig[size].trigger,
            sizeConfig[size].paddingLeft,
            sizeConfig[size].paddingRight,
            className
          )}
        >
          <span className="truncate flex-1 block text-foreground">
            {displayLabel}
          </span>
          <span
            className={clsx(
              'absolute pointer-events-none flex items-center justify-center transition-transform duration-200',
              sizeConfig[size].chevronPos,
              isOpen ? 'rotate-180 text-primary' : 'text-muted-foreground'
            )}
          >
            {rightIcon || <ChevronDown className={sizeConfig[size].chevronSize} />}
          </span>
        </button>

        {/* Hidden native select for form accessibility, refs, and standards */}
        <select
          ref={selectRef}
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          value={effectiveValue}
          onChange={onChange}
          className="sr-only"
          {...props}
        >
          {children}
        </select>

        {/* Liquid Glass Dropdown Box Portal */}
        {isOpen &&
          mounted &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={dropdownRef}
              role="listbox"
              tabIndex={-1}
              onKeyDown={handleKeyDown}
              style={{
                position: 'fixed',
                top: dropdownPosition.top !== undefined ? `${dropdownPosition.top}px` : undefined,
                bottom: dropdownPosition.bottom !== undefined ? `${dropdownPosition.bottom}px` : undefined,
                left: `${dropdownPosition.left}px`,
                minWidth: `${dropdownPosition.minWidth}px`,
                maxWidth: `${dropdownPosition.maxWidth}px`,
                width: 'max-content',
                zIndex: 9999,
              }}
              className={clsx(
                'glass-liquid-menu p-1.5 animate-scale-in origin-top select-none',
                dropdownClassName
              )}
            >
              <div className="max-h-64 overflow-y-auto space-y-0.5 overscroll-contain pr-0.5">
                {parsedOptions.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No options available
                  </div>
                ) : (
                  parsedOptions.map((opt, index) => {
                    const isSelected = String(opt.value) === String(effectiveValue);
                    const isHighlighted = highlightedIndex === index;

                    return (
                      <div
                        key={String(opt.value) + '-' + index}
                        role="option"
                        aria-selected={isSelected}
                        data-highlighted={isHighlighted}
                        onClick={() => handleSelect(opt)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        ref={(el) => {
                          itemRefs.current[index] = el;
                        }}
                        className={clsx(
                          'glass-liquid-item relative flex items-center justify-between font-medium cursor-pointer',
                          sizeConfig[size].item,
                          opt.disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
                          isSelected
                            ? 'bg-primary/10 text-primary font-semibold dark:bg-primary/20 dark:text-primary-foreground'
                            : isHighlighted
                            ? 'text-foreground'
                            : 'text-foreground/80 hover:text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                          <div className="min-w-0 flex-1">
                            <span className="truncate block">{opt.label}</span>
                            {opt.description && (
                              <span className="text-[10px] text-muted-foreground block truncate">
                                {opt.description}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <Check
                            className={clsx(
                              sizeConfig[size].checkSize,
                              'text-primary shrink-0 ml-2 animate-scale-in'
                            )}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }
);

GlassSelect.displayName = 'GlassSelect';
