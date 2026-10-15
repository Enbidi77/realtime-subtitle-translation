import { globalShortcut } from 'electron';
import { toggleOverlay } from '@/windows/overlay-window.js';
import { getSessionService } from '@/services/session-service.js';
import { getScreenTranslationService } from '@/services/screen-translation-service.js';
import { getDatabase } from '@/database/db-instance.js';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';
import { createLogger, ILogger } from '@echo-lingo/logger';

export class ShortcutsService {
  private static instance: ShortcutsService | null = null;
  private readonly log: ILogger = createLogger('Shortcuts');
  private registered: boolean = false;

  public static getInstance(): ShortcutsService {
    if (!ShortcutsService.instance) {
      ShortcutsService.instance = new ShortcutsService();
    }
    return ShortcutsService.instance;
  }

  /**
   * Registers all global application shortcuts
   */
  public register(): void {
    try {
      // 1. Toggle overlay window
      globalShortcut.register('CommandOrControl+Shift+O', () => {
        this.handleToggleOverlay();
      });

      // 2. Pause/Resume active speech listening session
      globalShortcut.register('CommandOrControl+Shift+P', () => {
        this.handleToggleSession();
      });

      // 3. Quick Capture and Translate (Workflow B)
      globalShortcut.register('CommandOrControl+Shift+T', async () => {
        await this.handleCaptureAndTranslate();
      });

      // 4. Toggle Continuous Screen OCR (Workflow C)
      globalShortcut.register('CommandOrControl+Shift+R', async () => {
        await this.handleToggleContinuousOcr();
      });

      this.registered = true;
    } catch (err) {
      this.log.warn('Could not register some global shortcuts:', err);
    }
  }

  /**
   * Unregisters all global shortcuts
   */
  public unregister(): void {
    globalShortcut.unregisterAll();
    this.registered = false;
  }

  public isRegistered(): boolean {
    return this.registered;
  }

  private handleToggleOverlay(): void {
    toggleOverlay();
  }

  private handleToggleSession(): void {
    const sessionService = getSessionService();
    const active = sessionService.getActiveSession();
    if (active) {
      if (active.status === 'active') {
        sessionService.pauseSession();
      } else if (active.status === 'paused') {
        sessionService.resumeSession();
      }
    }
  }

  private async handleCaptureAndTranslate(): Promise<void> {
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
      this.log.warn('Capture & Translate shortcut error:', err);
    }
  }

  private async handleToggleContinuousOcr(): Promise<void> {
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
      this.log.warn('Toggle Continuous OCR shortcut error:', err);
    }
  }
}

export function getShortcutsService(): ShortcutsService {
  return ShortcutsService.getInstance();
}
