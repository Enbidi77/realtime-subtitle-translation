import { SearchResultItem } from './types.js';
import { useNavigationStore, AppPage } from '@/stores/navigation-store.js';
import { useSessionStore } from '@/stores/session-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';

export interface CommandExecutionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export type CommandHandler = (payload?: Record<string, any>) => Promise<CommandExecutionResult> | CommandExecutionResult;

class CommandRegistry {
  private static instance: CommandRegistry | null = null;
  private handlers = new Map<string, CommandHandler>();

  private constructor() {
    this.registerBuiltinCommands();
  }

  public static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  public register(commandId: string, handler: CommandHandler): void {
    this.handlers.set(commandId, handler);
  }

  public unregister(commandId: string): void {
    this.handlers.delete(commandId);
  }

  public async execute(item: SearchResultItem): Promise<CommandExecutionResult> {
    const { action } = item;

    try {
      switch (action.type) {
        case 'navigate': {
          const page = action.payload?.page as AppPage;
          if (page) {
            useNavigationStore.getState().setActivePage(page);
            return { success: true };
          }
          return { success: false, error: 'Invalid page navigation destination' };
        }

        case 'setting': {
          useNavigationStore.getState().setActivePage('settings');
          const settingKey = action.payload?.settingKey;
          if (settingKey && typeof window !== 'undefined') {
            // Scroll to setting section or dispatch custom event for focus
            window.dispatchEvent(new CustomEvent('echolingo:focus-setting', { detail: { settingKey } }));
          }
          return { success: true };
        }

        case 'open-session': {
          const sessionId = action.payload?.sessionId as string;
          if (sessionId) {
            await useSessionStore.getState().loadSession(sessionId);
            useNavigationStore.getState().setActivePage('live-subtitles');
            return { success: true };
          }
          return { success: false, error: 'Missing session ID' };
        }

        case 'command': {
          const commandId = action.payload?.commandId as string;
          const handler = this.handlers.get(commandId);
          if (handler) {
            return await handler(action.payload);
          }
          return { success: false, error: `Command not found: ${commandId}` };
        }

        case 'copy': {
          const text = action.payload?.text as string;
          if (text) {
            await navigator.clipboard.writeText(text);
            return { success: true, message: 'Copied to clipboard' };
          }
          return { success: false, error: 'Nothing to copy' };
        }

        default:
          return { success: false, error: `Unknown action type: ${action.type}` };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Execution failed' };
    }
  }

  private registerBuiltinCommands(): void {
    // 1. Live session controls
    this.register('session:start', async () => {
      const { isListening, startSession } = useSessionStore.getState();
      if (!isListening) {
        useNavigationStore.getState().setActivePage('live-subtitles');
        const settings = useSettingsStore.getState().settings;
        await startSession({
          title: `Live Session ${new Date().toLocaleTimeString()}`,
          sourceLanguage: settings.sourceLanguage || 'auto',
          targetLanguages: settings.targetLanguages || ['vi'],
          speechProvider: settings.speechEngine || 'whisper-local',
          translationProvider: settings.translationProvider || 'google-web',
          audioSourceType: settings.audioSourceType || 'microphone',
          audioDeviceId: settings.audioDeviceId || 'default',
        });
      } else {
        useNavigationStore.getState().setActivePage('live-subtitles');
      }
      return { success: true };
    });

    this.register('session:pause', async () => {
      await useSessionStore.getState().pauseSession();
      return { success: true };
    });

    this.register('session:resume', async () => {
      await useSessionStore.getState().resumeSession();
      return { success: true };
    });

    this.register('session:stop', async () => {
      await useSessionStore.getState().stopSession();
      return { success: true };
    });

    // 2. Subtitle overlay
    this.register('overlay:toggle', async () => {
      if (window.electronAPI?.overlay) {
        await window.electronAPI.overlay.toggle();
        return { success: true };
      }
      return { success: false, error: 'Overlay API unavailable' };
    });

    // 3. Screen translation
    this.register('ocr:capture-screen', async () => {
      useNavigationStore.getState().setActivePage('ocr-translate');
      if (window.electronAPI?.screenTranslation) {
        const region = await window.electronAPI.screenTranslation.selectRegion();
        if (region) {
          const settings = useSettingsStore.getState().settings;
          const stSettings = settings.screenTranslation;
          await window.electronAPI.screenTranslation.translateRegion({
            region,
            ocrLanguage: stSettings?.ocrLanguage || 'auto',
            targetLanguages: settings.targetLanguages || ['vi'],
            sourceLanguage: settings.sourceLanguage || 'auto',
            ocrProviderId: stSettings?.ocrProvider || 'windows-native',
            translationProviderId: settings.translationProvider || 'google-web',
            profile: stSettings?.profile || 'general',
          });
        }
      }
      return { success: true };
    });

    // 4. Continuous OCR
    this.register('ocr:toggle-continuous', async () => {
      useNavigationStore.getState().setActivePage('ocr-translate');
      if (window.electronAPI?.screenTranslation) {
        // Toggle continuous monitor
        const region = await window.electronAPI.screenTranslation.selectRegion();
        if (region) {
          const settings = useSettingsStore.getState().settings;
          const stSettings = settings.screenTranslation;
          await window.electronAPI.screenTranslation.startContinuous({
            region,
            intervalMs: stSettings?.continuousIntervalMs || 2000,
            changeThreshold: stSettings?.changeThreshold ?? 0.15,
            ignoreUnchanged: stSettings?.ignoreUnchanged !== false,
            translateOnlyDiff: stSettings?.translateOnlyDiff || false,
            ocrProviderId: stSettings?.ocrProvider || 'windows-native',
            ocrLanguage: stSettings?.ocrLanguage || 'auto',
            translationProviderId: settings.translationProvider || 'google-web',
            sourceLanguage: settings.sourceLanguage || 'auto',
            targetLanguages: settings.targetLanguages || ['vi'],
            profile: stSettings?.profile || 'general',
          });
        }
      }
      return { success: true };
    });

    // 5. Theme controls
    this.register('theme:toggle', () => {
      const current = useSettingsStore.getState().settings.theme;
      const next = current === 'dark' ? 'light' : 'dark';
      useSettingsStore.getState().updateSettings({ theme: next });
      return { success: true };
    });

    this.register('theme:dark', () => {
      useSettingsStore.getState().updateSettings({ theme: 'dark' });
      return { success: true };
    });

    this.register('theme:light', () => {
      useSettingsStore.getState().updateSettings({ theme: 'light' });
      return { success: true };
    });

    this.register('theme:system', () => {
      useSettingsStore.getState().updateSettings({ theme: 'system' });
      return { success: true };
    });

    // 6. UI Language controls
    this.register('locale:vi', () => {
      useSettingsStore.getState().updateSettings({ locale: 'vi' });
      return { success: true };
    });

    this.register('locale:en', () => {
      useSettingsStore.getState().updateSettings({ locale: 'en' });
      return { success: true };
    });

    // 7. Diagnostics and Maintenance
    this.register('app:open-logs', async () => {
      if (window.electronAPI?.app?.openLogs) {
        await window.electronAPI.app.openLogs();
        return { success: true };
      }
      return { success: false, error: 'Logs API unavailable' };
    });

    this.register('history:clear-ocr', async () => {
      if (window.electronAPI?.screenTranslation?.clearHistory) {
        await window.electronAPI.screenTranslation.clearHistory();
        return { success: true };
      }
      return { success: false, error: 'Clear history unavailable' };
    });

    this.register('settings:reset', async () => {
      await useSettingsStore.getState().resetSettings();
      return { success: true };
    });
  }
}

export function getCommandRegistry(): CommandRegistry {
  return CommandRegistry.getInstance();
}

