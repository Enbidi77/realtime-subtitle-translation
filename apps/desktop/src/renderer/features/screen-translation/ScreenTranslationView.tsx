import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
  OcrProviderCapability,
  OcrResponse,
  TranslationResult,
  OcrHistoryItem,
  ContinuousOcrStats,
  OcrProfile,
  OcrProviderId,
} from "@echo-lingo/contracts";
import {
  OCR_SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGES,
  TARGET_LANGUAGES,
} from "@echo-lingo/config";
import { createRendererLogger } from "@echo-lingo/logger";
import {
  GlassButton,
  GlassCard,
  GlassBadge,
  GlassSelect,
  GlassInput,
} from "@/components/ui/index.js";
import { useSettingsStore } from "@/stores/settings-store.js";
import { useI18n } from "@/app/i18n/index.js";
import {
  Crop,
  Copy,
  Check,
  Play,
  Square,
  Pause,
  RotateCw,
  Trash2,
  Download,
  Search,
  Sparkles,
  SlidersHorizontal,
  History,
  Activity,
  Zap,
  Clock,
  Layers,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";

const log = createRendererLogger("ScreenTranslationView");

export const ScreenTranslationView: React.FC = () => {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettingsStore();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "capture" | "continuous" | "history"
  >("capture");

  // OCR & Translation State
  const [ocrProviders, setOcrProviders] = useState<OcrProviderCapability[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<OcrProviderId>(
    settings.screenTranslation?.ocrProvider || "windows-native",
  );
  const [ocrLanguage, setOcrLanguage] = useState<string>(
    settings.screenTranslation?.ocrLanguage || "auto",
  );
  const [targetLanguage, setTargetLanguage] = useState<string>(
    settings.targetLanguages?.[0] || "vi",
  );
  const [profile, setProfile] = useState<OcrProfile>(
    settings.screenTranslation?.profile || "none",
  );
  const [skipPreview, setSkipPreview] = useState<boolean>(
    settings.screenTranslation?.skipPreview || false,
  );
  const [keepMainWindowHidden, setKeepMainWindowHidden] = useState<boolean>(
    settings.screenTranslation?.keepMainWindowHiddenAfterCapture || false,
  );

  // Sync state if settings update from external sources (e.g. Floating Panel or Settings View)
  useEffect(() => {
    if (
      settings.screenTranslation?.ocrLanguage &&
      settings.screenTranslation.ocrLanguage !== ocrLanguage
    ) {
      setOcrLanguage(settings.screenTranslation.ocrLanguage);
    }
  }, [settings.screenTranslation?.ocrLanguage]);

  useEffect(() => {
    if (
      settings.targetLanguages?.[0] &&
      settings.targetLanguages[0] !== targetLanguage
    ) {
      setTargetLanguage(settings.targetLanguages[0]);
    }
  }, [settings.targetLanguages]);

  useEffect(() => {
    if (
      settings.screenTranslation?.profile &&
      settings.screenTranslation.profile !== profile
    ) {
      setProfile(settings.screenTranslation.profile);
    }
  }, [settings.screenTranslation?.profile]);

  const handleOcrLanguageChange = (newLang: string) => {
    setOcrLanguage(newLang);
    updateSettings({
      screenTranslation: {
        ...settings.screenTranslation,
        ocrLanguage: newLang,
      },
    });
  };

  const handleTargetLanguageChange = (newTarget: string) => {
    setTargetLanguage(newTarget);
    updateSettings({
      targetLanguages: [newTarget],
    });
  };

  const handleProfileChange = (newProfile: OcrProfile) => {
    setProfile(newProfile);
    updateSettings({
      screenTranslation: {
        ...settings.screenTranslation,
        profile: newProfile,
      },
    });
  };

  useEffect(() => {
    if (
      settings.screenTranslation?.keepMainWindowHiddenAfterCapture !== undefined
    ) {
      setKeepMainWindowHidden(
        settings.screenTranslation.keepMainWindowHiddenAfterCapture,
      );
    }
  }, [settings.screenTranslation?.keepMainWindowHiddenAfterCapture]);

  // Results State
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [capturedImageData, setCapturedImageData] = useState<string | null>(
    null,
  );
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [editedText, setEditedText] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [translatedText, setTranslatedText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Continuous Mode State
  const [continuousState, setContinuousState] = useState<string>("idle");
  const [continuousStats, setContinuousStats] = useState<ContinuousOcrStats>({
    state: "idle",
    capturedCount: 0,
    recognizedCount: 0,
    translatedCount: 0,
    skippedCount: 0,
    averageDurationMs: 0,
  });
  const [continuousRegion, setContinuousRegion] = useState<any | null>(null);
  const [continuousHistory, setContinuousHistory] = useState<OcrHistoryItem[]>(
    [],
  );
  const [intervalMs, setIntervalMs] = useState<number>(
    settings.screenTranslation?.continuousIntervalMs || 2000,
  );
  const [changeThreshold, setChangeThreshold] = useState<number>(
    settings.screenTranslation?.changeThreshold ?? 0.15,
  );

  // History State
  const [historyItems, setHistoryItems] = useState<OcrHistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [, startTransition] = useTransition();

  // Load OCR Providers and History on mount
  useEffect(() => {
    if (window.electronAPI?.screenTranslation) {
      window.electronAPI.screenTranslation
        .getOcrProviders()
        .then((providers) => {
          setOcrProviders(providers);
          if (
            providers.length > 0 &&
            !providers.some((p) => p.id === selectedProvider)
          ) {
            setSelectedProvider(providers[0].id);
          }
        })
        .catch((err) => log.error("Failed to get OCR providers", err));

      loadHistory();

      // Subscribe to continuous status & events
      const unsubStatus =
        window.electronAPI.screenTranslation.onContinuousStatus?.((data) => {
          setContinuousState(data.state);
          setContinuousStats(data.stats);
        });

      const unsubEvent =
        window.electronAPI.screenTranslation.onContinuousEvent?.((data) => {
          if (data.isChange && data.historyItem) {
            setContinuousHistory((prev) =>
              [data.historyItem, ...prev].slice(0, 30),
            );
          }
        });

      return () => {
        if (unsubStatus) unsubStatus();
        if (unsubEvent) unsubEvent();
      };
    }
  }, []);

  const loadHistory = useCallback(async (query?: string) => {
    if (window.electronAPI?.screenTranslation) {
      try {
        const items = await window.electronAPI.screenTranslation.getHistory(
          query ? { query, limit: 100 } : { limit: 100 },
        );
        startTransition(() => {
          setHistoryItems(items);
        });
      } catch (err) {
        log.error("Failed to load history", err);
      }
    }
  }, []);

  // Trigger Region Selection & Capture
  const handleStartCapture = async () => {
    setErrorMessage(null);
    setIsCapturing(true);

    try {
      if (!window.electronAPI?.screenTranslation) {
        throw new Error(
          t(
            "ocr.messages.bridgeUnavailable",
            "Screen translation bridge is not available",
          ),
        );
      }

      // Step 1: Open interactive transparent selection overlay
      const region = await window.electronAPI.screenTranslation.selectRegion();
      if (!region) {
        setIsCapturing(false);
        return; // User cancelled with Escape
      }

      // Step 2: Capture, OCR and translate
      setIsTranslating(true);
      const effectiveSource =
        ocrLanguage && ocrLanguage !== "auto" ? ocrLanguage : "auto";
      const res = await window.electronAPI.screenTranslation.translateRegion({
        region,
        ocrLanguage,
        targetLanguages: [targetLanguage],
        sourceLanguage: effectiveSource,
        ocrProviderId: selectedProvider,
        translationProviderId: settings.translationProvider || "google-web",
        profile,
        skipPreview,
        keepMainWindowHidden,
      });

      setRecognizedText(res.ocrResult.text);
      setEditedText(res.ocrResult.text);
      setConfidence(res.ocrResult.confidence);
      setDurationMs(
        res.translationResult.durationMs + res.ocrResult.durationMs,
      );
      setTranslatedText(res.translationResult.translatedText);

      // Reload history list
      loadHistory();
    } catch (err: any) {
      log.error("Capture failed", err);
      setErrorMessage(
        err.message || t("ocr.messages.captureFailed", "Capture failed"),
      );
    } finally {
      setIsCapturing(false);
      setIsTranslating(false);
    }
  };

  // Re-translate after user manual correction
  const handleRetranslate = async () => {
    if (!editedText.trim() || !window.electronAPI?.translation) return;

    setIsTranslating(true);
    setErrorMessage(null);

    try {
      const effectiveSource =
        ocrLanguage && ocrLanguage !== "auto" ? ocrLanguage : "auto";
      const res = await window.electronAPI.translation.translate({
        text: editedText.trim(),
        sourceLanguage: effectiveSource,
        targetLanguage,
        priority: "high",
      });
      setTranslatedText(res.translatedText);
      setDurationMs(res.durationMs);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          t("ocr.messages.retranslateFailed", "Retranslation failed"),
      );
    } finally {
      setIsTranslating(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Continuous Mode Handlers
  const handleSelectContinuousRegion = async () => {
    try {
      const region = await window.electronAPI?.screenTranslation.selectRegion();
      if (region) {
        setContinuousRegion(region);
      }
    } catch (err) {
      log.error("Failed to select continuous region", err);
    }
  };

  const handleToggleContinuous = async () => {
    if (!continuousRegion) {
      setErrorMessage(
        t(
          "ocr.messages.selectRegionFirst",
          "Please select a screen region first.",
        ),
      );
      return;
    }

    if (
      continuousState === "capturing" ||
      continuousState === "recognizing" ||
      continuousState === "translating"
    ) {
      await window.electronAPI?.screenTranslation.stopContinuous();
    } else {
      setErrorMessage(null);
      const effectiveSource =
        ocrLanguage && ocrLanguage !== "auto" ? ocrLanguage : "auto";
      await window.electronAPI?.screenTranslation.startContinuous({
        region: continuousRegion,
        intervalMs,
        changeThreshold,
        ignoreUnchanged: true,
        translateOnlyDiff: false,
        ocrProviderId: selectedProvider,
        ocrLanguage,
        translationProviderId: settings.translationProvider || "google-web",
        sourceLanguage: effectiveSource,
        targetLanguages: [targetLanguage],
        profile,
      });
    }
  };

  const handlePauseResumeContinuous = async () => {
    if (continuousState === "paused") {
      await window.electronAPI?.screenTranslation.resumeContinuous();
    } else {
      await window.electronAPI?.screenTranslation.pauseContinuous();
    }
  };

  // History Actions
  const handleDeleteHistoryItem = async (id: string) => {
    await window.electronAPI?.screenTranslation.deleteHistoryItem(id);
    loadHistory(historySearch);
  };

  const handleClearHistory = async () => {
    if (
      confirm(
        t(
          "ocr.history.clearConfirm",
          "Are you sure you want to clear all OCR translation history?",
        ),
      )
    ) {
      await window.electronAPI?.screenTranslation.clearHistory();
      setHistoryItems([]);
    }
  };

  const handleExportHistory = (format: "txt" | "json") => {
    if (historyItems.length === 0) return;

    let content = "";
    let mime = "text/plain";
    let ext = "txt";

    if (format === "json") {
      content = JSON.stringify(historyItems, null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      content = historyItems
        .map(
          (h) =>
            `[${new Date(h.createdAt).toLocaleString()}] (${h.sourceLanguage} -> ${h.targetLanguage})\nOriginal: ${h.originalText}\nTranslated: ${h.translatedText}\n`,
        )
        .join("\n---\n\n");
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echolingo_ocr_history_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 space-y-5">
      {/* 1. Feature Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-primary border border-primary/20">
              <Crop className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t("ocr.title", "On-Screen OCR & Real-Time Translation")}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              "ocr.subtitle",
              "Capture dialogue from video games, stream subtitles, documents, or apps and translate in place.",
            )}
          </p>
        </div>

        {/* Global Shortcut Hint & Quick Trigger */}
        <div className="flex items-center gap-2.5">
          <GlassButton
            variant="primary"
            size="md"
            icon={<Crop className="w-4 h-4" />}
            isLoading={isCapturing || isTranslating}
            onClick={handleStartCapture}
            className="shadow-lg shadow-primary/20"
          >
            <span>{t("ocr.captureRegion", "Capture Region")}</span>
            <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 rounded text-white border border-white/30">
              Ctrl+Shift+T
            </kbd>
          </GlassButton>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-glass-border pb-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("capture")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              activeTab === "capture"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-glass-subtle border border-transparent"
            }`}
          >
            {t("ocr.tabs.capture", "One-Time Capture")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("continuous")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === "continuous"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-glass-subtle border border-transparent"
            }`}
          >
            <span>{t("ocr.tabs.continuous", "Continuous Monitoring")}</span>
            {continuousState !== "idle" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              loadHistory(historySearch);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === "history"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-glass-subtle border border-transparent"
            }`}
          >
            <span>{t("ocr.tabs.history", "History")}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-glass-subtle border border-glass-border">
              {historyItems.length}
            </span>
          </button>
        </div>

        {/* Engine and Languages Pills */}
        <div className="hidden lg:flex items-center gap-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("ocr.engineLabel", "Engine:")}
            </span>
            <GlassSelect
              size="xs"
              containerClassName="w-auto"
              className="min-w-[155px]"
              value={selectedProvider}
              onChange={(e) =>
                setSelectedProvider(e.target.value as OcrProviderId)
              }
            >
              {ocrProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </GlassSelect>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("ocr.ocrLangLabel", "OCR Lang:")}
            </span>
            <GlassSelect
              size="xs"
              containerClassName="w-auto"
              className="min-w-[135px]"
              value={ocrLanguage}
              onChange={(e) => handleOcrLanguageChange(e.target.value)}
            >
              {OCR_SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}{" "}
                  {l.nativeName && l.nativeName !== l.name
                    ? `(${l.nativeName})`
                    : ""}
                </option>
              ))}
            </GlassSelect>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("ocr.targetLabel", "Target:")}
            </span>
            <GlassSelect
              size="xs"
              containerClassName="w-auto"
              className="min-w-[110px]"
              value={targetLanguage}
              onChange={(e) => handleTargetLanguageChange(e.target.value)}
            >
              {TARGET_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} {l.nativeName ? `(${l.nativeName})` : ""}
                </option>
              ))}
            </GlassSelect>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="hover:underline text-[11px]"
          >
            {t("ocr.messages.dismiss", "Dismiss")}
          </button>
        </div>
      )}

      {/* 3. Tab Contents */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* ================= TAB 1: ONE-TIME CAPTURE ================= */}
        {activeTab === "capture" && (
          <div className="space-y-4">
            {/* Control Bar & Presets */}
            <GlassCard variant="subtle" className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    {t("ocr.presets.label", "Preprocessing Preset")}
                  </label>
                  <GlassSelect
                    value={profile}
                    onChange={(e) =>
                      handleProfileChange(e.target.value as OcrProfile)
                    }
                  >
                    <option value="none">
                      {t("ocr.presets.none", "No Preprocessing (Default)")}
                    </option>
                    <option value="general">
                      {t(
                        "ocr.presets.general",
                        "General Desktop Text",
                      )}
                    </option>
                    <option value="game-subtitles">
                      {t(
                        "ocr.presets.gameSubtitles",
                        "Game Subtitles (High Contrast)",
                      )}
                    </option>
                    <option value="small-ui">
                      {t("ocr.presets.smallUi", "Small UI Text (2x Upscale)")}
                    </option>
                    <option value="high-contrast">
                      {t(
                        "ocr.presets.highContrast",
                        "High Contrast (Otsu Binarize)",
                      )}
                    </option>
                    <option value="cjk">
                      {t("ocr.presets.cjk", "Japanese & Chinese Characters")}
                    </option>
                  </GlassSelect>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    {t("ocr.ocrLangHint", "OCR Language Hint")}
                  </label>
                  <GlassSelect
                    value={ocrLanguage}
                    onChange={(e) => handleOcrLanguageChange(e.target.value)}
                  >
                    {OCR_SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}{" "}
                        {l.nativeName && l.nativeName !== l.name
                          ? `(${l.nativeName})`
                          : ""}
                      </option>
                    ))}
                  </GlassSelect>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    {t("ocr.translateInto", "Translate Into")}
                  </label>
                  <GlassSelect
                    value={targetLanguage}
                    onChange={(e) => handleTargetLanguageChange(e.target.value)}
                  >
                    {TARGET_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name} {l.nativeName ? `(${l.nativeName})` : ""}
                      </option>
                    ))}
                  </GlassSelect>
                </div>

                <div className="flex flex-col justify-end gap-1.5 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      checked={skipPreview}
                      onChange={(e) => setSkipPreview(e.target.checked)}
                      className="rounded accent-primary w-4 h-4 cursor-pointer"
                    />
                    <span className="text-foreground">
                      {t(
                        "ocr.skipPreview",
                        "Skip preview & translate instantly",
                      )}
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      checked={keepMainWindowHidden}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setKeepMainWindowHidden(val);
                        updateSettings({
                          screenTranslation: {
                            ...settings.screenTranslation,
                            keepMainWindowHiddenAfterCapture: val,
                          },
                        });
                      }}
                      className="rounded accent-primary w-4 h-4 cursor-pointer"
                    />
                    <span className="text-foreground">
                      {t(
                        "ocr.keepMainWindowHidden",
                        "Keep main window hidden after capture",
                      )}
                    </span>
                  </label>
                </div>
              </div>
            </GlassCard>

            {/* Results Grid: OCR Editor & Translation Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Recognized OCR Text & Manual Correction */}
              <GlassCard className="p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {t(
                        "ocr.editor.recognizedTitle",
                        "Recognized Text (Editable)",
                      )}
                    </span>
                    {confidence > 0 && (
                      <GlassBadge
                        variant={confidence > 0.8 ? "success" : "warning"}
                      >
                        {Math.round(confidence * 100)}%{" "}
                        {t("ocr.editor.conf", "Conf")}
                      </GlassBadge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {recognizedText && (
                      <GlassButton
                        variant="subtle"
                        size="xs"
                        icon={
                          copiedKey === "ocr" ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )
                        }
                        onClick={() => handleCopy(editedText, "ocr")}
                      >
                        {copiedKey === "ocr"
                          ? t("ocr.editor.copied", "Copied")
                          : t("ocr.editor.copy", "Copy")}
                      </GlassButton>
                    )}
                  </div>
                </div>

                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  placeholder={t(
                    "ocr.editor.placeholder",
                    "Captured OCR text will appear here. You can manually edit or correct any words before re-translating...",
                  )}
                  rows={8}
                  className="glass-input w-full flex-1 p-3 text-xs text-foreground font-mono resize-none leading-relaxed"
                />

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>
                    {editedText.length}{" "}
                    {t("ocr.editor.characters", "characters")} •{" "}
                    {editedText.trim()
                      ? editedText.trim().split(/\s+/).length
                      : 0}{" "}
                    {t("ocr.editor.words", "words")}
                  </span>

                  <GlassButton
                    variant="glass"
                    size="xs"
                    icon={<RotateCw className="w-3 h-3" />}
                    isLoading={isTranslating}
                    disabled={!editedText.trim()}
                    onClick={handleRetranslate}
                  >
                    {t("ocr.editor.retranslate", "Re-Translate")}
                  </GlassButton>
                </div>
              </GlassCard>

              {/* Right Column: Translated Result Output */}
              <GlassCard className="p-4 flex flex-col space-y-3 bg-gradient-to-br from-glass to-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {t("ocr.result.title", "Translation")} (
                      {targetLanguage.toUpperCase()})
                    </span>
                    {durationMs > 0 && (
                      <GlassBadge variant="neutral">
                        <Clock className="w-2.5 h-2.5 mr-1" />
                        {durationMs}ms
                      </GlassBadge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {translatedText && (
                      <>
                        <GlassButton
                          variant="subtle"
                          size="xs"
                          icon={
                            copiedKey === "trans" ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )
                          }
                          onClick={() => handleCopy(translatedText, "trans")}
                        >
                          {copiedKey === "trans"
                            ? t("ocr.result.copied", "Copied")
                            : t("ocr.result.copy", "Copy")}
                        </GlassButton>
                        <GlassButton
                          variant="subtle"
                          size="xs"
                          onClick={() =>
                            handleCopy(
                              `${editedText}\n\n${translatedText}`,
                              "both",
                            )
                          }
                        >
                          {copiedKey === "both"
                            ? t("ocr.result.copiedBoth", "Copied Both")
                            : t("ocr.result.copyBoth", "Copy Both")}
                        </GlassButton>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-1 glass-panel-subtle p-3 overflow-y-auto">
                  {translatedText ? (
                    <p className="text-sm font-medium text-foreground leading-relaxed whitespace-pre-wrap select-text">
                      {translatedText}
                    </p>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                      <Sparkles className="w-8 h-8 opacity-20 mb-2" />
                      <p className="text-xs font-medium">
                        {t("ocr.result.readyTitle", "Ready to translate")}
                      </p>
                      <p className="text-[11px] text-muted-foreground/75 mt-0.5">
                        {t(
                          "ocr.result.readyDesc",
                          'Press "Capture Region" or press Ctrl+Shift+T anytime',
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Floating panel trigger */}
                {translatedText && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>
                      {t("ocr.result.provider", "Provider:")}{" "}
                      {settings.translationProvider || "Google Web"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const effectiveSource =
                          ocrLanguage && ocrLanguage !== "auto"
                            ? ocrLanguage
                            : "auto";
                        window.electronAPI?.screenTranslation.showFloatingPanel(
                          {
                            originalText: editedText,
                            translatedText,
                            sourceLanguage: effectiveSource,
                            targetLanguage,
                            confidence,
                            durationMs,
                          },
                        );
                      }}
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>
                        {t(
                          "ocr.result.openFloatingPanel",
                          "Open Floating Panel",
                        )}
                      </span>
                    </button>
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        )}

        {/* ================= TAB 2: CONTINUOUS MONITORING ================= */}
        {activeTab === "continuous" && (
          <div className="space-y-4">
            <GlassCard variant="subtle" className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <span>
                      {t(
                        "ocr.continuous.title",
                        "Real-Time Screen Text Monitoring",
                      )}
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t(
                      "ocr.continuous.subtitle",
                      "Continuously scans a target region (e.g. video subtitles or game dialogue) and translates only meaningful changes.",
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <GlassButton
                    variant="glass"
                    size="sm"
                    icon={<Crop className="w-3.5 h-3.5" />}
                    onClick={handleSelectContinuousRegion}
                  >
                    {continuousRegion
                      ? t("ocr.continuous.changeRegion", "Change Region")
                      : t("ocr.continuous.selectRegion", "Select Region")}
                  </GlassButton>

                  <GlassButton
                    variant={
                      continuousState !== "idle" &&
                      continuousState !== "stopping"
                        ? "destructive"
                        : "primary"
                    }
                    size="sm"
                    icon={
                      continuousState !== "idle" &&
                      continuousState !== "stopping" ? (
                        <Square className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )
                    }
                    onClick={handleToggleContinuous}
                  >
                    {continuousState !== "idle" &&
                    continuousState !== "stopping"
                      ? t("ocr.continuous.stopMonitoring", "Stop Monitoring")
                      : t("ocr.continuous.startMonitoring", "Start Monitoring")}
                  </GlassButton>

                  {continuousState !== "idle" &&
                    continuousState !== "stopping" && (
                      <GlassButton
                        variant="glass"
                        size="sm"
                        icon={
                          continuousState === "paused" ? (
                            <Play className="w-3.5 h-3.5" />
                          ) : (
                            <Pause className="w-3.5 h-3.5" />
                          )
                        }
                        onClick={handlePauseResumeContinuous}
                      >
                        {continuousState === "paused"
                          ? t("ocr.continuous.resume", "Resume")
                          : t("ocr.continuous.pause", "Pause")}
                      </GlassButton>
                    )}
                </div>
              </div>

              {/* Sliders for Performance & Deduplication */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-glass-border">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t("ocr.continuous.interval", "Capture Interval")}
                    </span>
                    <span className="font-semibold text-foreground">
                      {(intervalMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={5000}
                    step={250}
                    value={intervalMs}
                    onChange={(e) => setIntervalMs(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/75">
                    <span>{t("ocr.continuous.fast", "Fast (0.5s)")}</span>
                    <span>
                      {t("ocr.continuous.balanced", "Balanced (2.0s)")}
                    </span>
                    <span>{t("ocr.continuous.eco", "Eco (5.0s)")}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t(
                        "ocr.continuous.sensitivity",
                        "Change Sensitivity Threshold",
                      )}
                    </span>
                    <span className="font-semibold text-foreground">
                      {Math.round(changeThreshold * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={0.5}
                    step={0.05}
                    value={changeThreshold}
                    onChange={(e) => setChangeThreshold(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/75">
                    <span>
                      {t("ocr.continuous.sensitive", "Sensitive (5%)")}
                    </span>
                    <span>{t("ocr.continuous.normal", "Normal (15%)")}</span>
                    <span>
                      {t("ocr.continuous.distinct", "Distinct Only (50%)")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
                <div className="p-2.5 rounded-xl bg-glass border border-glass-border text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    {t("ocr.continuous.state", "State")}
                  </span>
                  <p className="text-sm font-bold text-primary capitalize mt-0.5">
                    {t(
                      `ocr.continuous.states.${continuousState}`,
                      continuousState,
                    )}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-glass border border-glass-border text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    {t("ocr.continuous.framesScanned", "Frames Scanned")}
                  </span>
                  <p className="text-sm font-bold text-foreground mt-0.5">
                    {continuousStats.capturedCount}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-glass border border-glass-border text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    {t("ocr.continuous.translated", "Translated")}
                  </span>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">
                    {continuousStats.translatedCount}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-glass border border-glass-border text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    {t(
                      "ocr.continuous.duplicatesSkipped",
                      "Duplicates Skipped",
                    )}
                  </span>
                  <p className="text-sm font-bold text-amber-400 mt-0.5">
                    {continuousStats.skippedCount}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-glass border border-glass-border text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    {t("ocr.continuous.avgLatency", "Avg Latency")}
                  </span>
                  <p className="text-sm font-bold text-foreground mt-0.5">
                    {continuousStats.averageDurationMs}ms
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Continuous Live Translation Stream */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">
                {t("ocr.continuous.streamChanges", "Detected Stream Changes")}
              </h4>
              {continuousHistory.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {continuousHistory.map((item) => (
                    <GlassCard
                      key={item.id}
                      variant="subtle"
                      className="p-3 text-xs space-y-1"
                    >
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </span>
                        <span>
                          {Math.round(item.confidence * 100)}%{" "}
                          {t("ocr.editor.conf", "Conf")} • {item.durationMs}ms
                        </span>
                      </div>
                      <p className="text-muted-foreground font-mono text-[11px]">
                        {item.originalText}
                      </p>
                      <p className="text-foreground font-semibold text-xs text-primary">
                        {item.translatedText}
                      </p>
                    </GlassCard>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground bg-glass-subtle rounded-xl border border-glass-border">
                  {t(
                    "ocr.continuous.emptyStream",
                    "Start continuous monitoring to view real-time text detections.",
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: HISTORY ================= */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 max-w-sm">
                <GlassInput
                  placeholder={t(
                    "ocr.history.searchPlaceholder",
                    "Search captured text or translations...",
                  )}
                  value={historySearch}
                  leftIcon={<Search className="w-3.5 h-3.5" />}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    loadHistory(e.target.value);
                  }}
                  onClear={() => {
                    setHistorySearch("");
                    loadHistory("");
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <GlassButton
                  variant="subtle"
                  size="xs"
                  icon={<Download className="w-3 h-3" />}
                  onClick={() => handleExportHistory("txt")}
                >
                  {t("ocr.history.exportTxt", "Export TXT")}
                </GlassButton>
                <GlassButton
                  variant="subtle"
                  size="xs"
                  icon={<Download className="w-3 h-3" />}
                  onClick={() => handleExportHistory("json")}
                >
                  {t("ocr.history.exportJson", "Export JSON")}
                </GlassButton>
                <GlassButton
                  variant="destructive"
                  size="xs"
                  icon={<Trash2 className="w-3 h-3" />}
                  onClick={handleClearHistory}
                >
                  {t("ocr.history.clearHistory", "Clear History")}
                </GlassButton>
              </div>
            </div>

            {historyItems.length > 0 ? (
              <div className="space-y-2.5">
                {historyItems.map((item) => (
                  <GlassCard key={item.id} className="p-3.5 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                        <GlassBadge variant="neutral">
                          {item.ocrLanguage.toUpperCase()} →{" "}
                          {item.targetLanguage.toUpperCase()}
                        </GlassBadge>
                        <GlassBadge variant="neutral">
                          {item.ocrProvider}
                        </GlassBadge>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              `${item.originalText}\n\n${item.translatedText}`,
                              item.id,
                            )
                          }
                          className="p-1 hover:text-foreground text-muted-foreground"
                          title={t(
                            "ocr.history.copyBothTooltip",
                            "Copy Original and Translation",
                          )}
                        >
                          {copiedKey === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistoryItem(item.id)}
                          className="p-1 hover:text-destructive text-muted-foreground"
                          title={t(
                            "ocr.history.deleteTooltip",
                            "Delete Record",
                          )}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-glass-subtle p-2.5 rounded-lg border border-glass-border/40">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                          {t("ocr.history.originalText", "Original Text")}
                        </span>
                        <p className="text-foreground/90 font-mono text-[11px] whitespace-pre-wrap">
                          {item.originalText}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-primary block mb-0.5">
                          {t("ocr.history.translation", "Translation")}
                        </span>
                        <p className="text-foreground font-medium text-xs whitespace-pre-wrap">
                          {item.translatedText}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-muted-foreground bg-glass-subtle rounded-2xl border border-glass-border">
                <History className="w-8 h-8 opacity-25 mx-auto mb-2" />
                <p className="font-medium text-foreground">
                  {t("ocr.history.noHistory", "No translation history found")}
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-1">
                  {t(
                    "ocr.history.noHistoryDesc",
                    "Captured OCR translations will be persisted here for easy searching and export.",
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
