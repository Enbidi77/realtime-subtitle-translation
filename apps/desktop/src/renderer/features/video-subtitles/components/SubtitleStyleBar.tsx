import React from 'react';
import { useVideoSubtitleStore } from '../stores/video-subtitle-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { SUBTITLE_STYLE_PRESETS } from '@echo-lingo/config';
import { SubtitleAlignment, SubtitleLayoutMode } from '@echo-lingo/contracts';
import {
  Palette,
  Sliders,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Layers,
  Square,
} from 'lucide-react';

export const SubtitleStyleBar: React.FC = () => {
  const { t } = useI18n();
  const style = useVideoSubtitleStore((s) => s.style);
  const selectedPreset = useVideoSubtitleStore((s) => s.selectedPreset);
  const updateStyle = useVideoSubtitleStore((s) => s.updateStyle);
  const applyPreset = useVideoSubtitleStore((s) => s.applyPreset);

  const presets = Object.values(SUBTITLE_STYLE_PRESETS);

  return (
    <div className="w-full glass-card p-4 rounded-2xl border border-white/10 flex flex-col gap-4">
      {/* Presets Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground/90">
          <Palette className="w-4 h-4 text-blue-400" />
          <span>{t('video.style.title', 'Subtitle Visual Styling')}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {presets.map((p) => {
            const isActive = selectedPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-glass hover:bg-glass-subtle text-foreground/80 hover:text-foreground border border-border dark:border-white/10'
                }`}
              >
                {t(p.nameKey, p.id)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Style Controls Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs">
        {/* Font Family */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
            <Type className="w-3 h-3" />
            <span>{t('video.style.font', 'Font')}</span>
          </label>
          <select
            value={style.fontFamily}
            onChange={(e) => updateStyle({ fontFamily: e.target.value })}
            className="w-full bg-background/80 dark:bg-glass border border-input dark:border-white/10 rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-blue-500"
          >
            <option value="Arial">Arial</option>
            <option value="Segoe UI">Segoe UI</option>
            <option value="Roboto">Roboto</option>
            <option value="Impact">Impact</option>
            <option value="Trebuchet MS">Trebuchet MS</option>
          </select>
        </div>

        {/* Font Size */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
            <span>{t('video.style.size', 'Size')}</span>
            <span className="text-foreground">{style.fontSize}px</span>
          </div>
          <input
            type="range"
            min={14}
            max={64}
            value={style.fontSize}
            onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-slate-200 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-2"
          />
        </div>

        {/* Primary Color */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground font-medium">
            {t('video.style.textColor', 'Text Color')}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <input
              type="color"
              value={style.primaryColor.slice(0, 7)}
              onChange={(e) => updateStyle({ primaryColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border border-input dark:border-white/20 bg-transparent p-0"
            />
            <span className="text-[11px] font-mono text-foreground/80">
              {style.primaryColor.slice(0, 7)}
            </span>
          </div>
        </div>

        {/* Outline / Stroke */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
            <span>{t('video.style.outline', 'Outline')}</span>
            <span className="text-foreground">{style.outlineWidth}px</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <input
              type="color"
              value={style.outlineColor.slice(0, 7)}
              onChange={(e) => updateStyle({ outlineColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border border-input dark:border-white/20 bg-transparent p-0 shrink-0"
            />
            <input
              type="range"
              min={0}
              max={6}
              step={0.5}
              value={style.outlineWidth}
              onChange={(e) => updateStyle({ outlineWidth: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-200 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        {/* Position / Alignment */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground font-medium">
            {t('video.style.position', 'Position')}
          </span>
          <select
            value={style.alignment}
            onChange={(e) => updateStyle({ alignment: e.target.value as SubtitleAlignment })}
            className="w-full bg-background/80 dark:bg-glass border border-input dark:border-white/10 rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-blue-500"
          >
            <option value="bottom-center">{t('video.style.positions.bottomCenter', 'Bottom Center')}</option>
            <option value="bottom-left">{t('video.style.positions.bottomLeft', 'Bottom Left')}</option>
            <option value="bottom-right">{t('video.style.positions.bottomRight', 'Bottom Right')}</option>
            <option value="top-center">{t('video.style.positions.topCenter', 'Top Center')}</option>
            <option value="middle-center">{t('video.style.positions.center', 'Center')}</option>
          </select>
        </div>

        {/* Vertical Margin */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
            <span>{t('video.style.marginV', 'Margin V')}</span>
            <span className="text-foreground">{style.verticalMargin}px</span>
          </div>
          <input
            type="range"
            min={10}
            max={150}
            value={style.verticalMargin}
            onChange={(e) => updateStyle({ verticalMargin: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-slate-200 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-2"
          />
        </div>
      </div>

      {/* Advanced Toggles: Background Box & Bilingual Layout */}
      <div className="flex items-center gap-4 pt-2 border-t border-white/5 text-xs text-muted-foreground flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={style.backgroundBox}
            onChange={(e) => updateStyle({ backgroundBox: e.target.checked })}
            className="w-4 h-4 rounded border-white/20 bg-glass text-blue-600 focus:ring-0 cursor-pointer"
          />
          <span>{t('video.style.backgroundBox', 'Background Pill Box')}</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={style.layoutMode === 'bilingual-stacked'}
            onChange={(e) =>
              updateStyle({
                layoutMode: e.target.checked ? 'bilingual-stacked' : 'single-line',
              })
            }
            className="w-4 h-4 rounded border-white/20 bg-glass text-blue-600 focus:ring-0 cursor-pointer"
          />
          <span>{t('video.style.bilingualStacked', 'Bilingual Stacked (Original + Translation)')}</span>
        </label>

        {style.layoutMode === 'bilingual-stacked' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px]">{t('video.style.subColor', 'Sub color:')}</span>
            <input
              type="color"
              value={style.secondaryColor.slice(0, 7)}
              onChange={(e) => updateStyle({ secondaryColor: e.target.value })}
              className="w-5 h-5 rounded cursor-pointer border border-white/20 bg-transparent p-0"
            />
          </div>
        )}
      </div>
    </div>
  );
};

