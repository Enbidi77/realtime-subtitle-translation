import React from "react";
import { OcrProfile } from "@echo-lingo/contracts";
import {
  OCR_SUPPORTED_LANGUAGES,
  TARGET_LANGUAGES,
} from "@echo-lingo/config";
import {
  GlassButton,
  GlassCard,
  GlassBadge,
  GlassSelect,
  GlassCheckbox,
} from "@/components/ui/index.js";
import { useSettingsStore } from "@/stores/settings-store.js";
import { useI18n } from "@/app/i18n/index.js";
import {
  Copy,
  Check,
  RotateCw,
  Sparkles,
  Clock,
  ExternalLink,
} from "lucide-react";

export interface CaptureTabProps {
  profile: OcrProfile;
  onProfileChange: (profile: OcrProfile) => void;
  ocrLanguage: string;
  onOcrLanguageChange: (lang: string) => void;
  targetLanguage: string;
  onTargetLanguageChange: (lang: string) => void;
  skipPreview: boolean;
  onSkipPreviewChange: (skip: boolean) => void;
  keepMainWindowHidden: boolean;
  onKeepMainWindowHiddenChange: (keep: boolean) => void;
  recognizedText: string;
  editedText: string;
  onEditedTextChange: (text: string) => void;
  confidence: number;
  durationMs: number;
  translatedText: string;
  isTranslating: boolean;
  onRetranslate: () => void;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}

export const CaptureTab: React.FC<CaptureTabProps> = ({
  profile,
  onProfileChange,
  ocrLanguage,
  onOcrLanguageChange,
  targetLanguage,
  onTargetLanguageChange,
  skipPreview,
  onSkipPreviewChange,
  keepMainWindowHidden,
  onKeepMainWindowHiddenChange,
  recognizedText,
  editedText,
  onEditedTextChange,
  confidence,
  durationMs,
  translatedText,
  isTranslating,
  onRetranslate,
  copiedKey,
  onCopy,
}) => {
  const { t } = useI18n();
  const { settings } = useSettingsStore();

  return (
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
              onChange={(e) => onProfileChange(e.target.value as OcrProfile)}
            >
              <option value="none">
                {t("ocr.presets.none", "No Preprocessing (Default)")}
              </option>
              <option value="general">
                {t("ocr.presets.general", "General Desktop Text")}
              </option>
              <option value="handwritten">
                {t(
                  "ocr.presets.handwritten",
                  "Handwritten & Notes (Adaptive Filter)",
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
              onChange={(e) => onOcrLanguageChange(e.target.value)}
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
              onChange={(e) => onTargetLanguageChange(e.target.value)}
            >
              {TARGET_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} {l.nativeName ? `(${l.nativeName})` : ""}
                </option>
              ))}
            </GlassSelect>
          </div>

          <div className="flex flex-col justify-end gap-2 pb-1">
            <GlassCheckbox
              checked={skipPreview}
              onChange={(e) => onSkipPreviewChange(e.target.checked)}
              label={t("ocr.skipPreview", "Skip preview & translate instantly")}
              size="sm"
            />

            <GlassCheckbox
              checked={keepMainWindowHidden}
              onChange={(e) => onKeepMainWindowHiddenChange(e.target.checked)}
              label={t(
                "ocr.keepMainWindowHidden",
                "Keep main window hidden after capture",
              )}
              size="sm"
            />
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
                  onClick={() => onCopy(editedText, "ocr")}
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
            onChange={(e) => onEditedTextChange(e.target.value)}
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
              onClick={onRetranslate}
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
                    onClick={() => onCopy(translatedText, "trans")}
                  >
                    {copiedKey === "trans"
                      ? t("ocr.result.copied", "Copied")
                      : t("ocr.result.copy", "Copy")}
                  </GlassButton>
                  <GlassButton
                    variant="subtle"
                    size="xs"
                    onClick={() =>
                      onCopy(
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
                  window.electronAPI?.screenTranslation.showFloatingPanel({
                    originalText: editedText,
                    translatedText,
                    sourceLanguage: effectiveSource,
                    targetLanguage,
                    confidence,
                    durationMs,
                  });
                }}
                className="text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span>
                  {t("ocr.result.openFloatingPanel", "Open Floating Panel")}
                </span>
              </button>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};
