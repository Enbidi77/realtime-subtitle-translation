import React, { useEffect, useState } from "react";
import { SubtitleSegment } from "@echo-lingo/contracts";
import { useI18n } from "@/app/i18n/index.js";
import { formatDisplayTime } from "@echo-lingo/subtitle-core";
import { GlassCard } from "@/components/ui/GlassCard.js";
import { GlassButton } from "@/components/ui/GlassButton.js";
import { GlassInput } from "@/components/ui/GlassInput.js";
import { GlassBadge } from "@/components/ui/GlassBadge.js";
import { createRendererLogger } from "@echo-lingo/logger";
import { History, Search, Copy, Check, Clock } from "lucide-react";

const log = createRendererLogger("TranslationHistoryView");

export const TranslationHistoryView: React.FC = () => {
  const { t } = useI18n();
  const [allSegments, setAllSegments] = useState<SubtitleSegment[]>([]);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      if (window.electronAPI) {
        try {
          const sessions = await window.electronAPI.sessions.list();
          const segsPromises = sessions
            .slice(0, 20)
            .map((s) => window.electronAPI.sessions.getSegments(s.id));
          const results = await Promise.all(segsPromises);
          const flattened = results
            .flat()
            .sort((a, b) => b.createdAt - a.createdAt);
          setAllSegments(flattened);
        } catch (e) {
          log.error("Failed to load translation history:", e);
        }
      }
    }
    loadAll();
  }, []);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filtered = allSegments.filter((seg) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (seg.originalText.toLowerCase().includes(q)) return true;
    for (const val of Object.values(seg.translations)) {
      if (val.toLowerCase().includes(q)) return true;
    }
    return false;
  });

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-transparent p-6 md:p-8 space-y-5 max-w-5xl mx-auto">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <span>{t("history.title", "Translation History")}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              "history.subtitle",
              "Searchable historical archive of all transcribed speech segments.",
            )}
          </p>
        </div>

        <div className="w-full sm:w-80">
          <GlassInput
            type="text"
            placeholder={t(
              "history.searchPlaceholder",
              "Search keywords or translations...",
            )}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            leftIcon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
      </div>

      {/* Segments Stream */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filtered.length === 0 ? (
          <GlassCard className="h-64 flex flex-col items-center justify-center text-xs text-muted-foreground space-y-2">
            <History className="w-8 h-8 opacity-40 text-primary" />
            <span>
              {t("history.noHistory", "No translation history found.")}
            </span>
          </GlassCard>
        ) : (
          filtered.map((seg) => {
            const trans = Object.values(seg.translations)[0] || "";
            const isCopied = copiedId === seg.id;

            return (
              <GlassCard
                key={seg.id}
                variant="default"
                className="p-4 flex items-start justify-between gap-4 hover:border-glass-border-elevated"
              >
                <div className="space-y-1.5 overflow-hidden">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                    <span className="px-2 py-0.5 rounded bg-glass-subtle border border-glass-border/40">
                      {new Date(seg.createdAt).toLocaleDateString()} •{" "}
                      {formatDisplayTime(seg.startTime)}
                    </span>
                    <span>•</span>
                    <span className="capitalize font-sans font-medium text-foreground/80">
                      {seg.sourceLanguage}
                    </span>
                  </div>

                  <div className="text-xs text-foreground font-normal leading-relaxed">
                    {seg.originalText}
                  </div>

                  {trans && (
                    <div className="text-xs font-semibold text-primary leading-relaxed">
                      {trans}
                    </div>
                  )}
                </div>

                <GlassButton
                  variant="glass"
                  size="icon-sm"
                  onClick={() =>
                    handleCopy(seg.id, `${seg.originalText}\n${trans}`)
                  }
                  title={t("history.copySegment", "Copy segment")}
                  aria-label={t("history.copySegment", "Copy segment")}
                  className="shrink-0"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </GlassButton>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
};
