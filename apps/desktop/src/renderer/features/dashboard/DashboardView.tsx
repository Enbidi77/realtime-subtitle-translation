import React, { useEffect, useState } from 'react';
import { useSessionStore } from '@/stores/session-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useNavigationStore } from '@/stores/navigation-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { SUPPORTED_LANGUAGES, TARGET_LANGUAGES } from '@echo-lingo/config';
import { SessionMetadata } from '@echo-lingo/contracts';
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
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { t } = useI18n();
  const { isListening, audioError, setAudioError, startSession, stopSession } = useSessionStore();
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
          const totalSec = list.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
          setTotalMinutes(Math.round(totalSec / 60));
        } catch (e) {
          console.error(e);
        }
      }
    }
    loadRecent();
  }, [isListening]);

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
      setActivePage('live-subtitles');
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 space-y-6 max-w-6xl mx-auto">
      {/* Audio Error Alert Banner */}
      {audioError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-destructive" />
            <div>
              <div className="text-xs font-semibold text-destructive">Audio Capture Notice</div>
              <div className="text-xs mt-1 text-foreground/90 leading-relaxed">{audioError}</div>
            </div>
          </div>
          <button
            onClick={() => setAudioError(null)}
            className="text-xs px-2.5 py-1 rounded bg-background/50 hover:bg-background border border-border text-foreground transition-colors flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Action Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 border border-border p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Intelligence</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t('dashboard.heroTitle')}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('dashboard.heroSubtitle')}
            </p>
          </div>

          {/* Primary Action Button */}
          <div>
            <button
              onClick={handleToggleListening}
              className={`flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm shadow-md transition-all active:scale-[0.98] ${
                isListening
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-destructive/20'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/25'
              }`}
            >
              {isListening ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>{t('dashboard.stopListening')}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>{t('dashboard.startListening')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Configuration Quick Selectors */}
        <div className="mt-6 pt-5 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Audio Source */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-primary" />
                {t('dashboard.audioSource')}
              </span>
            </label>
            <select
              value={settings.audioSourceType}
              onChange={(e) => updateSettings({ audioSourceType: e.target.value as any })}
              disabled={isListening}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              <option value="system">🔊 System Audio (YouTube, Meetings, PC)</option>
              <option value="microphone">🎙️ Microphone (Your Voice)</option>
            </select>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {settings.audioSourceType === 'system'
                ? '⚡ Captures YouTube, meetings & browser video directly.'
                : '🎙️ Captures physical microphone. For YouTube, choose System Audio.'}
            </p>
          </div>

          {/* Speech Engine */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-primary" />
                Speech Engine
              </span>
              <button
                type="button"
                onClick={() => setActivePage('providers')}
                className="text-[10px] text-primary hover:underline"
              >
                Keys
              </button>
            </label>
            <select
              value={settings.speechEngine}
              onChange={(e) => updateSettings({ speechEngine: e.target.value as any })}
              disabled={isListening}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              <option value="windows-speech">Windows System Speech (Built-in Offline SAPI)</option>
              <option value="groq-whisper">Groq Whisper (Free & Ultra-Fast Cloud)</option>
              <option value="openai-whisper">OpenAI Whisper (Cloud)</option>
              <option value="mock">Mock Engine (Instant Demo / Testing)</option>
              <option value="whisper-local">Whisper Local (Offline)</option>
            </select>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {settings.speechEngine === 'windows-speech'
                ? '💻 Native Windows built-in SAPI recognition. 100% offline, zero setup.'
                : settings.speechEngine === 'groq-whisper'
                ? '⚡ Ultra-fast Whisper Large. Free API key in Providers.'
                : settings.speechEngine === 'mock'
                ? '🧪 Generates live sample subtitles on audio for testing.'
                : settings.speechEngine === 'openai-whisper'
                ? 'OpenAI whisper-1 model. Configure key in Providers.'
                : 'Offline Whisper engine.'}
            </p>
          </div>

          {/* Source Language */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-primary" />
              {t('dashboard.sourceLanguage')}
            </label>
            <select
              value={settings.sourceLanguage}
              onChange={(e) => updateSettings({ sourceLanguage: e.target.value })}
              disabled={isListening}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} {lang.nativeName ? `(${lang.nativeName})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">Original language of the speaker.</p>
          </div>

          {/* Target Language */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-primary" />
              {t('dashboard.targetLanguage')}
            </label>
            <select
              value={settings.targetLanguages[0] || 'vi'}
              onChange={(e) => updateSettings({ targetLanguages: [e.target.value] })}
              disabled={isListening}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              {TARGET_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} {lang.nativeName ? `(${lang.nativeName})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">Language translated in real time.</p>
          </div>
        </div>
      </div>

      {/* Metrics & System Health */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="text-xs text-muted-foreground mb-1">{t('dashboard.totalSessions')}</div>
          <div className="text-2xl font-bold text-foreground">{recentSessions.length}</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="text-xs text-muted-foreground mb-1">{t('dashboard.totalMinutes')}</div>
          <div className="text-2xl font-bold text-foreground">{totalMinutes}m</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="text-xs text-muted-foreground mb-1">{t('dashboard.activeEngine')}</div>
          <div className="text-sm font-semibold text-foreground truncate">{settings.speechEngine}</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="text-xs text-muted-foreground mb-1">{t('dashboard.activeTranslator')}</div>
          <div className="text-sm font-semibold text-foreground truncate">{settings.translationProvider}</div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {t('dashboard.recentSessions')}
          </h2>
          <button
            onClick={() => setActivePage('sessions')}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentSessions.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-card border border-border/80 text-muted-foreground text-sm">
            {t('dashboard.noSessions')}
          </div>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => {
                  useSessionStore.getState().loadSession(session.id);
                  setActivePage('live-subtitles');
                }}
                className="flex items-center justify-between p-3.5 rounded-xl bg-card hover:bg-muted/50 border border-border/70 transition-all cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="font-medium text-xs text-foreground">{session.title}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {session.segmentCount} segments
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="px-2 py-0.5 rounded bg-muted text-[11px]">
                    {session.sourceLanguage} → {session.targetLanguages.join(', ')}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
