import React, { useEffect, useRef } from 'react';
import { useGlobalSearchStore } from '../global-search-store.js';
import { CategoryTabs } from './CategoryTabs.js';
import { SearchResultRow } from './SearchResultRow.js';
import { SearchFooter } from './SearchFooter.js';
import { useI18n } from '@/app/i18n/index.js';
import { Search, Loader2, X, AlertCircle } from 'lucide-react';
import { SearchCategoryFilter } from '../types.js';

export const GlobalSearchModal: React.FC = () => {
  const { t } = useI18n();
  const isOpen = useGlobalSearchStore((s) => s.isOpen);
  const query = useGlobalSearchStore((s) => s.query);
  const activeCategory = useGlobalSearchStore((s) => s.activeCategory);
  const selectedIndex = useGlobalSearchStore((s) => s.selectedIndex);
  const results = useGlobalSearchStore((s) => s.results);
  const isLoading = useGlobalSearchStore((s) => s.isLoading);
  const metrics = useGlobalSearchStore((s) => s.metrics);

  const close = useGlobalSearchStore((s) => s.close);
  const setQuery = useGlobalSearchStore((s) => s.setQuery);
  const setActiveCategory = useGlobalSearchStore((s) => s.setActiveCategory);
  const setSelectedIndex = useGlobalSearchStore((s) => s.setSelectedIndex);
  const selectNext = useGlobalSearchStore((s) => s.selectNext);
  const selectPrev = useGlobalSearchStore((s) => s.selectPrev);
  const executeSelected = useGlobalSearchStore((s) => s.executeSelected);
  const executeItem = useGlobalSearchStore((s) => s.executeItem);
  const clearRecentHistory = useGlobalSearchStore((s) => s.clearRecentHistory);
  const removeRecentItem = useGlobalSearchStore((s) => s.removeRecentItem);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.querySelector('[aria-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  // Global keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectNext();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectPrev();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeSelected();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Cycle category tabs
      const categories: SearchCategoryFilter[] = [
        'all',
        'navigation',
        'command',
        'settings',
        'session',
        'help',
      ];
      const currentIndex = categories.indexOf(activeCategory);
      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + categories.length) % categories.length
        : (currentIndex + 1) % categories.length;
      setActiveCategory(categories[nextIndex]);
    }
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      close();
    }
  };

  if (!isOpen) return null;

  // Group results for visual hierarchy
  const hasRecent = results.some((r) => r.badge === 'Recent');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('search.title', 'Global Search')}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/60 backdrop-blur-md animate-fade-in"
    >
      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl md:max-w-3xl rounded-2xl glass-panel shadow-2xl border border-glass-border overflow-hidden flex flex-col bg-background/95 text-foreground backdrop-blur-2xl animate-scale-up"
        style={{ maxHeight: '80vh' }}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3.5 px-5 py-4 border-b border-glass-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />

          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="global-search-results"
            aria-activedescendant={results[selectedIndex] ? `result-${results[selectedIndex].id}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeCategory === 'command'
                ? t('search.commandsPlaceholder', 'Type a command or search actions...')
                : t('search.placeholder', 'Search pages, commands, settings, sessions, help...')
            }
            className="flex-1 bg-transparent border-none outline-none text-[15px] text-foreground placeholder:text-muted-foreground/70"
          />

          <div className="flex items-center gap-2 shrink-0">
            {isLoading ? (
              <Loader2 className="w-4.5 h-4.5 text-primary animate-spin" />
            ) : query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-glass cursor-pointer"
                title="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}

            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-glass-subtle border border-glass-border text-muted-foreground select-none">
              Esc
            </kbd>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <CategoryTabs
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        {/* Results Area */}
        <div
          id="global-search-results"
          ref={listRef}
          role="listbox"
          className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[160px] max-h-[50vh] scrollbar-thin"
        >
          {results.length > 0 ? (
            results.map((item, index) => (
              <SearchResultRow
                key={item.id}
                item={item}
                isSelected={index === selectedIndex}
                onSelect={() => executeItem(item)}
                onRemoveRecent={removeRecentItem}
              />
            ))
          ) : !isLoading ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-2 select-none">
              <AlertCircle className="w-8 h-8 text-muted-foreground/50 mb-1" />
              <p className="text-sm font-medium text-foreground">
                {query
                  ? t('search.noResults', `No results found for "${query}"`)
                  : t('search.noSuggestions', 'No suggestions available')}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {t(
                  'search.noResultsHint',
                  'Try searching for pages (e.g. Live, Settings), commands (e.g. Start listening), or data.'
                )}
              </p>
            </div>
          ) : (
            /* Loading State */
            <div className="flex items-center justify-center p-8 text-muted-foreground text-xs gap-2 select-none">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Searching...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <SearchFooter
          resultCount={results.length}
          durationMs={metrics?.totalDurationMs}
          hasRecentItems={hasRecent && !query}
          onClearHistory={clearRecentHistory}
        />
      </div>
    </div>
  );
};

