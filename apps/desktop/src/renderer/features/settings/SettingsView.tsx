import React, { useState } from 'react';
import { useSettingsStore } from '../../stores/settings-store.js';
import { useI18n } from '../../app/i18n/index.js';
import {
  Settings,
  Palette,
  Captions,
  Layers,
  Mic,
  Keyboard,
  Shield,
  RotateCcw,
  Check,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { t } = useI18n();
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const [savedBanner, setSavedBanner] = useState(false);

  const showSaved = () => {
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2000);
  };

  const handleReset = async () => {
    if (confirm('Reset all preferences to default values?')) {
      await resetSettings();
      showSaved();
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <span>{t('settings.title')}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure application appearance, subtitle styles, and audio behavior.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedBanner && (
            <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium animate-fadeIn">
              <Check className="w-3.5 h-3.5" />
              <span>Saved</span>
            </span>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('settings.reset')}</span>
          </button>
        </div>
      </div>

      {/* 1. Appearance & Language */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          <span>{t('settings.appearance')}</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Theme */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">{t('settings.theme')}</label>
            <select
              value={settings.theme}
              onChange={(e) => {
                updateSettings({ theme: e.target.value as any });
                showSaved();
              }}
              className="w-full bg-background border border-border rounded-lg p-2 text-foreground"
            >
              <option value="dark">{t('settings.themeDark')}</option>
              <option value="light">{t('settings.themeLight')}</option>
              <option value="system">Follow System</option>
            </select>
          </div>

          {/* UI Language */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">{t('settings.language')}</label>
            <select
              value={settings.locale}
              onChange={(e) => {
                updateSettings({ locale: e.target.value as any });
                showSaved();
              }}
              className="w-full bg-background border border-border rounded-lg p-2 text-foreground"
            >
              <option value="en">English</option>
              <option value="vi">Tiếng Việt (Vietnamese)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Subtitle Appearance & Live Interactive Preview */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Captions className="w-4 h-4 text-primary" />
          <span>{t('settings.subtitleStyle')}</span>
        </h2>

        {/* Live Subtitle Preview Box */}
        <div className="p-6 rounded-xl border border-dashed border-border flex items-center justify-center bg-black/20">
          <div
            className="p-4 rounded-xl shadow-lg transition-all duration-150 max-w-lg w-full"
            style={{
              backgroundColor: settings.subtitleAppearance.backgroundColor,
              opacity: settings.subtitleAppearance.backgroundOpacity,
              textAlign: settings.subtitleAppearance.textAlignment,
            }}
          >
            {settings.subtitleAppearance.displayMode !== 'translation-only' && (
              <div
                style={{
                  fontSize: `${settings.subtitleAppearance.fontSize * 0.7}px`,
                  color: settings.subtitleAppearance.textColor,
                }}
                className="font-medium"
              >
                Welcome to EchoLingo real-time translation.
              </div>
            )}
            {settings.subtitleAppearance.displayMode !== 'original-only' && (
              <div
                style={{
                  fontSize: `${settings.subtitleAppearance.fontSize * 0.75}px`,
                  color: settings.subtitleAppearance.translatedTextColor,
                }}
                className="font-semibold mt-1"
              >
                Chào mừng bạn đến với bản dịch thời gian thực EchoLingo.
              </div>
            )}
          </div>
        </div>

        {/* Customization Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
          {/* Font size */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-muted-foreground font-medium">{t('settings.fontSize')}</label>
              <span className="font-mono text-muted-foreground">{settings.subtitleAppearance.fontSize}px</span>
            </div>
            <input
              type="range"
              min={14}
              max={44}
              step={2}
              value={settings.subtitleAppearance.fontSize}
              onChange={(e) => {
                updateSettings({
                  subtitleAppearance: {
                    ...settings.subtitleAppearance,
                    fontSize: Number(e.target.value),
                  },
                });
                showSaved();
              }}
              className="w-full accent-primary"
            />
          </div>

          {/* Background Opacity */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-muted-foreground font-medium">{t('settings.backgroundOpacity')}</label>
              <span className="font-mono text-muted-foreground">
                {Math.round(settings.subtitleAppearance.backgroundOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={1.0}
              step={0.05}
              value={settings.subtitleAppearance.backgroundOpacity}
              onChange={(e) => {
                updateSettings({
                  subtitleAppearance: {
                    ...settings.subtitleAppearance,
                    backgroundOpacity: Number(e.target.value),
                  },
                });
                showSaved();
              }}
              className="w-full accent-primary"
            />
          </div>

          {/* Text Alignment */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">{t('settings.textAlignment')}</label>
            <select
              value={settings.subtitleAppearance.textAlignment}
              onChange={(e) => {
                updateSettings({
                  subtitleAppearance: {
                    ...settings.subtitleAppearance,
                    textAlignment: e.target.value as any,
                  },
                });
                showSaved();
              }}
              className="w-full bg-background border border-border rounded-lg p-2 text-foreground"
            >
              <option value="center">Center</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>

          {/* Display Mode */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">{t('settings.displayMode')}</label>
            <select
              value={settings.subtitleAppearance.displayMode}
              onChange={(e) => {
                updateSettings({
                  subtitleAppearance: {
                    ...settings.subtitleAppearance,
                    displayMode: e.target.value as any,
                  },
                });
                showSaved();
              }}
              className="w-full bg-background border border-border rounded-lg p-2 text-foreground"
            >
              <option value="both">{t('settings.bothText')}</option>
              <option value="translation-only">{t('settings.transOnly')}</option>
              <option value="original-only">{t('settings.origOnly')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Floating Overlay Settings */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span>{t('settings.overlay')}</span>
        </h2>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">{t('settings.alwaysOnTop')}</div>
              <div className="text-[11px] text-muted-foreground">Keep subtitle overlay floating over other windows</div>
            </div>
            <input
              type="checkbox"
              checked={settings.overlaySettings.alwaysOnTop}
              onChange={(e) => {
                updateSettings({
                  overlaySettings: {
                    ...settings.overlaySettings,
                    alwaysOnTop: e.target.checked,
                  },
                });
                showSaved();
              }}
              className="rounded accent-primary w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <div className="font-medium text-foreground">{t('settings.clickThrough')}</div>
              <div className="text-[11px] text-muted-foreground">Clicks pass through directly to background windows</div>
            </div>
            <input
              type="checkbox"
              checked={settings.overlaySettings.clickThrough}
              onChange={(e) => {
                updateSettings({
                  overlaySettings: {
                    ...settings.overlaySettings,
                    clickThrough: e.target.checked,
                  },
                });
                window.electronAPI?.overlay.setClickThrough(e.target.checked);
                showSaved();
              }}
              className="rounded accent-primary w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <div className="font-medium text-foreground">Overlay Subtitle Style</div>
              <div className="text-[11px] text-muted-foreground">Choose between YouTube-style single caption or multi-line transcript</div>
            </div>
            <select
              value={settings.overlaySettings.captionMode || 'youtube'}
              onChange={(e) => {
                updateSettings({
                  overlaySettings: {
                    ...settings.overlaySettings,
                    captionMode: e.target.value as any,
                  },
                });
                showSaved();
              }}
              className="bg-background border border-border rounded-lg p-1.5 text-xs text-foreground"
            >
              <option value="youtube">YouTube CC (Active sentence with auto-fade)</option>
              <option value="history">Multi-Line History (Stacked lines)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Audio Input & Sensitivity */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          <span>Audio Processing</span>
        </h2>

        <div className="space-y-3 text-xs">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-muted-foreground font-medium">Voice Activity Threshold (VAD Sensitivity)</label>
              <span className="font-mono text-muted-foreground">{settings.vadSensitivity.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min={0.002}
              max={0.05}
              step={0.002}
              value={settings.vadSensitivity}
              onChange={(e) => {
                updateSettings({ vadSensitivity: Number(e.target.value) });
                showSaved();
              }}
              className="w-full accent-primary"
            />
            <p className="text-[11px] text-muted-foreground">
              0.008 is recommended for system audio & YouTube videos. Lower values detect quiet dialogue; higher values filter loud room noise.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Keyboard Shortcuts */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-primary" />
          <span>Keyboard Shortcuts</span>
        </h2>

        <div className="space-y-2 text-xs">
          {Object.entries(settings.keyboardShortcuts).map(([key, shortcut]) => (
            <div key={key} className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="capitalize text-muted-foreground">{key.replace(/-/g, ' ')}</span>
              <kbd className="px-2 py-1 rounded bg-muted font-mono text-[11px] text-foreground border border-border/70">
                {shortcut}
              </kbd>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Privacy & Storage */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span>{t('settings.privacy')}</span>
        </h2>

        <p className="text-xs text-muted-foreground leading-relaxed">
          EchoLingo does not record or store raw audio files by default. All speech models can run fully offline, and API keys are protected using your operating system's hardware-backed key store.
        </p>
      </div>
    </div>
  );
};
