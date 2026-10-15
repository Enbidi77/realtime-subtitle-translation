import React from 'react';
import { useGlobalSearchStore } from '../global-search-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { Search } from 'lucide-react';

export const TitleBarSearchButton: React.FC = () => {
  const { t } = useI18n();
  const open = useGlobalSearchStore((s) => s.open);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return (
    <button
      type="button"
      onClick={() => open()}
      aria-label={t('search.title', 'Global Search')}
      className="group flex items-center justify-between w-80 sm:w-96 md:w-[420px] lg:w-[480px] xl:w-[540px] max-w-xl h-8.5 px-3.5 rounded-xl bg-glass-subtle hover:bg-glass border border-glass-border hover:border-glass-border/90 hover:shadow-sm cursor-pointer transition-all duration-150 app-no-drag shadow-2xs select-none"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Search className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        <span className="text-xs md:text-[13px] text-muted-foreground group-hover:text-foreground transition-colors truncate text-left">
          {t('search.titlebarButton', 'Search or jump to...')}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 pl-3">
        <kbd className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-glass border border-glass-border text-muted-foreground group-hover:text-foreground shadow-2xs">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </div>
    </button>
  );
};

