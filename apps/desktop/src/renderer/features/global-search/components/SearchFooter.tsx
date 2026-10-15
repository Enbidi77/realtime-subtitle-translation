import React from 'react';
import { useI18n } from '@/app/i18n/index.js';
import { CornerDownLeft, ArrowUpDown, Clock, Trash2 } from 'lucide-react';

interface SearchFooterProps {
  resultCount: number;
  durationMs?: number;
  hasRecentItems?: boolean;
  onClearHistory?: () => void;
}

export const SearchFooter: React.FC<SearchFooterProps> = ({
  resultCount,
  durationMs,
  hasRecentItems,
  onClearHistory,
}) => {
  const { t } = useI18n();

  return (
    <footer className="flex items-center justify-between px-4 py-2 border-t border-glass-border/50 text-[11px] text-muted-foreground select-none bg-glass-subtle/30">
      {/* Keyboard hints */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-glass-subtle border border-glass-border font-mono text-[10px]">
            <ArrowUpDown className="w-2.5 h-2.5 inline mr-0.5" />
          </kbd>
          <span className="opacity-80">{t('search.navHint', 'Navigate')}</span>
        </div>

        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-glass-subtle border border-glass-border font-mono text-[10px]">
            <CornerDownLeft className="w-2.5 h-2.5 inline mr-0.5" />
          </kbd>
          <span className="opacity-80">{t('search.selectHint', 'Select')}</span>
        </div>

        <div className="flex items-center gap-1 hidden sm:flex">
          <kbd className="px-1.5 py-0.5 rounded bg-glass-subtle border border-glass-border font-mono text-[10px]">
            Tab
          </kbd>
          <span className="opacity-80">{t('search.filterHint', 'Category')}</span>
        </div>

        <div className="flex items-center gap-1 hidden sm:flex">
          <kbd className="px-1.5 py-0.5 rounded bg-glass-subtle border border-glass-border font-mono text-[10px]">
            Esc
          </kbd>
          <span className="opacity-80">{t('search.closeHint', 'Close')}</span>
        </div>
      </div>

      {/* Right meta info & history controls */}
      <div className="flex items-center gap-2.5">
        {hasRecentItems && onClearHistory && (
          <button
            type="button"
            onClick={onClearHistory}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/75 hover:text-red-400 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-glass-subtle"
          >
            <Trash2 className="w-3 h-3" />
            <span>{t('search.clearHistory', 'Clear history')}</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 opacity-70">
          <span>{resultCount} {resultCount === 1 ? 'item' : 'items'}</span>
          {durationMs !== undefined && durationMs >= 0 && (
            <span className="hidden md:inline font-mono text-[10px] text-muted-foreground/70">
              ({durationMs}ms)
            </span>
          )}
        </div>
      </div>
    </footer>
  );
};

