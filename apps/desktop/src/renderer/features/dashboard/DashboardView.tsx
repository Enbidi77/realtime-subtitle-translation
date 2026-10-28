import React, { useEffect, useState } from "react";
import { useSessionStore } from "@/stores/session-store.js";
import { useSettingsStore } from "@/stores/settings-store.js";
import { useNavigationStore } from "@/stores/navigation-store.js";
import { useI18n } from "@/app/i18n/index.js";
import { SUPPORTED_LANGUAGES, TARGET_LANGUAGES, isPaidSpeechEngine } from "@echo-lingo/config";
import { SessionMetadata } from "@echo-lingo/contracts";
import { GlassCard } from "@/components/ui/GlassCard.js";
import { GlassButton } from "@/components/ui/GlassButton.js";
import { GlassSelect } from "@/components/ui/GlassSelect.js";
import { GlassBadge } from "@/components/ui/GlassBadge.js";
import { createRendererLogger } from "@echo-lingo/logger";
import {
  Mic,
  Square,
  Radio,
  Layers,
  Clock,
  ArrowRight,
  Globe,
  Sparkles,
  AlertTriangle,
  Cpu,
  Activity,
  CheckCircle2,
  Headphones,
} from "lucide-react";

const log = createRendererLogger("DashboardView");

