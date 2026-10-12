import React, { useEffect, useState } from 'react';
import { useSessionStore } from '@/stores/session-store.js';
import { useNavigationStore } from '@/stores/navigation-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { SessionMetadata, SubtitleSegment, SubtitleExportFormat } from '@echo-lingo/contracts';
import { formatDisplayTime } from '@echo-lingo/subtitle-core';
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
  X,
} from 'lucide-react';

export const SessionsView: React.FC = () => {
  const { t } = useI18n();
  const { setActivePage } = useNavigationStore();
  const { loadSession } = useSessionStore();

  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Export dialog state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<SubtitleExportFormat>('srt');
  const [includeOriginal, setIncludeOriginal] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Edit segment modal
  const [editingSegment, setEditingSegment] = useState<SubtitleSegment | null>(null);
  const [editOriginalText, setEditOriginalText] = useState('');
  const [editTransText, setEditTransText] = useState('');

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
          const segs = await window.electronAPI.sessions.getSegments(selectedSessionId);
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
    if (confirm(t('sessions.deleteConfirm'))) {
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
      const output = await window.electronAPI.sessions.export(selectedSessionId, {
        format: exportFormat,
        includeOriginal,
        includeTimestamps: true,
      });

      // Trigger browser/renderer file download
      const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subtitles_${selectedSessionId}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch (e) {
      alert('Export failed: ' + (e instanceof Error ? e.message : String(e)));
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
      alert('Import failed: ' + (err instanceof Error ? err.message : String(err)));
    }
    e.target.value = '';
  };

  const handleSaveEditSegment = async () => {
    if (!editingSegment || !window.electronAPI) return;
    try {
      const targetLang = editingSegment.targetLanguages[0] || 'vi';
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
            ? { ...s, originalText: editOriginalText, translations: updatedTranslations }
            : s
        )
      );
      setEditingSegment(null);
    } catch (err) {
      console.error(err);
    }
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 h-full flex overflow-hidden bg-background">
      {/* Left Column: Sessions List */}
      <div className="w-80 h-full border-r border-border flex flex-col bg-card">
        {/* Header & Search */}
        <div className="p-3 border-b border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FolderKanban className="w-4 h-4 text-primary" />
              <span>{t('sessions.title')}</span>
            </h2>

            {/* Import Button */}
            <label className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-xs font-medium text-foreground transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>{t('sessions.import')}</span>
              <input
                type="file"
                accept=".srt,.vtt"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('sessions.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
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
                  className={`p-3 cursor-pointer transition-colors flex items-start justify-between gap-2 ${
                    isSelected ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="space-y-1 overflow-hidden">
                    <div className="font-medium text-xs text-foreground truncate">
                      {session.title}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s
                      </span>
                      <span>•</span>
                      <span>{session.segmentCount} segs</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors opacity-60 hover:opacity-100"
                    title="Delete session"
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
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        {selectedSession ? (
          <>
            {/* Session Toolbar */}
            <div className="h-12 px-4 border-b border-border flex items-center justify-between bg-card">
              <div>
                <h3 className="font-semibold text-xs text-foreground">{selectedSession.title}</h3>
                <span className="text-[10px] text-muted-foreground">
                  {selectedSession.sourceLanguage} → {selectedSession.targetLanguages.join(', ')} •{' '}
                  {selectedSession.speechProvider}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    loadSession(selectedSession.id);
                    setActivePage('live-subtitles');
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted transition-colors"
                >
                  Open in Workspace
                </button>

                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('sessions.export')}</span>
                </button>
              </div>
            </div>

            {/* Segments timeline list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {segments.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  {t('sessions.noSegments')}
                </div>
              ) : (
                segments.map((seg) => {
                  const trans = Object.values(seg.translations)[0] || '';
                  return (
                    <div
                      key={seg.id}
                      className="p-3.5 rounded-xl bg-card border border-border/70 hover:border-border transition-all space-y-1 group relative"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-mono">
                          [{formatDisplayTime(seg.startTime)} - {formatDisplayTime(seg.endTime)}]
                        </span>
                        <button
                          onClick={() => {
                            setEditingSegment(seg);
                            setEditOriginalText(seg.originalText);
                            setEditTransText(trans);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-all"
                          title="Edit text"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-xs text-foreground">{seg.originalText}</div>
                      {trans && <div className="text-xs font-medium text-primary">{trans}</div>}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Select a session on the left to view segments
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Export Subtitles</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-foreground"
                >
                  <option value="srt">SubRip Subtitle (.srt)</option>
                  <option value="vtt">WebVTT (.vtt)</option>
                  <option value="txt">Plain Text Transcript (.txt)</option>
                  <option value="json">JSON Metadata (.json)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="includeOrig"
                  checked={includeOriginal}
                  onChange={(e) => setIncludeOriginal(e.target.checked)}
                  className="rounded text-primary"
                />
                <label htmlFor="includeOrig" className="text-foreground">
                  Include original spoken text
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 shadow-sm"
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Segment Modal */}
      {editingSegment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Edit Subtitle Segment</h3>
              <button
                onClick={() => setEditingSegment(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Original Spoken Text</label>
                <textarea
                  rows={3}
                  value={editOriginalText}
                  onChange={(e) => setEditOriginalText(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Translated Text</label>
                <textarea
                  rows={3}
                  value={editTransText}
                  onChange={(e) => setEditTransText(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setEditingSegment(null)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditSegment}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
