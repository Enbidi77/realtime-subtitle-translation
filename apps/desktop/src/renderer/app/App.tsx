import React, { useEffect } from 'react';
import { TitleBar } from '../components/layout/TitleBar.js';
import { Sidebar } from '../components/layout/Sidebar.js';
import { StatusBar } from '../components/layout/StatusBar.js';
import { DashboardView } from '../features/dashboard/DashboardView.js';
import { LiveSubtitlesView } from '../features/live-subtitles/LiveSubtitlesView.js';
import { SessionsView } from '../features/sessions/SessionsView.js';
import { TranslationHistoryView } from '../features/history/TranslationHistoryView.js';
import { ProvidersView } from '../features/providers/ProvidersView.js';
import { SettingsView } from '../features/settings/SettingsView.js';
import { useNavigationStore } from '../stores/navigation-store.js';
import { useSettingsStore } from '../stores/settings-store.js';
import { useSessionStore } from '../stores/session-store.js';
import { useAudioCapture } from '../hooks/useAudioCapture.js';

export const App: React.FC = () => {
  const activePage = useNavigationStore((s) => s.activePage);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const handleTranscriptionEvent = useSessionStore((s) => s.handleTranscriptionEvent);

  // Initialize Web Audio capture engine
  useAudioCapture();

  useEffect(() => {
    // Load persisted settings on startup
    loadSettings();

    // Listen to real-time transcription events and audio status from main process
    if (window.electronAPI) {
      const unsubSpeech = window.electronAPI.speech.onTranscription((evt) => {
        handleTranscriptionEvent(evt);
      });

      const unsubStatus = window.electronAPI.audio.onStatus((status) => {
        if (status.errorMessage) {
          useSessionStore.getState().setAudioError(status.errorMessage);
        }
      });

      return () => {
        if (unsubSpeech) unsubSpeech();
        if (unsubStatus) unsubStatus();
      };
    }
  }, [loadSettings, handleTranscriptionEvent]);

  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardView />;
      case 'live-subtitles':
        return <LiveSubtitlesView />;
      case 'sessions':
        return <SessionsView />;
      case 'history':
        return <TranslationHistoryView />;
      case 'providers':
        return <ProvidersView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground select-none">
      {/* 1. Custom Frameless TitleBar */}
      <TitleBar />

      {/* 2. Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Center Main Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          {renderActivePage()}
        </main>
      </div>

      {/* 3. Bottom Status Bar */}
      <StatusBar />
    </div>
  );
};
