import { clipboard } from 'electron';
import {
  IPC_CHANNELS,
  RadialMenuActionId,
  RadialMenuState,
} from '@echo-lingo/contracts';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';
import { createLogger, ILogger } from '@echo-lingo/logger';
import { getDatabase } from '@/database/db-instance.js';
import { getSessionService } from '@/services/session-service.js';
import { getTranslationService } from '@/services/translation-service.js';
import { getScreenTranslationService } from '@/services/screen-translation-service.js';
import {
  showRadialMenu,
  hideRadialMenu,
  toggleRadialMenu,
  isRadialMenuVisible,
  sendRadialMenuState,
} from '@/windows/radial-menu-window.js';
import {
  toggleOverlay,
  showOverlay,
  isOverlayVisible,
  setOverlayClickThrough,
  getOverlayClickThrough,
} from '@/windows/overlay-window.js';
import {
  showOcrFloatingPanel,
  hideOcrFloatingPanel,
  isOcrFloatingPanelVisible,
  restoreOcrFloatingPanel,
} from '@/windows/ocr-panel-window.js';
import { getMainWindow, showMainWindow } from '@/windows/main-window.js';
import { getShortcutsService } from '@/services/shortcuts-service.js';

export class RadialMenuService {
  private static instance: RadialMenuService | null = null;
  private readonly log: ILogger = createLogger('RadialMenuService');

  public static getInstance(): RadialMenuService {
    if (!RadialMenuService.instance) {
      RadialMenuService.instance = new RadialMenuService();
    }
    return RadialMenuService.instance;
  }

  public getState(): RadialMenuState {
    const sessionService = getSessionService();
    const active = sessionService.getActiveSession();
    const isListening = Boolean(active && active.status === 'active');
    const isPaused = Boolean(active && active.status === 'paused');

    const screenService = getScreenTranslationService();
    const stats = screenService.getContinuousStats();
    const isContinuousOcr =
      stats.state === 'capturing' ||
      stats.state === 'recognizing' ||
      stats.state === 'translating';

    const db = getDatabase();
    const settings = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
    const targetLangs = settings.targetLanguages || ['vi'];

    const segments = sessionService.getTimeline().getSegments(true);
    const latestSegment = segments[segments.length - 1];
    const lastSubtitleText = latestSegment
      ? latestSegment.translations?.[targetLangs[0] || 'vi'] || latestSegment.originalText
      : undefined;

    return {
      isListening,
      isPaused,
      isOverlayVisible: isOverlayVisible(),
      isClickThrough: getOverlayClickThrough(),
      isContinuousOcr,
      isOcrPanelVisible: isOcrFloatingPanelVisible(),
      sourceLanguage: settings.sourceLanguage || 'auto',
      targetLanguages: targetLangs,
      lastSubtitleText,
    };
  }

  public showMenu(): void {
    const state = this.getState();
    showRadialMenu(state);
  }

  public hideMenu(): void {
    hideRadialMenu();
  }

  public toggleMenu(): boolean {
    const state = this.getState();
    return toggleRadialMenu(state);
  }

  public updateState(): void {
    if (isRadialMenuVisible()) {
      sendRadialMenuState(this.getState());
    }
  }

  /**
   * Execute action directly without opening the main window
   */
  public async executeAction(actionId: RadialMenuActionId): Promise<{ ok: boolean; error?: string }> {
    this.log.info(`Executing radial action: ${actionId}`);

    // Hide radial menu immediately to return focus
    hideRadialMenu();

    try {
      switch (actionId) {
        case 'toggle-listening': {
          const sessionService = getSessionService();
          const active = sessionService.getActiveSession();

          if (active && active.status === 'active') {
            sessionService.stopSession();
          } else {
            // Start listening session without opening main window
            // 1. Ensure floating subtitle overlay is visible so user sees speech results
            showOverlay();

            // 2. Notify main window to start audio capture stream
            const mainWin = getMainWindow();
            if (mainWin && !mainWin.isDestroyed() && !mainWin.webContents.isDestroyed()) {
              mainWin.webContents.send('session:quick-start');
            } else {
              // Fallback to direct SessionService creation
              const db = getDatabase();
              const settings = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
              await sessionService.createSession({
                title: `Quick Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                sourceLanguage: settings.sourceLanguage || 'auto',
                targetLanguages: settings.targetLanguages || ['vi'],
                speechProvider: settings.speechEngine || 'whisper-local',
                translationProvider: settings.translationProvider || 'google-web',
                audioSourceType: settings.audioSourceType || 'microphone',
                audioDeviceId: settings.audioDeviceId || 'default',
              });
            }
          }
          break;
        }

        case 'pause-listening': {
          const sessionService = getSessionService();
          const active = sessionService.getActiveSession();
          if (active) {
            if (active.status === 'active') {
              sessionService.pauseSession();
            } else if (active.status === 'paused') {
              sessionService.resumeSession();
            }
          }
          break;
        }

        case 'capture-translate': {
          // Direct region selection and OCR translation with floating result
          await getShortcutsService().handleCaptureAndTranslate();
          break;
        }

        case 'continuous-ocr': {
          // Direct toggle continuous screen translation
          await getShortcutsService().handleToggleContinuousOcr();
          break;
        }

        case 'translate-clipboard': {
          const text = clipboard.readText()?.trim();
          if (text) {
            const db = getDatabase();
            const settings = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
            const targetLang = (settings.targetLanguages && settings.targetLanguages[0]) || 'vi';
            const sourceLang = settings.sourceLanguage || 'auto';
            const providerId = settings.translationProvider || 'google-web';

            const start = Date.now();
            const res = await getTranslationService().translate(
              {
                text,
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                priority: 'high',
              },
              providerId as any
            );

            showOcrFloatingPanel({
              originalText: text,
              translatedText: res.translatedText,
              sourceLanguage: res.sourceLanguage || sourceLang,
              targetLanguage: res.targetLanguage || targetLang,
              durationMs: Date.now() - start,
              region: undefined,
            });
          }
          break;
        }

        case 'toggle-overlay': {
          toggleOverlay();
          break;
        }

        case 'toggle-click-through': {
          const current = getOverlayClickThrough();
          setOverlayClickThrough(!current);
          break;
        }

        case 'show-ocr-panel': {
          if (isOcrFloatingPanelVisible()) {
            hideOcrFloatingPanel();
          } else {
            restoreOcrFloatingPanel();
          }
          break;
        }

        case 'clear-subtitles': {
          const sessionService = getSessionService();
          sessionService.getTimeline().clear();
          sessionService.broadcastToOverlay();
          break;
        }

        case 'copy-last': {
          const state = this.getState();
          if (state.lastSubtitleText) {
            clipboard.writeText(state.lastSubtitleText);
          }
          break;
        }

        case 'open-settings': {
          showMainWindow();
          const win = getMainWindow();
          if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
            win.webContents.send(IPC_CHANNELS.APP_NAVIGATE_TO, 'settings');
          }
          break;
        }

        case 'open-app': {
          showMainWindow();
          break;
        }

        default:
          this.log.warn(`Unknown radial menu action: ${actionId}`);
          return { ok: false, error: `Unknown action: ${actionId}` };
      }

      this.updateState();
      return { ok: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.log.error(`Failed to execute radial action ${actionId}:`, err);
      return { ok: false, error: errMsg };
    }
  }
}

export function getRadialMenuService(): RadialMenuService {
  return RadialMenuService.getInstance();
}