export const DashboardView: React.FC = () => {
  const { t } = useI18n();
  const { isListening, audioError, setAudioError, startSession, stopSession } =
    useSessionStore();
  const { settings, updateSettings } = useSettingsStore();
  const { setActivePage } = useNavigationStore();

  const [recentSessions, setRecentSessions] = useState<SessionMetadata[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);

  useEffect(() => {
    async function loadRecent() {
      if (window.electronAPI) {
        try {
          const list = await window.electronAPI.sessions.list();
          setRecentSessions(list.slice(0, 5));
          const totalSec = list.reduce(
            (acc, s) => acc + (s.durationSeconds || 0),
            0,
          );
          setTotalMinutes(Math.round(totalSec / 60));
        } catch (e) {
          log.error("Failed to load recent sessions:", e);
        }
      }
    }
    loadRecent();
  }, [isListening]);

  useEffect(() => {
    if (
      settings.speechEngine === "mock" ||
      (!settings.showPaidProviders && isPaidSpeechEngine(settings.speechEngine))
    ) {
      updateSettings({ speechEngine: "whisper-local" });
    }
  }, [settings.speechEngine, settings.showPaidProviders]);

  const handleToggleListening = async () => {
    if (isListening) {
      await stopSession();
    } else {
      await startSession({
        sourceLanguage: settings.sourceLanguage,
        targetLanguages: settings.targetLanguages,
        audioSourceType: settings.audioSourceType,
        speechProvider: settings.speechEngine,
        translationProvider: settings.translationProvider,
      });
      setActivePage("live-subtitles");
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header Greeting & Live Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>{t("dashboard.welcome", "Welcome to EchoLingo")}</span>
            <span className="text-xl">✨</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              "dashboard.tagline",
              "Real-time speech recognition, live subtitling, and AI translation pipeline.",
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isListening ? (
            <GlassBadge variant="live" pulse>
              {t("dashboard.liveSessionActive", "Live Session Active")}
            </GlassBadge>
          ) : (
            <GlassBadge variant="neutral">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 mr-1" />
              {t("dashboard.pipelineStandby", "Pipeline Standby")}
            </GlassBadge>
          )}
        </div>
      </div>

      {/* Audio Error Alert Banner */}
      {audioError && (
        <GlassCard
          variant="elevated"
          className="p-4 bg-destructive/15 border-destructive/30 text-destructive flex items-start justify-between gap-4 animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-destructive" />
            <div>
              <div className="text-xs font-semibold text-destructive">
                {t("layout.audioNotice", "Audio Capture Notice")}
              </div>
              <div className="text-xs mt-1 text-foreground/90 leading-relaxed">
                {audioError}
              </div>
            </div>
          </div>
          <GlassButton
            size="xs"
            variant="glass"
            onClick={() => setAudioError(null)}
            className="flex-shrink-0"
          >
            {t("layout.dismiss", "Dismiss")}
          </GlassButton>
        </GlassCard>
      )}

      {/* Hero Action Card (Lumina reference inspired) */}
      <GlassCard
        variant="elevated"
        className="relative overflow-hidden p-6 md:p-8 space-y-6 border-white/20 dark:border-white/10"
      >
        {/* Subtle accent light wash in hero corner */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-primary/15 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5 max-w-xl">
            <GlassBadge variant="accent" className="font-semibold">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              {t("dashboard.realtimeIntelligence", "Real-Time Intelligence")}
            </GlassBadge>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {t("dashboard.heroTitle")}
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              {t("dashboard.heroSubtitle")}
            </p>
          </div>

          {/* Primary Action Button */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleToggleListening}
              className={`flex items-center justify-center gap-3 px-7 py-3.5 rounded-2xl font-semibold text-sm cursor-pointer app-no-drag transition-all duration-200 active:scale-[0.98] ${
                isListening
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/25 border border-destructive/40"
                  : "bg-gradient-to-r from-blue-600 via-indigo-600 to-primary text-white hover:brightness-110 shadow-lg shadow-indigo-500/30 border border-white/25"
              }`}
            >
              {isListening ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>{t("dashboard.stopListening")}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>{t("dashboard.startListening")}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Configuration Quick Selectors */}
        <div className="pt-6 border-t border-glass-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs relative z-10">
          {/* Audio Source */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-foreground/90 font-semibold">
                <Radio className="w-3.5 h-3.5 text-primary" />
                {t("dashboard.audioSource")}
              </span>
            </label>
            <GlassSelect
              value={settings.audioSourceType}
              onChange={(e) =>
                updateSettings({ audioSourceType: e.target.value as any })
              }
              disabled={isListening}
            >
              <option value="system">
                {t(
                  "dashboard.audioSources.system",
                  "🔊 System Audio (YouTube, PC)",
                )}
              </option>
              <option value="microphone">
                {t(
                  "dashboard.audioSources.microphone",
                  "🎙️ Microphone (Voice)",
                )}
              </option>
            </GlassSelect>
            <p className="text-[10px] text-muted-foreground/80 leading-tight">
              {settings.audioSourceType === "system"
                ? t(
                    "dashboard.audioSources.systemHint",
                    "⚡ Captures YouTube, meetings & PC audio directly.",
                  )
                : t(
                    "dashboard.audioSources.microphoneHint",
                    "🎙️ Physical mic. For YouTube, choose System Audio.",
                  )}
            </p>
          </div>

          {/* Speech Engine */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-foreground/90 font-semibold">
                <Cpu className="w-3.5 h-3.5 text-primary" />
                {t("dashboard.speechEngine", "Speech Engine")}
              </span>
              <button
                type="button"
                onClick={() => setActivePage("providers")}
                className="text-[10px] text-primary hover:underline font-medium"
              >
                {t("dashboard.keys", "Keys")}
              </button>
            </label>
            <GlassSelect
              value={
                settings.speechEngine === "mock" ||
                (!settings.showPaidProviders &&
                  isPaidSpeechEngine(settings.speechEngine))
                  ? "whisper-local"
                  : settings.speechEngine
              }
              onChange={(e) =>
                updateSettings({ speechEngine: e.target.value as any })
              }
              disabled={isListening}
            >
              <option value="whisper-local">
                {t("dashboard.speechOptions.whisperLocal", "Whisper Local (Offline)")}
              </option>
              <option value="windows-speech">
                {t("dashboard.speechOptions.windowsSpeech", "Windows System Speech (Built-in SAPI)")}
              </option>
              {settings.showPaidProviders && (
                <option value="groq-whisper">
                  {t("dashboard.speechOptions.groqWhisper", "Groq Whisper (Cloud)")}
                </option>
              )}
              {settings.showPaidProviders && (
                <option value="openai-whisper">
                  {t("dashboard.speechOptions.openaiWhisper", "OpenAI Whisper (Cloud)")}
                </option>
              )}
            </GlassSelect>
            <p className="text-[10px] text-muted-foreground/80 leading-tight">
              {settings.speechEngine === "windows-speech"
                ? t(
                    "dashboard.engineDescriptions.windowsSpeech",
                    "💻 Native Windows SAPI. 100% offline, zero setup.",
                  )
                : settings.speechEngine === "groq-whisper"
                  ? t(
                      "dashboard.engineDescriptions.groqWhisper",
                      "⚡ Ultra-fast Whisper Large cloud. API key required.",
                    )
                  : settings.speechEngine === "openai-whisper"
                    ? t(
                        "dashboard.engineDescriptions.openaiWhisper",
                        "OpenAI whisper-1 model.",
                      )
                    : t(
                        "dashboard.engineDescriptions.whisperLocal",
                        "Offline Whisper inference.",
                      )}
            </p>
          </div>

          {/* Source Language */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium flex items-center gap-1.5 text-foreground/90 font-semibold">
              <Globe className="w-3.5 h-3.5 text-primary" />
              {t("dashboard.sourceLanguage")}
            </label>
            <GlassSelect
              value={settings.sourceLanguage}
              onChange={(e) =>
                updateSettings({ sourceLanguage: e.target.value })
              }
              disabled={isListening}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} {lang.nativeName ? `(${lang.nativeName})` : ""}
                </option>
              ))}
            </GlassSelect>
            <p className="text-[10px] text-muted-foreground/80">
              {t(
                "dashboard.sourceLanguageHint",
                "Spoken language of the audio.",
              )}
            </p>
          </div>

          {/* Target Language */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium flex items-center gap-1.5 text-foreground/90 font-semibold">
              <Globe className="w-3.5 h-3.5 text-primary" />
              {t("dashboard.targetLanguage")}
            </label>
            <GlassSelect
              value={settings.targetLanguages[0] || "vi"}
              onChange={(e) =>
                updateSettings({ targetLanguages: [e.target.value] })
              }
              disabled={isListening}
            >
              {TARGET_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} {lang.nativeName ? `(${lang.nativeName})` : ""}
                </option>
              ))}
            </GlassSelect>
            <p className="text-[10px] text-muted-foreground/80">
              {t(
                "dashboard.targetLanguageHint",
                "Real-time translated subtitle.",
              )}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Metrics & System Health (Lumina 4-card metric row) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Metric 1: Total Sessions */}
        <GlassCard className="p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[11px] font-medium text-muted-foreground">
              {t("dashboard.totalSessions")}
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {recentSessions.length}
            </div>
          </div>
        </GlassCard>

        {/* Metric 2: Total Minutes */}
        <GlassCard className="p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[11px] font-medium text-muted-foreground">
              {t("dashboard.totalMinutes")}
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {totalMinutes}m
            </div>
          </div>
        </GlassCard>

        {/* Metric 3: Active Engine */}
        <GlassCard className="p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[11px] font-medium text-muted-foreground">
              {t("dashboard.activeEngine")}
            </div>
            <div className="text-xs font-semibold text-foreground truncate mt-1">
              {settings.speechEngine}
            </div>
          </div>
        </GlassCard>

        {/* Metric 4: Active Translator */}
        <GlassCard className="p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[11px] font-medium text-muted-foreground">
              {t("dashboard.activeTranslator")}
            </div>
            <div className="text-xs font-semibold text-foreground truncate mt-1">
              {settings.translationProvider}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* System Status Indicators (Lumina bottom bar inspired) */}
      <GlassCard
        variant="subtle"
        className="px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-muted-foreground">
              {t("dashboard.systemStatus.speechEngine", "Speech Engine:")}
            </span>
            <span className="font-semibold text-foreground">
              {settings.speechEngine}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-muted-foreground">
              {t("dashboard.systemStatus.database", "Database:")}
            </span>
            <span className="font-semibold text-foreground">
              {t("dashboard.systemStatus.operational", "Operational")}
            </span>
          </div>

          <div className="flex items-center gap-2 hidden md:flex">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-muted-foreground">
              {t("dashboard.systemStatus.audioDriver", "Audio Driver:")}
            </span>
            <span className="font-semibold text-foreground">
              {settings.audioSourceType}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {t(
              "dashboard.systemStatus.localWhisperReady",
              "Local Whisper Ready",
            )}
          </span>
        </div>
      </GlassCard>

      {/* Recent Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span>{t("dashboard.recentSessions")}</span>
          </h2>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => setActivePage("sessions")}
            className="text-xs font-medium text-primary hover:text-primary gap-1"
          >
            <span>{t("dashboard.viewAll", "View all")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </GlassButton>
        </div>

        {recentSessions.length === 0 ? (
          <GlassCard className="p-8 text-center text-muted-foreground text-sm space-y-2">
            <Headphones className="w-8 h-8 mx-auto opacity-40 text-primary" />
            <div className="font-medium text-foreground">
              {t("dashboard.noSessions")}
            </div>
            <p className="text-xs text-muted-foreground/80 max-w-sm mx-auto">
              {t(
                "dashboard.noSessionsSubtitle",
                "Start listening to capture live audio and transcribe subtitles in real-time.",
              )}
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-2.5">
            {recentSessions.map((session) => (
              <GlassCard
                key={session.id}
                variant="interactive"
                onClick={() => {
                  useSessionStore.getState().loadSession(session.id);
                  setActivePage("live-subtitles");
                }}
                className="flex items-center justify-between p-4"
              >
                <div className="space-y-1 overflow-hidden">
                  <div className="font-medium text-xs text-foreground truncate">
                    {session.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground/80" />
                      {Math.floor(session.durationSeconds / 60)}m{" "}
                      {session.durationSeconds % 60}s
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-muted-foreground/80" />
                      {session.segmentCount}{" "}
                      {t("dashboard.segmentsCount", "segments")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="px-2.5 py-1 rounded-lg bg-glass-subtle border border-glass-border text-[11px] font-mono text-muted-foreground">
                    {session.sourceLanguage} →{" "}
                    {session.targetLanguages.join(", ")}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-glass-subtle border border-glass-border flex items-center justify-center text-muted-foreground">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
