import React from 'react';
import { SearchResultItem } from '../types.js';
import { SearchHighlight } from './SearchHighlight.js';
import {
  LayoutDashboard,
  Mic,
  ScanText,
  FolderKanban,
  History,
  Cpu,
  Settings,
  Square,
  Play,
  Pause,
  ExternalLink,
  Crop,
  RefreshCw,
  Palette,
  Moon,
  Sun,
  Languages,
  FileText,
  Trash2,
  RotateCcw,
  Sparkles,
  Layers,
  Sliders,
  Download,
  AppWindow,
  Keyboard,
  Captions,
  BookA,
  HelpCircle,
  ShieldCheck,
  CornerDownLeft,
  X,
  Search,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Mic,
  ScanText,
  FolderKanban,
  History,
  Cpu,
  Settings,
  Square,
  Play,
  Pause,
  ExternalLink,
  Crop,
  RefreshCw,
  Palette,
  Moon,
  Sun,
  Languages,
  FileText,
  Trash2,
  RotateCcw,
  Sparkles,
  Layers,
  Sliders,
  Download,
  AppWindow,
  Keyboard,
  Captions,
  BookA,
  HelpCircle,
  ShieldCheck,
  Search,
};

interface SearchResultRowProps {
  item: SearchResultItem;
  isSelected: boolean;
  onSelect: () => void;
  onRemoveRecent?: (id: string) => void;
}

export const SearchResultRow: React.FC<SearchResultRowProps> = ({
  item,
  isSelected,
  onSelect,
  onRemoveRecent,
}) => {
  const IconComponent = ICON_MAP[item.icon] || Search;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemoveRecent) {
      onRemoveRecent(item.id);
    }
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      className={`group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-100 select-none ${
        isSelected
          ? 'bg-primary/15 border border-primary/30 shadow-xs'
          : 'hover:bg-glass-subtle border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Category Icon */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isSelected
              ? 'bg-primary text-primary-foreground shadow-xs shadow-primary/30'
              : 'bg-glass-subtle text-muted-foreground group-hover:text-foreground border border-glass-border'
          }`}
        >
          <IconComponent className="w-4 h-4" />
        </div>

        {/* Text Container */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium truncate ${
                isSelected ? 'text-foreground font-semibold' : 'text-foreground'
              }`}
            >
              <SearchHighlight text={item.title} ranges={item.titleHighlights} />
            </span>

            {/* Badge */}
            {item.badge && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium tracking-tight uppercase ${
                  item.badge.toLowerCase() === 'active'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-glass-subtle text-muted-foreground border border-glass-border'
                }`}
              >
                {item.badge}
              </span>
            )}
          </div>

          {/* Description / Subtitle / Path */}
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground truncate">
            {item.path && (
              <span className="opacity-70 shrink-0 font-medium">
                {item.path}
                {item.description ? ' • ' : ''}
              </span>
            )}
            {item.description && (
              <span className="truncate">
                <SearchHighlight text={item.description} ranges={item.descHighlights} />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right controls & shortcut hints */}
      <div className="flex items-center gap-2 pl-3 shrink-0">
        {/* Remove from recent */}
        {item.badge === 'Recent' && onRemoveRecent && (
          <button
            type="button"
            onClick={handleRemove}
            title="Remove from recent"
            className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-glass opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Registered shortcut badge */}
        {item.shortcut && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-glass-subtle border border-glass-border text-muted-foreground hidden sm:inline">
            {item.shortcut}
          </span>
        )}

        {/* Enter selection indicator */}
        <div
          className={`flex items-center gap-1 text-[10px] font-mono transition-opacity ${
            isSelected ? 'opacity-100 text-primary' : 'opacity-0'
          }`}
        >
          <CornerDownLeft className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
};

