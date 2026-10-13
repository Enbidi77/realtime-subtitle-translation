import { globalShortcut } from 'electron';
import { toggleOverlay } from '@/windows/overlay-window.js';
import { getSessionService } from '@/services/session-service.js';
import { getScreenTranslationService } from '@/services/screen-translation-service.js';
import { getDatabase } from '@/database/db-instance.js';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';

export function registerGlobalShortcuts(): void {
  try {
    // 1. Toggle overlay window
    globalShortcut.register('CommandOrControl+Shift+O', () => {
      toggleOverlay();
    });

    // 2. Pause/Resume active speech listening session
    globalShortcut.register('CommandOrControl+Shift+P', () => {
      const sessionService = getSessionService();
      const active = sessionService.getActiveSession();
      if (active) {
        if (active.status === 'active') {
          sessionService.pauseSession();
        } else if (active.status === 'paused') {
          sessionService.resumeSession();
        }
      }
    });

    // 3. Quick Capture and Translate (Workflow B)
    globalShortcut.register('CommandOrControl+Shift+T', async () => {
      try {
        const screenService = getScreenTranslationService();
        const region = await screenService.selectRegion();
        if (region) {
          const db = getDatabase();
          const settings = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
          const stSettings = settings.screenTranslation || DEFAULT_APP_SETTINGS.screenTranslation;

          await screenService.captureAndTranslate({
            region,
            ocrLanguage: stSettings.ocrLanguage || 'auto',
            targetLanguages: settings.targetLanguages || ['vi'],
            sourceLanguage: settings.sourceLanguage || 'auto',
            ocrProviderId: stSettings.ocrProvider || 'windows-native',
            translationProviderId: settings.translationProvider || 'google-web',
            profile: stSettings.profile || 'general',
            skipPreview: true,
          });
        }
      } catch (err) {
        console.warn('[Shortcuts] Capture & Translate shortcut error:', err);
      }
    });

    // 4. Toggle Continuous Screen OCR (Workflow C)
    globalShortcut.register('CommandOrControl+Shift+R', async () => {
      try {
        const screenService = getScreenTranslationService();
        const stats = screenService.getContinuousStats();

        if (stats.state === 'capturing' || stats.state === 'recognizing' || stats.state === 'translating') {
          screenService.stopContinuous();
        } else {
          const region = await screenService.selectRegion();
          if (region) {
            const db = getDatabase();
            const settings = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
            const stSettings = settings.screenTranslation || DEFAULT_APP_SETTINGS.screenTranslation;

            screenService.startContinuous({
              region,
              intervalMs: stSettings.continuousIntervalMs || 2000,
              changeThreshold: stSettings.changeThreshold ?? 0.15,
              ignoreUnchanged: stSettings.ignoreUnchanged !== false,
              translateOnlyDiff: stSettings.translateOnlyDiff || false,
              ocrProviderId: stSettings.ocrProvider || 'windows-native',
              ocrLanguage: stSettings.ocrLanguage || 'auto',
              translationProviderId: settings.translationProvider || 'google-web',
              sourceLanguage: settings.sourceLanguage || 'auto',
              targetLanguages: settings.targetLanguages || ['vi'],
              profile: stSettings.profile || 'general',
            });
          }
        }
      } catch (err) {
        console.warn('[Shortcuts] Toggle Continuous OCR shortcut error:', err);
      }
    });
  } catch (err) {
    console.warn('[Shortcuts] Could not register some global shortcuts:', err);
  }
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
