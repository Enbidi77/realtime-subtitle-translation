import React from 'react';
import { useNavigationStore, AppPage } from '../../stores/navigation-store.js';
import { useSessionStore } from '../../stores/session-store.js';
import { useI18n } from '../../app/i18n/index.js';
import {
  LayoutDashboard,
  Mic,
  FolderKanban,
  History,
  Cpu,
  Settings,
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

  const navItems: NavItem[] = [
    { id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
    {
      id: 'live-subtitles',
      labelKey: 'nav.live',
      icon: Mic,
      showBadge: isListening,
    },
    { id: 'sessions', labelKey: 'nav.sessions', icon: FolderKanban },
    { id: 'history', labelKey: 'nav.history', icon: History },
    { id: 'providers', labelKey: 'nav.providers', icon: Cpu },
    { id: 'settings', labelKey: 'nav.settings', icon: Settings },
  ];

  return (
    <aside className="w-56 h-full flex flex-col justify-between bg-card border-r border-border select-none p-3">
      {/* Navigation list */}
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                <span>{t(item.labelKey)}</span>
              </div>

              {item.showBadge && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom privacy info */}
      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-[11px] text-muted-foreground">
        <div className="font-medium text-foreground mb-0.5">Privacy First</div>
        <p className="text-[10px] leading-tight">
          Offline Whisper speech recognition & encrypted local storage.
        </p>
      </div>
    </aside>
  );
};
