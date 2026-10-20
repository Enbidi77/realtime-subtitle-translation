import React, { useEffect } from 'react';
import { useOnboardingStore } from '@/stores/onboarding-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useNavigationStore } from '@/stores/navigation-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { GlassButton } from '@/components/ui/GlassButton.js';
import { GlassBadge } from '@/components/ui/GlassBadge.js';
import appLogo from '@/assets/logo.png';
import {
  Sparkles,
  ShieldCheck,
  Zap,
  Layers,
  Radio,
  Mic,
  Captions,
  ScanText,
  Film,
  Keyboard,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  ExternalLink,
  Volume2,
} from 'lucide-react';

export const InteractiveTourModal: React.FC = () => {
  const { t } = useI18n();
  const { isOpen, currentStep, totalSteps, nextStep, prevStep, goToStep, completeTour } = useOnboardingStore();
  const { settings, updateSettings } = useSettingsStore();
  const { setActivePage } = useNavigationStore();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        completeTour();
      } else if (e.key === 'ArrowRight') {
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        prevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextStep, prevStep, completeTour]);

  if (!isOpen) return null;

  const isLastStep = currentStep === totalSteps - 1;

  const handleToggleOverlay = async () => {
    if (window.electronAPI?.overlay) {
      await window.electronAPI.overlay.toggle();
    }
  };

  const handleSelectAudioSource = async (source: 'system' | 'microphone') => {
    await updateSettings({ audioSourceType: source });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      // Step 0: Welcome & Offline Pillars
      case 0:
        return (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border border-white/10">
              <img
                src={appLogo}
                alt="EchoLingo"
                className="w-14 h-14 rounded-2xl object-contain shadow-lg shadow-indigo-500/25 shrink-0"
              />
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {t('onboarding.steps.0.title', 'Welcome to EchoLingo')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {t(
                    'onboarding.steps.0.tagline',
                    'Offline-first real-time speech recognition, live subtitling, and AI translation pipeline.'
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Pillar 1 */}
              <div className="p-3.5 rounded-xl bg-glass-subtle border border-glass-border space-y-1.5">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{t('onboarding.steps.0.pillar1Title', '100% Offline & Private')}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t(
                    'onboarding.steps.0.pillar1Desc',
                    'Whisper local models and Windows SAPI run strictly on your machine. Zero telemetry, no silent uploads.'
                  )}
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="p-3.5 rounded-xl bg-glass-subtle border border-glass-border space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                  <Zap className="w-4 h-4 shrink-0" />
                  <span>{t('onboarding.steps.0.pillar2Title', 'Microsecond Precision')}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t(
                    'onboarding.steps.0.pillar2Desc',
                    'Continuous VAD audio processing decoupled from the 60fps glassmorphism UI thread.'
                  )}
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="p-3.5 rounded-xl bg-glass-subtle border border-glass-border space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>{t('onboarding.steps.0.pillar3Title', 'Contract-Driven Reliability')}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t(
                    'onboarding.steps.0.pillar3Desc',
                    'Type-safe IPC architecture with Zod schema validation across all process boundaries.'
                  )}
                </p>
              </div>
            </div>

            {/* Language preview banner */}
            <div className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Default Target Language:</span>
              <GlassBadge variant="neutral" className="font-semibold text-primary">
                Vietnamese (Tiếng Việt)
              </GlassBadge>
            </div>
          </div>
        );

      // Step 1: Audio Source Selection
      case 1:
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                <span>{t('onboarding.steps.1.title', 'Choose the Right Audio Source')}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(
                  'onboarding.steps.1.tagline',
                  'Crucial: Decide whether you want to transcribe your voice or PC sound.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Option 1: System Audio */}
              <button
                type="button"
                onClick={() => handleSelectAudioSource('system')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  settings.audioSourceType === 'system'
                    ? 'bg-blue-500/15 border-blue-500/60 shadow-lg shadow-blue-500/10 text-foreground'
                    : 'bg-glass-subtle hover:bg-glass border-glass-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                    <Volume2 className="w-4 h-4 text-primary" />
                    <span>System Audio</span>
                  </div>
                  {settings.audioSourceType === 'system' ? (
                    <GlassBadge variant="success">
                      <Check className="w-3 h-3 mr-1" />
                      Active
                    </GlassBadge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground group-hover:text-foreground">Click to select</span>
                  )}
                </div>
                <div className="text-[10px] font-semibold text-primary mb-1">
                  ⭐ Recommended for YouTube, Zoom, Netflix
                </div>
                <p className="text-[11px] leading-relaxed">
                  {t(
                    'onboarding.steps.1.systemDesc',
                    'Captures internal PC sound directly from browsers, media players, and conferencing apps without room echo.'
                  )}
                </p>
              </button>

              {/* Option 2: Microphone */}
              <button
                type="button"
                onClick={() => handleSelectAudioSource('microphone')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  settings.audioSourceType === 'microphone'
                    ? 'bg-indigo-500/15 border-indigo-500/60 shadow-lg shadow-indigo-500/10 text-foreground'
                    : 'bg-glass-subtle hover:bg-glass border-glass-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                    <Mic className="w-4 h-4 text-indigo-400" />
                    <span>Microphone</span>
                  </div>
                  {settings.audioSourceType === 'microphone' ? (
                    <GlassBadge variant="success">
                      <Check className="w-3 h-3 mr-1" />
                      Active
                    </GlassBadge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground group-hover:text-foreground">Click to select</span>
                  )}
                </div>
                <div className="text-[10px] font-semibold text-indigo-400 mb-1">
                  🎙️ For your physical voice
                </div>
                <p className="text-[11px] leading-relaxed">
                  {t(
                    'onboarding.steps.1.micDesc',
                    'Captures your physical microphone when you are speaking or presenting.'
                  )}
                </p>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground text-[11px]">
                You can toggle this anytime in Home or by pressing <kbd className="px-1.5 py-0.5 rounded bg-glass font-mono text-[10px] border border-glass-border">Ctrl+Shift+Space</kbd>.
              </span>
            </div>
          </div>
        );

      // Step 2: Live Subtitles & Floating Overlay
      case 2:
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Captions className="w-4 h-4 text-primary" />
                <span>{t('onboarding.steps.2.title', 'Live Subtitles & Floating Overlay')}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(
                  'onboarding.steps.2.tagline',
                  'Display transparent, non-intrusive subtitles on top of any active window or video stream.'
                )}
              </p>
            </div>

            {/* Simulated Live Subtitle Glass Card */}
            <div className="p-5 rounded-2xl bg-black/35 border border-dashed border-glass-border flex flex-col items-center justify-center text-center space-y-2 backdrop-blur-md">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                Live Subtitle Preview
              </div>
              <div className="p-4 rounded-xl bg-black/75 border border-white/15 max-w-md w-full shadow-lg">
                <div className="text-xs text-white/90 font-medium">
                  {t('onboarding.steps.2.sampleOriginal', 'EchoLingo streams real-time subtitles with microsecond latency.')}
                </div>
                <div className="text-xs text-blue-400 font-semibold mt-1">
                  {t('onboarding.steps.2.sampleTranslation', 'EchoLingo phát phụ đề thời gian thực với độ trễ cực thấp.')}
                </div>
              </div>
            </div>

            {/* Overlay features & Test Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-glass-subtle border border-glass-border">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{t('onboarding.steps.2.overlayTitle', 'Floating Glass Overlay (Ctrl+Shift+O)')}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    'onboarding.steps.2.overlayDesc',
                    'Always-on-top glass window that sits above videos, streams, and games. Supports click-through mode so it never interrupts your clicks.'
                  )}
                </p>
              </div>
              <GlassButton
                variant="primary"
                size="sm"
                onClick={handleToggleOverlay}
                icon={<ExternalLink className="w-3 h-3" />}
                className="shrink-0"
              >
                <span>{t('onboarding.buttons.testOverlay', 'Toggle Overlay Now')}</span>
              </GlassButton>
            </div>
          </div>
        );

      // Step 3: Screen OCR Translation
      case 3:
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ScanText className="w-4 h-4 text-primary" />
                <span>{t('onboarding.steps.3.title', 'Instant Screen Translation & OCR')}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(
                  'onboarding.steps.3.tagline',
                  'Translate text anywhere on your screen by simply dragging a selection box.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Shortcut Card */}
              <div className="p-4 rounded-xl bg-glass-subtle border border-glass-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ScanText className="w-4 h-4 text-primary" />
                    <span>Instant Snapshot</span>
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-glass font-mono text-[10px] text-primary border border-primary/30">
                    Ctrl+Shift+T
                  </kbd>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t(
                    'onboarding.steps.3.hotkeyDesc',
                    'Freezes your screen into an interactive canvas. Drag over untranslated manga, comics, software UI, or games to translate instantly.'
                  )}
                </p>
              </div>

              {/* Continuous OCR Card */}
              <div className="p-4 rounded-xl bg-glass-subtle border border-glass-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Continuous Auto-OCR</span>
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-glass font-mono text-[10px] text-amber-400 border border-amber-400/30">
                    Ctrl+Shift+R
                  </kbd>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t(
                    'onboarding.steps.3.continuousDesc',
                    'Automatically re-translates a fixed screen region as subtitle lines or dialogues update, with built-in Levenshtein deduplication.'
                  )}
                </p>
              </div>
            </div>

            {/* Quick action: Navigate to Screen OCR View */}
            <div className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground text-[11px]">
                Want to explore the dedicated OCR history and test captures?
              </span>
              <button
                type="button"
                onClick={() => {
                  completeTour();
                  setActivePage('ocr-translate');
                }}
                className="text-primary hover:underline text-xs font-semibold flex items-center gap-1"
              >
                <span>Open Screen OCR View</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        );

      // Step 4: Video Subtitles Studio
      case 4:
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Film className="w-4 h-4 text-primary" />
                <span>{t('onboarding.steps.4.title', 'Video Subtitles Studio')}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(
                  'onboarding.steps.4.tagline',
                  'Transcribe, translate, edit, and burn-in subtitles for local video files.'
                )}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-glass-subtle border border-glass-border space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Film className="w-4 h-4 text-primary" />
                <span>{t('onboarding.steps.4.featureTitle', 'Full Media Timeline & Export')}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t(
                  'onboarding.steps.4.featureDesc',
                  'Drag & drop MP4, MKV, or WEBM files. Generate synchronized cues, edit text inline, and export to SRT, VTT, or ASS files.'
                )}
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-black/30 border border-white/5 text-center">
                  <div className="text-[10px] font-mono text-primary font-bold">.SRT</div>
                  <div className="text-[9px] text-muted-foreground">SubRip standard</div>
                </div>
                <div className="p-2 rounded-lg bg-black/30 border border-white/5 text-center">
                  <div className="text-[10px] font-mono text-indigo-400 font-bold">.VTT</div>
                  <div className="text-[9px] text-muted-foreground">Web Video Text</div>
                </div>
                <div className="p-2 rounded-lg bg-black/30 border border-white/5 text-center">
                  <div className="text-[10px] font-mono text-purple-400 font-bold">.ASS</div>
                  <div className="text-[9px] text-muted-foreground">Stylized Burn-in</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground text-[11px]">
                Built-in automatic FFmpeg integration and video player.
              </span>
              <button
                type="button"
                onClick={() => {
                  completeTour();
                  setActivePage('video-subtitles');
                }}
                className="text-primary hover:underline text-xs font-semibold flex items-center gap-1"
              >
                <span>Open Video Studio</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        );

      // Step 5: Essential Shortcuts & Ready!
      case 5:
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-primary" />
                <span>{t('onboarding.steps.5.title', "Essential Shortcuts & You're Ready!")}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(
                  'onboarding.steps.5.tagline',
                  'Master these global hotkeys to control EchoLingo seamlessly from anywhere.'
                )}
              </p>
            </div>

            {/* Shortcuts Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-glass-subtle border border-glass-border">
                <span className="text-muted-foreground font-medium">Start/Stop Listening</span>
                <kbd className="px-2 py-0.5 rounded bg-glass font-mono text-[10px] text-foreground border border-glass-border">
                  Ctrl+Shift+Space
                </kbd>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-glass-subtle border border-glass-border">
                <span className="text-muted-foreground font-medium">Toggle Floating Overlay</span>
                <kbd className="px-2 py-0.5 rounded bg-glass font-mono text-[10px] text-foreground border border-glass-border">
                  Ctrl+Shift+O
                </kbd>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-glass-subtle border border-glass-border">
                <span className="text-muted-foreground font-medium">Screen OCR Translation</span>
                <kbd className="px-2 py-0.5 rounded bg-glass font-mono text-[10px] text-foreground border border-glass-border">
                  Ctrl+Shift+T
                </kbd>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-glass-subtle border border-glass-border">
                <span className="text-muted-foreground font-medium">Command Palette</span>
                <kbd className="px-2 py-0.5 rounded bg-glass font-mono text-[10px] text-foreground border border-glass-border">
                  Ctrl+K / Ctrl+Shift+P
                </kbd>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-transparent border border-emerald-500/20 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t(
                  'onboarding.steps.5.settingsHint',
                  'You can revisit this interactive tour anytime in Settings > Interactive App Instructions.'
                )}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none"
    >
      {/* Backdrop Scrim with Blur */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={completeTour}
        aria-hidden="true"
      />

      {/* Glass Modal Card */}
      <div className="glass-modal relative w-full max-w-2xl p-6 text-foreground overflow-hidden rounded-3xl animate-scale-in z-10 border border-white/20 shadow-2xl shadow-indigo-500/10 flex flex-col justify-between min-h-[460px]">
        {/* Progress Bar Segment */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-glass-border">
          <div className="flex items-center gap-2">
            <GlassBadge variant="accent" className="font-semibold text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              {t('onboarding.badge', 'Interactive Getting Started')}
            </GlassBadge>
            <span className="text-[11px] text-muted-foreground">
              {t('onboarding.stepIndicator', `Step ${currentStep + 1} of ${totalSteps}`)
                .replace('{current}', String(currentStep + 1))
                .replace('{total}', String(totalSteps))}
            </span>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => goToStep(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === currentStep
                    ? 'w-6 bg-primary shadow-sm shadow-primary/50'
                    : idx < currentStep
                    ? 'bg-primary/40 hover:bg-primary/60'
                    : 'bg-white/20 hover:bg-white/40'
                }`}
                title={`Go to step ${idx + 1}`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Close button */}
          <GlassButton
            variant="ghost"
            size="icon-sm"
            onClick={completeTour}
            aria-label="Close walkthrough"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-4 h-4" />
          </GlassButton>
        </div>

        {/* Middle Interactive Step Content */}
        <div className="flex-1 py-4">{renderStepContent()}</div>

        {/* Bottom Actions Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-glass-border">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={completeTour}
            className="text-muted-foreground hover:text-foreground"
          >
            <span>{t('onboarding.buttons.skip', 'Skip Tour')}</span>
          </GlassButton>

          <div className="flex items-center gap-2">
            <GlassButton
              variant="glass"
              size="sm"
              onClick={prevStep}
              disabled={currentStep === 0}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              <span>{t('onboarding.buttons.back', 'Previous')}</span>
            </GlassButton>

            <GlassButton
              variant="primary"
              size="sm"
              onClick={nextStep}
              icon={isLastStep ? <Check className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            >
              <span>
                {isLastStep
                  ? t('onboarding.buttons.getStarted', 'Get Started')
                  : t('onboarding.buttons.next', 'Next Step')}
              </span>
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  );
};
