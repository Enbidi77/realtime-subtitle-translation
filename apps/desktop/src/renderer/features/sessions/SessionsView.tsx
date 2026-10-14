import React, { useEffect, useState } from "react";
import { useSessionStore } from "@/stores/session-store.js";
import { useNavigationStore } from "@/stores/navigation-store.js";
import { useI18n } from "@/app/i18n/index.js";
import {
  SessionMetadata,
  SubtitleSegment,
  SubtitleExportFormat,
} from "@echo-lingo/contracts";
import { formatDisplayTime } from "@echo-lingo/subtitle-core";
import { GlassCard } from "@/components/ui/GlassCard.js";
import { GlassButton } from "@/components/ui/GlassButton.js";
import { GlassInput } from "@/components/ui/GlassInput.js";
import { GlassSelect } from "@/components/ui/GlassSelect.js";
import { GlassBadge } from "@/components/ui/GlassBadge.js";
import { GlassModal } from "@/components/ui/GlassModal.js";
import {
  FolderKanban,
  Download,
  Upload,
  Trash2,
  Edit2,
  Clock,
  Layers,
  Search,
  Check,
  ExternalLink,
  Layers3,
} from "lucide-react";

export const SessionsView: React.FC = () => {
  const { t } = useI18n();
  const { setActivePage } = useNavigationStore();
  const { loadSession } = useSessionStore();

  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Export dialog state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<SubtitleExportFormat>("srt");
  const [includeOriginal, setIncludeOriginal] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Edit segment modal
  const [editingSegment, setEditingSegment] = useState<SubtitleSegment | null>(
    null,
  );
  const [editOriginalText, setEditOriginalText] = useState("");
  const [editTransText, setEditTransText] = useState("");

  const refreshSessions = async () => {
    if (window.electronAPI) {
      try {
        const list = await window.electronAPI.sessions.list();
        setSessions(list);
        if (list.length > 0 && !selectedSessionId) {
          setSelectedSessionId(list[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    refreshSessions();
  }, []);

  useEffect(() => {
    async function loadSegments() {
      if (selectedSessionId && window.electronAPI) {
        try {
          const segs =
            await window.electronAPI.sessions.getSegments(selectedSessionId);
          setSegments(segs);
        } catch (e) {
          console.error(e);
        }
      }
    }
    loadSegments();
  }, [selectedSessionId]);

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t("sessions.deleteConfirm"))) {
      if (window.electronAPI) {
        await window.electronAPI.sessions.delete(id);
        if (selectedSessionId === id) setSelectedSessionId(null);
        refreshSessions();
      }
    }
  };

  const handleExport = async () => {
    if (!selectedSessionId || !window.electronAPI) return;
    setIsExporting(true);
    try {
      const output = await window.electronAPI.sessions.export(
        selectedSessionId,
        {
          format: exportFormat,
          includeOriginal,
          includeTimestamps: true,
        },
      );

      // Trigger browser/renderer file download
      const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `subtitles_${selectedSessionId}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch (e) {
      alert("Export failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !window.electronAPI) return;

    try {
      const content = await file.text();
      const res = await window.electronAPI.sessions.import(content, file.name);
      alert(`Successfully imported ${res.count} segments!`);
      await refreshSessions();
      setSelectedSessionId(res.sessionId);
    } catch (err) {
      alert(
        "Import failed: " + (err instanceof Error ? err.message : String(err)),
      );
    }
    e.target.value = "";
  };

  const handleSaveEditSegment = async () => {
    if (!editingSegment || !window.electronAPI) return;
    try {
      const targetLang = editingSegment.targetLanguages[0] || "vi";
      const updatedTranslations = {
        ...editingSegment.translations,
        [targetLang]: editTransText,
      };

      await window.electronAPI.sessions.updateSegment(editingSegment.id, {
        originalText: editOriginalText,
        translations: updatedTranslations,
      });

      setSegments((prev) =>
        prev.map((s) =>
          s.id === editingSegment.id
            ? {
                ...s,
                originalText: editOriginalText,
                translations: updatedTranslations,
              }
            : s,
        ),
      );
      setEditingSegment(null);
    } catch (err) {
      console.error(err);
    }
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex-1 h-full flex overflow-hidden bg-transparent">
      {/* Left Column: Sessions List */}
      <div className="w-80 h-full border-r border-glass-border flex flex-col glass-sidebar">
        {/* Header & Search */}
        <div className="p-3.5 border-b border-glass-border space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-primary" />
              <span>{t("sessions.title")}</span>
            </h2>

            {/* Import Button */}
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-glass-subtle border border-glass-border text-xs font-medium text-foreground hover:bg-glass transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{t("sessions.import")}</span>
              </span>
              <input
                type="file"
                accept=".srt,.vtt"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>

          <GlassInput
            type="text"
            placeholder={t("sessions.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            leftIcon={<Search className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredSessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No sessions found
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isSelected = session.id === selectedSessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all duration-150 flex items-start justify-between gap-2.5 border ${
                    isSelected
                      ? "bg-primary/15 border-primary/40 shadow-sm text-foreground"
                      : "border-transparent hover:bg-glass hover:border-glass-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="space-y-1 overflow-hidden">
                    <div className="font-medium text-xs text-foreground truncate">
                      {session.title}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {Math.floor(session.durationSeconds / 60)}m{" "}
                        {session.durationSeconds % 60}s
                      </span>
                      <span>•</span>
                      <span className="font-mono">
                        {session.segmentCount} segs
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/15 transition-colors opacity-40 hover:opacity-100 shrink-0"
                    title="Delete session"
                    aria-label="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Segments Viewer & Editor */}
      <div className="flex-1 h-full flex flex-col overflow-hidden bg-transparent">
        {selectedSession ? (
          <>
            {/* Session Toolbar */}
            <header className="glass-toolbar h-13 px-5 py-3 flex items-center justify-between gap-4 shrink-0 z-10">
              <div className="space-y-0.5 overflow-hidden">
                <h3 className="font-semibold text-xs text-foreground truncate">
                  {selectedSession.title}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">
                    {selectedSession.sourceLanguage} →{" "}
                    {selectedSession.targetLanguages.join(", ")}
                  </span>
                  <span>•</span>
                  <span>{selectedSession.speechProvider}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <GlassButton
                  variant="glass"
                  size="sm"
                  onClick={() => {
                    loadSession(selectedSession.id);
                    setActivePage("live-subtitles");
                  }}
                  icon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  <span>Open in Workspace</span>
                </GlassButton>

                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={() => setShowExportModal(true)}
                  icon={<Download className="w-3.5 h-3.5" />}
                >
                  <span>{t("sessions.export")}</span>
                </GlassButton>
              </div>
            </header>

            {/* Segments timeline list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {segments.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  {t("sessions.noSegments")}
                </div>
              ) : (
                segments.map((seg) => {
                  const trans = Object.values(seg.translations)[0] || "";
                  return (
                    <GlassCard
                      key={seg.id}
                      variant="default"
                      className="p-3.5 space-y-1.5 group hover:border-glass-border-elevated"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-glass-subtle border border-glass-border/40">
                          {formatDisplayTime(seg.startTime)} -{" "}
                          {formatDisplayTime(seg.endTime)}
                        </span>
                        <GlassButton
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditingSegment(seg);
                            setEditOriginalText(seg.originalText);
                            setEditTransText(trans);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit text"
                          aria-label="Edit text"
                        >
                          <Edit2 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                        </GlassButton>
                      </div>

                      <div className="text-xs text-foreground font-normal leading-relaxed">
                        {seg.originalText}
                      </div>
                      {trans && (
                        <div className="text-xs font-semibold text-primary leading-relaxed">
                          {trans}
                        </div>
                      )}
                    </GlassCard>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground space-y-2">
            <Layers3 className="w-8 h-8 opacity-40 text-primary" />
            <span>Select a session on the left to inspect segments</span>
          </div>
        )}
      </div>

      {/* Export Glass Modal */}
      <GlassModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Subtitles"
        description="Download transcription and translation file in your preferred format."
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">Format</label>
            <GlassSelect
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
            >
              <option value="srt">SubRip Subtitle (.srt)</option>
              <option value="vtt">WebVTT (.vtt)</option>
              <option value="txt">Plain Text Transcript (.txt)</option>
              <option value="json">JSON Metadata (.json)</option>
            </GlassSelect>
          </div>

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              id="includeOrig"
              checked={includeOriginal}
              onChange={(e) => setIncludeOriginal(e.target.checked)}
              className="rounded accent-primary"
            />
            <span className="text-foreground">
              Include original spoken text
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-glass-border">
            <GlassButton
              variant="subtle"
              size="sm"
              onClick={() => setShowExportModal(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={handleExport}
              isLoading={isExporting}
            >
              Export
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Edit Segment Glass Modal */}
      <GlassModal
        isOpen={!!editingSegment}
        onClose={() => setEditingSegment(null)}
        title="Edit Subtitle Segment"
        description="Fine-tune transcription or translation accuracy."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">
              Original Spoken Text
            </label>
            <textarea
              rows={3}
              value={editOriginalText}
              onChange={(e) => setEditOriginalText(e.target.value)}
              className="glass-input w-full p-2.5 text-xs text-foreground focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">
              Translated Text
            </label>
            <textarea
              rows={3}
              value={editTransText}
              onChange={(e) => setEditTransText(e.target.value)}
              className="glass-input w-full p-2.5 text-xs text-foreground focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-glass-border">
            <GlassButton
              variant="subtle"
              size="sm"
              onClick={() => setEditingSegment(null)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={handleSaveEditSegment}
              icon={<Check className="w-3.5 h-3.5" />}
            >
              Save
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};
