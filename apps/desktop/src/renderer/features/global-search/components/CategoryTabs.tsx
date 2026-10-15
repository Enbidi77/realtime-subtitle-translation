import React from 'react';
import { SearchCategoryFilter } from '../types.js';
import { useI18n } from '@/app/i18n/index.js';
import {
  Sparkles,
  Compass,
  Terminal,
  Sliders,
  Database,
  HelpCircle,
} from 'lucide-react';

interface CategoryTabsProps {
  activeCategory: SearchCategoryFilter;
  onSelectCategory: (category: SearchCategoryFilter) => void;
  resultCounts?: Record<string, number>;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  activeCategory,
  onSelectCategory,
  resultCounts,
}) => {
  const { t } = useI18n();

  const tabs: Array<{
    id: SearchCategoryFilter;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'all', label: t('search.all', 'All'), icon: Sparkles },
    { id: 'navigation', label: t('search.navigation', 'Pages'), icon: Compass },
    { id: 'command', label: t('search.command', 'Commands'), icon: Terminal },
    { id: 'settings', label: t('search.settings', 'Settings'), icon: Sliders },
    { id: 'session', label: t('search.data', 'Data'), icon: Database },
    { id: 'help', label: t('search.help', 'Help'), icon: HelpCircle },
  ];

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-glass-border/50 overflow-x-auto scrollbar-none select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeCategory === tab.id;
        const count = resultCounts?.[tab.id];

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectCategory(tab.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 shrink-0 ${
              isActive
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-glass-subtle border border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-primary/30 text-primary-foreground font-semibold' : 'bg-glass-subtle text-muted-foreground'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

