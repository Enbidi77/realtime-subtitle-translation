import React from "react";
import { OcrHistoryItem } from "@echo-lingo/contracts";
import {
  GlassButton,
  GlassCard,
  GlassBadge,
  GlassInput,
} from "@/components/ui/index.js";
import { useI18n } from "@/app/i18n/index.js";
import {
  Download,
  Trash2,
  Search,
  Copy,
  Check,
  History,
} from "lucide-react";

export interface HistoryTabProps {
  historyItems: OcrHistoryItem[];
  historySearch: string;
  onSearchChange: (query: string) => void;
  onClearHistory: () => void;
  onExportHistory: (format: "txt" | "json") => void;
  onDeleteItem: (id: string) => void;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  historyItems,
  historySearch,
  onSearchChange,
  onClearHistory,
  onExportHistory,
  onDeleteItem,
  copiedKey,
  onCopy,
}) => {
  const { t } = useI18n();

  return (
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
            onChange={(e) => onSearchChange(e.target.value)}
            onClear={() => onSearchChange("")}
          />
        </div>

        <div className="flex items-center gap-2">
          <GlassButton
            variant="subtle"
            size="xs"
            icon={<Download className="w-3 h-3" />}
            onClick={() => onExportHistory("txt")}
          >
            {t("ocr.history.exportTxt", "Export TXT")}
          </GlassButton>
          <GlassButton
            variant="subtle"
            size="xs"
            icon={<Download className="w-3 h-3" />}
            onClick={() => onExportHistory("json")}
          >
            {t("ocr.history.exportJson", "Export JSON")}
          </GlassButton>
          <GlassButton
            variant="destructive"
            size="xs"
            icon={<Trash2 className="w-3 h-3" />}
            onClick={onClearHistory}
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
                      onCopy(
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
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1 hover:text-destructive text-muted-foreground"
                    title={t("ocr.history.deleteTooltip", "Delete Record")}
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
  );
};
