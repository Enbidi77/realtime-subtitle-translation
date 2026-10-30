import React, { useState, useRef, useCallback, useLayoutEffect, useEffect, useMemo } from 'react';
import { useNavigationStore, AppPage } from '@/stores/navigation-store.js';
import { useSessionStore } from '@/stores/session-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { isFeatureEnabled } from '@echo-lingo/config';
import {
  LayoutDashboard,
  Mic,
  FolderKanban,
  History,
  Cpu,
  ScanText,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Film,
} from 'lucide-react';

interface NavItem {
  id: AppPage;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  showBadge?: boolean;
}

export const Sidebar: React.FC = () => {
  const { t } = useI18n();
  const { activePage, setActivePage } = useNavigationStore();
  const isListening = useSessionStore((s) => s.isListening);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{
    top: number;
    height: number;
    ready: boolean;
  }>({ top: 0, height: 0, ready: false });
  const [isAnimated, setIsAnimated] = useState(false);

  const featureFlags = useSettingsStore((s) => s.settings.featureFlags);

  const allNavItems: NavItem[] = useMemo(
    () => [
      { id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      {
        id: 'live-subtitles',
        labelKey: 'nav.live',
        icon: Mic,
        showBadge: isListening,
      },
      { id: 'video-subtitles', labelKey: 'nav.videoSubtitles', icon: Film },
      { id: 'ocr-translate', labelKey: 'nav.ocr', icon: ScanText },
      { id: 'sessions', labelKey: 'nav.sessions', icon: FolderKanban },
      { id: 'history', labelKey: 'nav.history', icon: History },
      { id: 'providers', labelKey: 'nav.providers', icon: Cpu },
      { id: 'settings', labelKey: 'nav.settings', icon: Settings },
    ],
    [isListening]
  );

  const navItems = useMemo(
    () => allNavItems.filter((item) => isFeatureEnabled(item.id, featureFlags)),
    [allNavItems, featureFlags]
  );

  // Automatically fall back to dashboard if active page is disabled by a feature flag
  useEffect(() => {
    if (!isFeatureEnabled(activePage, featureFlags)) {
      setActivePage('dashboard');
    }
  }, [activePage, featureFlags, setActivePage]);

  const updateIndicator = useCallback(() => {
    const el = itemRefs.current[activePage];
    if (el) {
      const top = el.offsetTop;
      const height = el.offsetHeight;
      setIndicatorStyle((prev) => {
        if (prev.top === top && prev.height === height && prev.ready) {
          return prev;
        }
        return { top, height, ready: true };
      });
    } else {
      setIndicatorStyle((prev) => {
        if (!prev.ready) return prev;
        return { ...prev, ready: false };
      });
    }
  }, [activePage]);

  // Synchronously compute indicator position before paint
  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator, isCollapsed]);

  // Handle container resizing and enable smooth sliding transition after initial mount
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setIsAnimated(true);
    });

    const nav = navRef.current;
    if (!nav) return () => cancelAnimationFrame(rafId);

    const observer = new ResizeObserver(() => {
      updateIndicator();
    });

    observer.observe(nav);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [updateIndicator]);

  return (
    <aside
      className={`glass-sidebar h-full flex flex-col justify-between select-none p-3 transition-all duration-300 relative z-20 pointer-events-auto ${
        isCollapsed ? 'w-16' : 'w-56'
      }`}
    >
      <div className="space-y-4">
        {/* Collapse toggle header */}
        <div className="flex items-center justify-between px-1">
          {!isCollapsed && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/75">
              {t('layout.workspace', 'Workspace')}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-1.5 rounded-lg cursor-pointer app-no-drag text-muted-foreground hover:text-foreground hover:bg-glass border border-transparent hover:border-glass-border transition-colors ${
              isCollapsed ? 'mx-auto' : ''
            }`}
            title={isCollapsed ? t('layout.expandSidebar', 'Expand Sidebar') : t('layout.collapseSidebar', 'Collapse Sidebar')}
            aria-label={isCollapsed ? t('layout.expandSidebar', 'Expand Sidebar') : t('layout.collapseSidebar', 'Collapse Sidebar')}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Navigation items list */}
        <nav ref={navRef} className="relative flex flex-col gap-1.5" aria-label={t('layout.workspace', 'Workspace')}>
          {/* Smooth sliding indicator pill */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 rounded-xl pointer-events-none bg-gradient-to-r from-blue-600/90 to-indigo-600/90 shadow-md shadow-indigo-500/20 border border-white/20 z-0"
            style={{
              top: 0,
              transform: `translate3d(0, ${indicatorStyle.top}px, 0)`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.ready ? 1 : 0,
              transition: isAnimated
                ? 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1), height 300ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease'
                : 'none',
              willChange: 'transform, height, opacity',
            }}
          />

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                type="button"
                key={item.id}
                ref={(el) => {
                  if (el) {
                    itemRefs.current[item.id] = el;
                  } else {
                    delete itemRefs.current[item.id];
                  }
                }}
                onClick={() => setActivePage(item.id)}
                title={isCollapsed ? t(item.labelKey) : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                } py-2.5 rounded-xl text-xs cursor-pointer app-no-drag relative z-10 transition-colors duration-200 border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-muted-foreground font-medium hover:text-foreground hover:bg-glass-subtle hover:border-glass-border/40'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-all duration-200 ${
                      isActive ? 'text-white scale-105' : 'text-muted-foreground'
                    }`}
                  />
                  {!isCollapsed && <span>{t(item.labelKey)}</span>}
                </div>

                {item.showBadge && (
                  <span
                    className={`flex h-2 w-2 relative ${
                      isCollapsed ? 'absolute top-1.5 right-1.5' : ''
                    }`}
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom privacy info card */}
      {!isCollapsed ? (
        <div className="p-3 rounded-xl glass-panel-subtle text-[11px] text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span>{t('layout.localPrivate', 'Local & Private')}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
            {t('layout.localPrivateDesc', 'Whisper offline inference & zero data harvesting.')}
          </p>
        </div>
      ) : (
        <div
          className="flex justify-center p-2 text-muted-foreground hover:text-primary transition-colors"
          title={`${t('layout.localPrivate', 'Local & Private')}: ${t('layout.localPrivateDesc', 'Whisper offline inference & zero data harvesting.')}`}
        >
          <ShieldCheck className="w-4 h-4 text-primary" />
        </div>
      )}
    </aside>
  );
};
