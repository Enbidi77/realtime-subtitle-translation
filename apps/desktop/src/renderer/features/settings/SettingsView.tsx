import React, { useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useNavigationStore } from '@/stores/navigation-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { isPaidSpeechEngine, isPaidTranslationProvider } from '@echo-lingo/config';
import { AppSettings } from '@echo-lingo/contracts';
import { GlassCard } from '@/components/ui/GlassCard.js';
import { GlassButton } from '@/components/ui/GlassButton.js';
import { GlassSelect } from '@/components/ui/GlassSelect.js';
import { GlassBadge } from '@/components/ui/GlassBadge.js';
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
  Sparkles,
  Sliders,
  AppWindow,
  Minimize2,
  Power,
  HelpCircle,
  Info,
  FileText,
  FolderOpen,
  CreditCard,
  Globe,
  ExternalLink,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { t } = useI18n();
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const { setActivePage } = useNavigationStore();
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
    <div className="flex-1 h-full overflow-y-auto p-6 md:p-8 space-y-6 max-w-4xl mx-auto bg-transparent">
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

        <div className="flex items-center gap-3">
          {savedBanner && (
            <GlassBadge variant="success" className="animate-fade-in font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Saved</span>
            </GlassBadge>
          )}
          <GlassButton
            variant="glass"
            size="sm"
            onClick={handleReset}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            <span>{t('settings.reset')}</span>
          </GlassButton>
        </div>
      </div>

      {/* 1. Appearance & Theme */}
      <GlassCard variant="default" className="p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          <span>{t('settings.appearance')}</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Theme */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">{t('settings.theme')}</label>
            <GlassSelect
              value={settings.theme}
              onChange={(e) => {
                updateSettings({ theme: e.target.value as any });
                showSaved();
              }}
            >
              <option value="dark">{t('settings.themeDark')}</option>
              <option value="light">{t('settings.themeLight')}</option>
              <option value="system">Follow System</option>
            </GlassSelect>
          </div>

          {/* Glass Intensity */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>Glass Intensity</span>
            </label>
            <GlassSelect
              value={settings.glassIntensity || 'balanced'}
              onChange={(e) => {
                updateSettings({ glassIntensity: e.target.value as any });
                showSaved();
              }}
            >
              <option value="subtle">Subtle (Softer Blur & High Contrast)</option>
              <option value="balanced">Balanced (Recommended Default)</option>
              <option value="strong">Strong (Vibrant Refraction & Deep Blur)</option>
            </GlassSelect>
          </div>

          {/* UI Language */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">{t('settings.language')}</label>
            <GlassSelect
              value={settings.locale}
              onChange={(e) => {
                updateSettings({ locale: e.target.value as any });
                showSaved();
              }}
            >
              <option value="en">English</option>
              <option value="vi">Tiếng Việt (Vietnamese)</option>
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      {/* 2. Subtitle Appearance & Live Interactive Preview */}
      <GlassCard variant="default" className="p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Captions className="w-4 h-4 text-primary" />
          <span>{t('settings.subtitleStyle')}</span>
        </h2>

        {/* Live Subtitle Preview Box */}
        <div className="p-6 rounded-2xl border border-dashed border-glass-border flex items-center justify-center bg-black/25 backdrop-blur-md">
          <div
            className="p-5 rounded-2xl shadow-xl transition-all duration-150 max-w-lg w-full border border-white/20"
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
                className="font-medium leading-relaxed"
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
                className="font-semibold mt-1 leading-relaxed"
              >
                Chào mừng bạn đến với bản dịch thời gian thực EchoLingo.
              </div>
            )}
          </div>
        </div>

        {/* Customization Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs pt-2">
          {/* Font size */}
          <div className="space-y-2">
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
          <div className="space-y-2">
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
            <GlassSelect
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
            >
              <option value="center">Center</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </GlassSelect>
          </div>

          {/* Display Mode */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">{t('settings.displayMode')}</label>
            <GlassSelect
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
            >
              <option value="both">{t('settings.bothText')}</option>
              <option value="translation-only">{t('settings.transOnly')}</option>
              <option value="original-only">{t('settings.origOnly')}</option>
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      {/* 3. Floating Overlay Settings */}
      <GlassCard variant="default" className="p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span>{t('settings.overlay')}</span>
        </h2>

        <div className="space-y-3.5 text-xs">
          <label className="flex items-center justify-between cursor-pointer">
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
          </label>

          <label className="flex items-center justify-between pt-3 border-t border-glass-border cursor-pointer">
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
          </label>

          <label className="flex items-center justify-between pt-3 border-t border-glass-border cursor-pointer">
            <div>
              <div className="font-medium text-foreground">{t('settings.hideOnCapture')}</div>
              <div className="text-[11px] text-muted-foreground">{t('settings.hideOnCaptureDesc')}</div>
            </div>
            <input
              type="checkbox"
              checked={settings.overlaySettings.hideOnCapture ?? true}
              onChange={(e) => {
                updateSettings({
                  overlaySettings: {
                    ...settings.overlaySettings,
                    hideOnCapture: e.target.checked,
                  },
                  screenTranslation: {
                    ...settings.screenTranslation,
                    hideOverlayOnCapture: e.target.checked,
                  },
                });
                showSaved();
              }}
              className="rounded accent-primary w-4 h-4"
            />
          </label>

          <div className="flex items-center justify-between pt-3 border-t border-glass-border">
            <div>
              <div className="font-medium text-foreground">Overlay Subtitle Style</div>
              <div className="text-[11px] text-muted-foreground">Choose between YouTube-style single caption or multi-line transcript</div>
            </div>
            <div className="w-56">
              <GlassSelect
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
              >
                <option value="youtube">YouTube CC (Active auto-fade)</option>
                <option value="history">Multi-Line History (Stacked)</option>
              </GlassSelect>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 4. Audio Input & Sensitivity */}
      <GlassCard variant="default" className="p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          <span>Audio Processing & VAD</span>
        </h2>

        <div className="space-y-3 text-xs">
          <div className="space-y-2">
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
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              0.008 is recommended for system audio & YouTube videos. Lower values detect quiet speech; higher values filter background noise.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* 5. AI & Translation Providers */}
      <GlassCard variant="default" className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span>{t('settings.providersTitle', 'AI & Translation Providers')}</span>
          </h2>

          <GlassButton
            variant="glass"
            size="sm"
            onClick={() => setActivePage('providers')}
            icon={<ExternalLink className="w-3.5 h-3.5" />}
          >
            <span>{t('providers.title', 'Providers & Models')}</span>
          </GlassButton>
        </div>

        <div className="space-y-3.5 text-xs">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-glass-subtle border border-glass-border">
            <div className="space-y-0.5 max-w-xl">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span>{t('settings.showPaidProviders', 'Show Paid Translation & Subtitle Providers')}</span>
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t(
                  'settings.showPaidProvidersDesc',
                  'Display commercial cloud providers requiring paid API keys (such as OpenAI Whisper, Google Cloud Translation, and DeepL). When disabled, only free and local offline providers are shown.'
                )}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
              <input
                type="checkbox"
                checked={settings.showPaidProviders ?? false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  const updates: Partial<AppSettings> = { showPaidProviders: checked };
                  if (!checked) {
                    if (isPaidSpeechEngine(settings.speechEngine)) {
                      updates.speechEngine = 'whisper-local';
                    }
                    if (isPaidTranslationProvider(settings.translationProvider)) {
                      updates.translationProvider = 'google-web';
                    }
                  }
                  updateSettings(updates);
                  showSaved();
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </GlassCard>

      {/* 6. Application & System Tray */}
      <GlassCard variant="default" className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AppWindow className="w-4 h-4 text-primary" />
            <span>{t('settings.windowAndTray', 'Application & System Tray')}</span>
          </h2>

          <GlassButton
            variant="glass"
            size="sm"
            onClick={() => window.electronAPI?.app.minimizeToTray()}
            icon={<Minimize2 className="w-3.5 h-3.5" />}
          >
            <span>{t('settings.minimizeNow', 'Minimize to Tray Now')}</span>
          </GlassButton>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-muted-foreground font-medium block mb-1">
              {t('settings.closeBehavior', 'When Closing Application')}
            </label>
            <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
              {t(
                'settings.closeBehaviorDesc',
                'Choose whether closing the window minimizes EchoLingo to the system tray or exits completely.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Option 1: Minimize to Tray */}
            <button
              type="button"
              onClick={() => {
                updateSettings({ closeBehavior: 'minimize-to-tray' });
                showSaved();
              }}
              className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                settings.closeBehavior === 'minimize-to-tray'
                  ? 'bg-primary/10 border-primary/50 text-foreground shadow-sm shadow-primary/10'
                  : 'bg-glass-subtle hover:bg-glass border-glass-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Minimize2 className="w-3.5 h-3.5 text-primary" />
                  <span>{t('settings.minimizeToTrayTitle', 'Minimize to Tray')}</span>
                </span>
                {settings.closeBehavior === 'minimize-to-tray' && (
                  <Check className="w-3.5 h-3.5 text-primary" />
                )}
              </div>
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                {t('settings.minimizeToTrayDesc', 'Stays running in background for hotkeys and overlay.')}
              </span>
            </button>

            {/* Option 2: Close Application */}
            <button
              type="button"
              onClick={() => {
                updateSettings({ closeBehavior: 'quit' });
                showSaved();
              }}
              className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                settings.closeBehavior === 'quit'
                  ? 'bg-destructive/10 border-destructive/50 text-foreground shadow-sm shadow-destructive/10'
                  : 'bg-glass-subtle hover:bg-glass border-glass-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Power className="w-3.5 h-3.5 text-destructive" />
                  <span>{t('settings.quitAppTitle', 'Close Application')}</span>
                </span>
                {settings.closeBehavior === 'quit' && (
                  <Check className="w-3.5 h-3.5 text-destructive" />
                )}
              </div>
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                {t('settings.quitAppDesc', 'Completely terminates app and background tasks.')}
              </span>
            </button>

            {/* Option 3: Always Ask */}
            <button
              type="button"
              onClick={() => {
                updateSettings({ closeBehavior: 'ask' });
                showSaved();
              }}
              className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                settings.closeBehavior === 'ask'
                  ? 'bg-amber-500/10 border-amber-500/50 text-foreground shadow-sm shadow-amber-500/10'
                  : 'bg-glass-subtle hover:bg-glass border-glass-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('settings.askEveryTimeTitle', 'Ask Every Time')}</span>
                </span>
                {settings.closeBehavior === 'ask' && (
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                )}
              </div>
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                {t('settings.askEveryTimeDesc', 'Prompts with dialog options before closing.')}
              </span>
            </button>
          </div>

          {/* Splash Screen Startup Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-glass-subtle border border-glass-border mt-3">
            <div className="space-y-0.5">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>{t('settings.enableSplashScreen', 'Show Splash Screen on Startup')}</span>
              </span>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.enableSplashScreenDesc', 'Display animated glass splash screen while initializing core services.')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableSplashScreen ?? true}
                onChange={(e) => {
                  updateSettings({ enableSplashScreen: e.target.checked });
                  showSaved();
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-glass-subtle border border-glass-border mt-3">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t(
                'settings.trayHint',
                'When minimized to system tray, right-click the EchoLingo tray icon anytime to toggle live subtitles, open the subtitle overlay, trigger screen OCR capture, or open preferences.'
              )}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* 6. Keyboard Shortcuts */}
      <GlassCard variant="default" className="p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-primary" />
          <span>Keyboard Shortcuts</span>
        </h2>

        <div className="space-y-2 text-xs">
          {Object.entries(settings.keyboardShortcuts).map(([key, shortcut]) => (
            <div key={key} className="flex items-center justify-between py-1.5 border-b border-glass-border/40">
              <span className="capitalize text-muted-foreground">{key.replace(/-/g, ' ')}</span>
              <kbd className="px-2.5 py-1 rounded-lg bg-glass-subtle font-mono text-[11px] text-foreground border border-glass-border">
                {shortcut}
              </kbd>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* 6. Privacy & Storage */}
      <GlassCard variant="subtle" className="p-6 space-y-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span>{t('settings.privacy')}</span>
        </h2>

        <p className="text-xs text-muted-foreground/80 leading-relaxed">
          EchoLingo processes audio directly through in-memory streams. Offline models run entirely on your local machine, and API keys are protected using your operating system's hardware-backed credential vault.
        </p>
      </GlassCard>

      {/* 7. Diagnostics & Logs */}
      <GlassCard variant="default" className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>{t('settings.diagnostics')}</span>
            </h2>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              {t('settings.openLogsDesc')}
            </p>
          </div>
          <GlassButton
            variant="glass"
            size="sm"
            onClick={async () => {
              try {
                await window.electronAPI.app.openLogs();
              } catch (err) {
                console.error('Failed to open logs directory:', err);
              }
            }}
            icon={<FolderOpen className="w-3.5 h-3.5" />}
          >
            <span>{t('settings.openLogs')}</span>
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
};
