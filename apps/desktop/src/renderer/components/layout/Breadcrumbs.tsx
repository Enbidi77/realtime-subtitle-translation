import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigationStore, AppPage, BreadcrumbItem } from '@/stores/navigation-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { isFeatureEnabled } from '@echo-lingo/config';
import {
  ChevronRight,
  ChevronDown,
  Check,
  Layers,
  LayoutDashboard,
  Mic,
  Film,
  ScanText,
  FolderKanban,
  History,
  Cpu,
  Settings,
} from 'lucide-react';

export interface PageMeta {
  id: AppPage;
  labelKey: string;
  defaultLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_PAGE_META: Record<AppPage, PageMeta> = {
  dashboard: {
    id: 'dashboard',
    labelKey: 'nav.dashboard',
    defaultLabel: 'Home',
    icon: LayoutDashboard,
  },
  'live-subtitles': {
    id: 'live-subtitles',
    labelKey: 'nav.live',
    defaultLabel: 'Live Subtitles',
    icon: Mic,
  },
  'video-subtitles': {
    id: 'video-subtitles',
    labelKey: 'nav.videoSubtitles',
    defaultLabel: 'Video Subtitles',
    icon: Film,
  },
  'ocr-translate': {
    id: 'ocr-translate',
    labelKey: 'nav.ocr',
    defaultLabel: 'Screen OCR & Translate',
    icon: ScanText,
  },
  sessions: {
    id: 'sessions',
    labelKey: 'nav.sessions',
    defaultLabel: 'Sessions',
    icon: FolderKanban,
  },
  history: {
    id: 'history',
    labelKey: 'nav.history',
    defaultLabel: 'History',
    icon: History,
  },
  providers: {
    id: 'providers',
    labelKey: 'nav.providers',
    defaultLabel: 'Providers & Models',
    icon: Cpu,
  },
  settings: {
    id: 'settings',
    labelKey: 'nav.settings',
    defaultLabel: 'Settings',
    icon: Settings,
  },
};

export interface BreadcrumbsProps {
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ className = '' }) => {
  const { t } = useI18n();
  const activePage = useNavigationStore((s) => s.activePage);
  const setActivePage = useNavigationStore((s) => s.setActivePage);
  const breadcrumbs = useNavigationStore((s) => s.breadcrumbs);
  const clearBreadcrumbs = useNavigationStore((s) => s.clearBreadcrumbs);
  const featureFlags = useSettingsStore((s) => s.settings.featureFlags);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Available pages filtered by feature flags
  const availablePages = useMemo(() => {
    return Object.values(NAV_PAGE_META).filter((item) =>
      isFeatureEnabled(item.id, featureFlags)
    );
  }, [featureFlags]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const currentPage = NAV_PAGE_META[activePage] || NAV_PAGE_META.dashboard;
  const CurrentIcon = currentPage.icon;
  const pageLabel = t(currentPage.labelKey, currentPage.defaultLabel);
  const hasSubCrumbs = breadcrumbs.length > 0;

  const handleRootClick = () => {
    clearBreadcrumbs();
    setActivePage('dashboard');
  };

  const handlePageClick = () => {
    if (hasSubCrumbs) {
      clearBreadcrumbs();
      setActivePage(activePage);
    } else {
      setIsDropdownOpen((prev) => !prev);
    }
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center min-w-0 app-no-drag ${className}`}
    >
      <ol className="flex items-center gap-1 min-w-0 list-none p-0 m-0">
        {/* Level 1: Workspace root */}
        <li className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleRootClick}
            title={`${t('layout.workspace', 'Workspace')} (${t('nav.dashboard', 'Home')})`}
            aria-label={`${t('layout.workspace', 'Workspace')} - ${t('nav.dashboard', 'Home')}`}
            className="group flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-glass/80 border border-transparent hover:border-glass-border/60 transition-all cursor-pointer app-no-drag select-none shrink-0"
          >
            <Layers className="w-3.5 h-3.5 text-primary/80 group-hover:text-primary transition-colors shrink-0" />
            <span className="hidden sm:inline truncate max-w-[80px] md:max-w-[120px]">
              {t('layout.workspace', 'Workspace')}
            </span>
          </button>
        </li>

        {/* Separator */}
        <li className="flex items-center shrink-0" aria-hidden="true">
          <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 select-none" />
        </li>

        {/* Level 2: Active Page */}
        <li className="flex items-center shrink-0">
          {hasSubCrumbs ? (
            <button
              type="button"
              onClick={handlePageClick}
              title={pageLabel}
              className="group flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-glass/80 border border-transparent hover:border-glass-border/60 transition-all cursor-pointer app-no-drag select-none shrink-0"
            >
              <CurrentIcon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              <span className="truncate max-w-[90px] sm:max-w-[140px]">{pageLabel}</span>
            </button>
          ) : (
            <div className="relative flex items-center shrink-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={handlePageClick}
                aria-expanded={isDropdownOpen}
                aria-haspopup="menu"
                aria-current="page"
                title={pageLabel}
                className={`group flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer app-no-drag select-none shadow-2xs ${
                  isDropdownOpen
                    ? 'bg-glass text-foreground border-primary/40 shadow-xs'
                    : 'bg-glass-subtle/80 text-foreground border-glass-border/80 hover:bg-glass hover:border-glass-border'
                }`}
              >
                <CurrentIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate max-w-[110px] sm:max-w-[160px] md:max-w-[200px]">
                  {pageLabel}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-muted-foreground transition-transform duration-150 ${
                    isDropdownOpen ? 'rotate-180 text-primary' : 'group-hover:text-foreground'
                  }`}
                />
              </button>

              {/* Quick Jump Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  role="menu"
                  aria-label={pageLabel}
                  className="absolute left-0 top-full mt-1.5 w-52 p-1.5 bg-background/95 backdrop-blur-2xl border border-glass-border rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 app-no-drag select-none space-y-0.5"
                >
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('layout.workspace', 'Workspace')}
                  </div>
                  {availablePages.map((item) => {
                    const ItemIcon = item.icon;
                    const isCurrent = item.id === activePage;
                    const itemLabel = t(item.labelKey, item.defaultLabel);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          clearBreadcrumbs();
                          setActivePage(item.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                          isCurrent
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-glass'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{itemLabel}</span>
                        </div>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </li>

        {/* Level 3+: Custom dynamic breadcrumbs */}
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          const SubIcon = crumb.icon;
          const label =
            crumb.label || (crumb.labelKey ? t(crumb.labelKey) : crumb.id);

          return (
            <React.Fragment key={crumb.id || idx}>
              <li className="flex items-center shrink-0" aria-hidden="true">
                <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 select-none" />
              </li>
              <li className="flex items-center shrink-0">
                {isLast ? (
                  <span
                    aria-current="page"
                    title={label}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-glass-subtle/80 text-foreground border border-glass-border/80 shadow-2xs shrink-0 truncate max-w-[120px] sm:max-w-[180px] md:max-w-[240px]"
                  >
                    {SubIcon && <SubIcon className="w-3.5 h-3.5 text-primary shrink-0" />}
                    <span className="truncate">{label}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (crumb.onClick) {
                        crumb.onClick();
                      } else if (crumb.page) {
                        setActivePage(crumb.page);
                      }
                    }}
                    title={label}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-glass/80 border border-transparent hover:border-glass-border/60 transition-all cursor-pointer app-no-drag select-none shrink-0 truncate max-w-[100px] sm:max-w-[150px]"
                  >
                    {SubIcon && <SubIcon className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{label}</span>
                  </button>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

