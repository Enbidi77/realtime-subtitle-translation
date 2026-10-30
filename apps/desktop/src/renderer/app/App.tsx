import React, { useEffect } from 'react';
import { TitleBar } from '@/components/layout/TitleBar.js';
import { Sidebar } from '@/components/layout/Sidebar.js';
import { StatusBar } from '@/components/layout/StatusBar.js';
import { DashboardView } from '@/features/dashboard/DashboardView.js';
import { LiveSubtitlesView } from '@/features/live-subtitles/LiveSubtitlesView.js';
import { SessionsView } from '@/features/sessions/SessionsView.js';
import { TranslationHistoryView } from '@/features/history/TranslationHistoryView.js';
import { ProvidersView } from '@/features/providers/ProvidersView.js';
import { SettingsView } from '@/features/settings/SettingsView.js';
import { ScreenTranslationView } from '@/features/screen-translation/index.js';
import { VideoSubtitlesView } from '@/features/video-subtitles/index.js';
import { useNavigationStore } from '@/stores/navigation-store.js';
import { isFeatureEnabled } from '@echo-lingo/config';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useSessionStore } from '@/stores/session-store.js';
import { useAudioCapture } from '@/hooks/useAudioCapture.js';

import { AmbientBackground } from '@/components/ui/AmbientBackground.js';
import { ExitConfirmationModal } from '@/components/ExitConfirmationModal.js';
import { GlobalSearchModal, useGlobalSearchStore } from '@/features/global-search/index.js';
import { InteractiveTourModal } from '@/features/onboarding/index.js';
import { useOnboardingStore } from '@/stores/onboarding-store.js';

export const App: React.FC = () => {
  const activePage = useNavigationStore((s) => s.activePage);
  const isExitModalOpen = useNavigationStore((s) => s.isExitModalOpen);
  const featureFlags = useSettingsStore((s) => s.settings.featureFlags);
  const setIsExitModalOpen = useNavigationStore((s) => s.setIsExitModalOpen);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const hasCompletedOnboarding = useSettingsStore((s) => s.settings.hasCompletedOnboarding);
  const isSettingsLoading = useSettingsStore((s) => s.isLoading);
  const openTour = useOnboardingStore((s) => s.openTour);
  const handleTranscriptionEvent = useSessionStore((s) => s.handleTranscriptionEvent);

  // Initialize Web Audio capture engine
  useAudioCapture();

  useEffect(() => {
    // Load persisted settings on startup
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    // Automatically trigger onboarding tour once on initial app run if not yet completed
    if (!isSettingsLoading && !hasCompletedOnboarding) {
      const timer = setTimeout(() => {
        openTour(0);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isSettingsLoading, hasCompletedOnboarding, openTour]);

  useEffect(() => {

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

      const unsubNavigate = window.electronAPI.app.onNavigate?.((page) => {
        const currentFlags = useSettingsStore.getState().settings.featureFlags;
        if (!isFeatureEnabled(page as any, currentFlags)) {
          useNavigationStore.getState().setActivePage('dashboard');
          return;
        }
        if (page === 'settings') {
          useNavigationStore.getState().setActivePage('settings');
        } else if (
          page === 'dashboard' ||
          page === 'live-subtitles' ||
          page === 'video-subtitles' ||
          page === 'ocr-translate' ||
          page === 'sessions' ||
          page === 'history' ||
          page === 'providers'
        ) {
          useNavigationStore.getState().setActivePage(page as any);
        }
      });

      const unsubCloseConfirm = window.electronAPI.app.onRequestCloseConfirm?.(() => {
        useNavigationStore.getState().setIsExitModalOpen(true);
      });

      const unsubSearchToggle = window.electronAPI.search?.onToggleSearch?.((data) => {
        if (data?.initialCategory === 'command') {
          useGlobalSearchStore.getState().open('', 'command');
        } else {
          useGlobalSearchStore.getState().toggle((data?.initialCategory as any) || 'all');
        }
      });

      const unsubQuickStart = (window.electronAPI.sessions as any)?.onQuickStart?.(async () => {
        const { isListening, startSession, stopSession } = useSessionStore.getState();
        if (!isListening) {
          const settings = useSettingsStore.getState().settings;
          await startSession({
            title: `Live Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            sourceLanguage: settings.sourceLanguage || 'auto',
            targetLanguages: settings.targetLanguages || ['vi'],
            speechProvider: settings.speechEngine || 'whisper-local',
            translationProvider: settings.translationProvider || 'google-web',
            audioSourceType: settings.audioSourceType || 'microphone',
            audioDeviceId: settings.audioDeviceId || 'default',
          });
        } else {
          await stopSession();
        }
      });

      // Window-level keydown handler for Ctrl+K, Cmd+K, Ctrl+Shift+P, Cmd+Shift+P
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        // Ctrl+K or Cmd+K: Toggle search
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          e.stopPropagation();
          useGlobalSearchStore.getState().toggle('all');
          return;
        }

        // Ctrl+Shift+P or Cmd+Shift+P: Open Command Palette
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
          e.preventDefault();
          e.stopPropagation();
          useGlobalSearchStore.getState().open('', 'command');
          return;
        }
      };

      window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });

      return () => {
        if (unsubSpeech) unsubSpeech();
        if (unsubStatus) unsubStatus();
        if (unsubNavigate) unsubNavigate();
        if (unsubCloseConfirm) unsubCloseConfirm();
        if (unsubSearchToggle) unsubSearchToggle();
        if (unsubQuickStart) unsubQuickStart();
        window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
      };
    }
  }, [loadSettings, handleTranscriptionEvent]);

  const renderActivePage = () => {
    if (!isFeatureEnabled(activePage, featureFlags)) {
      return <DashboardView />;
    }
    switch (activePage) {
      case 'dashboard':
        return <DashboardView />;
      case 'live-subtitles':
        return <LiveSubtitlesView />;
      case 'video-subtitles':
        return <VideoSubtitlesView />;
      case 'sessions':
        return <SessionsView />;
      case 'history':
        return <TranslationHistoryView />;
      case 'providers':
        return <ProvidersView />;
      case 'ocr-translate':
        return <ScreenTranslationView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground select-none relative">
      {/* Ambient background lighting */}
      <AmbientBackground />

      {/* 1. Custom Frameless Glass TitleBar */}
      <TitleBar />

      {/* 2. Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative z-10 pointer-events-auto">
        {/* Left Navigation Glass Sidebar */}
        <Sidebar />

        {/* Center Main Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden relative z-10 bg-transparent pointer-events-auto">
          {renderActivePage()}
        </main>
      </div>

      {/* 3. Bottom Glass Status Bar */}
      <StatusBar />

      {/* Global Exit Confirmation Dialog */}
      <ExitConfirmationModal
        isOpen={isExitModalOpen}
        onClose={() => setIsExitModalOpen(false)}
      />

      {/* Global Search Command Palette */}
      <GlobalSearchModal />

      {/* Interactive App Instructions & Tour */}
      <InteractiveTourModal />
    </div>
  );
};
