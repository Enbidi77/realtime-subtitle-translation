import React, { useEffect, useState } from 'react';
import { SubtitleSegment } from '@echo-lingo/contracts';
import { useI18n } from '@/app/i18n/index.js';
import { formatDisplayTime } from '@echo-lingo/subtitle-core';
import { History, Search, Copy, Check } from 'lucide-react';

export const TranslationHistoryView: React.FC = () => {
  const { t } = useI18n();
  const [allSegments, setAllSegments] = useState<SubtitleSegment[]>([]);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      if (window.electronAPI) {
        try {
          const sessions = await window.electronAPI.sessions.list();
          const segsPromises = sessions.slice(0, 20).map((s) => window.electronAPI.sessions.getSegments(s.id));
          const results = await Promise.all(segsPromises);
          const flattened = results.flat().sort((a, b) => b.createdAt - a.createdAt);
          setAllSegments(flattened);
        } catch (e) {
          console.error(e);
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
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-background p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <span>Translation History</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Searchable historical archive of all transcribed speech segments.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search keywords or translations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-xs text-muted-foreground space-y-1">
            <History className="w-8 h-8 opacity-40" />
            <span>No translation history found.</span>
          </div>
        ) : (
          filtered.map((seg) => {
            const trans = Object.values(seg.translations)[0] || '';
            return (
              <div
                key={seg.id}
                className="p-3.5 rounded-xl bg-card border border-border/70 hover:border-border transition-all flex items-start justify-between gap-4"
              >
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono">
                      {new Date(seg.createdAt).toLocaleDateString()} • {formatDisplayTime(seg.startTime)}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{seg.sourceLanguage}</span>
                  </div>
                  <div className="text-xs text-foreground">{seg.originalText}</div>
                  {trans && <div className="text-xs font-medium text-primary">{trans}</div>}
                </div>

                <button
                  onClick={() => handleCopy(seg.id, `${seg.originalText}\n${trans}`)}
                  className="p-1.5 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Copy segment"
                >
                  {copiedId === seg.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
