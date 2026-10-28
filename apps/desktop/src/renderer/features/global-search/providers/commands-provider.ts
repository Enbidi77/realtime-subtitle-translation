import { ISearchProvider, SearchResultItem } from '../types.js';
import { scoreSearchResult } from '../scoring.js';
import { useSessionStore } from '@/stores/session-store.js';

export class CommandsProvider implements ISearchProvider {
  public readonly id = 'commands';
  public readonly category = 'command';
  public readonly name = 'Commands';

  private getItems(): SearchResultItem[] {
    const isListening = useSessionStore.getState().isListening;
    const isPaused = useSessionStore.getState().isPaused;

    const items: SearchResultItem[] = [
      // 1. Session controls
      isListening
        ? {
            id: 'cmd:session-stop',
            category: 'command',
            title: 'End Listening Session',
            description: 'Stop real-time audio transcription and finalize subtitle timeline',
            icon: 'Square',
            path: 'Commands > Speech',
            keywords: ['stop', 'end', 'finish', 'speech', 'dung ghi am', 'ket thuc'],
            action: { type: 'command', payload: { commandId: 'session:stop' } },
          }
        : {
            id: 'cmd:session-start',
            category: 'command',
            title: 'Start Listening Session',
            description: 'Begin real-time speech recognition and live multi-engine translation',
            icon: 'Mic',
            path: 'Commands > Speech',
            shortcut: 'Ctrl+Shift+Space',
            keywords: ['start', 'listen', 'record', 'speech', 'bat dau ghi am'],
            action: { type: 'command', payload: { commandId: 'session:start' } },
          },
      ...(isListening
        ? [
            isPaused
              ? {
                  id: 'cmd:session-resume',
                  category: 'command' as const,
                  title: 'Resume Listening Session',
                  description: 'Unpause speech recognition pipeline',
                  icon: 'Play',
                  path: 'Commands > Speech',
                  keywords: ['resume', 'unpause', 'tiep tuc'],
                  action: { type: 'command' as const, payload: { commandId: 'session:resume' } },
                }
              : {
                  id: 'cmd:session-pause',
                  category: 'command' as const,
                  title: 'Pause Listening Session',
                  description: 'Temporarily pause audio processing',
                  icon: 'Pause',
                  path: 'Commands > Speech',
                  keywords: ['pause', 'tam dung'],
                  action: { type: 'command' as const, payload: { commandId: 'session:pause' } },
                },
          ]
        : []),

      // 2. Overlay
      {
        id: 'cmd:overlay-toggle',
        category: 'command',
        title: 'Toggle Floating Subtitle Overlay',
        description: 'Show or hide the transparent always-on-top subtitle window',
        icon: 'ExternalLink',
        path: 'Commands > Overlay',
        shortcut: 'Ctrl+Shift+O',
        keywords: ['overlay', 'floating', 'window', 'transparent', 'phu de noi'],
        action: { type: 'command', payload: { commandId: 'overlay:toggle' } },
      },

      // 3. Screen OCR
      {
        id: 'cmd:ocr-capture',
        category: 'command',
        title: 'Quick Capture & Translate Screen',
        description: 'Select a region on screen to recognize text and translate immediately',
        icon: 'Crop',
        path: 'Commands > OCR',
        shortcut: 'Ctrl+Shift+T',
        keywords: ['capture', 'crop', 'ocr', 'screen translate', 'chup man hinh'],
        action: { type: 'command', payload: { commandId: 'ocr:capture-screen' } },
      },
      {
        id: 'cmd:ocr-continuous',
        category: 'command',
        title: 'Toggle Continuous Screen OCR',
        description: 'Automatically monitor and translate changing text in a screen region',
        icon: 'RefreshCw',
        path: 'Commands > OCR',
        shortcut: 'Ctrl+Shift+R',
        keywords: ['continuous', 'monitor', 'live ocr', 'tu dong dich'],
        action: { type: 'command', payload: { commandId: 'ocr:toggle-continuous' } },
      },

      // 4. Themes
      {
        id: 'cmd:theme-toggle',
        category: 'command',
        title: 'Toggle Color Theme (Dark / Light)',
        description: 'Switch between dark and light appearance modes',
        icon: 'Palette',
        path: 'Commands > Appearance',
        keywords: ['theme', 'dark', 'light', 'mode', 'giao dien', 'sang toi'],
        action: { type: 'command', payload: { commandId: 'theme:toggle' } },
      },
      {
        id: 'cmd:theme-dark',
        category: 'command',
        title: 'Switch to Dark Theme',
        description: 'Enable deep dark mica glass styling',
        icon: 'Moon',
        path: 'Commands > Appearance',
        keywords: ['dark mode', 'theme', 'toi'],
        action: { type: 'command', payload: { commandId: 'theme:dark' } },
      },
      {
        id: 'cmd:theme-light',
        category: 'command',
        title: 'Switch to Light Theme',
        description: 'Enable crisp light glass styling',
        icon: 'Sun',
        path: 'Commands > Appearance',
        keywords: ['light mode', 'theme', 'sang'],
        action: { type: 'command', payload: { commandId: 'theme:light' } },
      },

      // 5. Languages
      {
        id: 'cmd:lang-vi',
        category: 'command',
        title: 'Chuyển Ngôn ngữ sang Tiếng Việt',
        description: 'Đặt ngôn ngữ giao diện người dùng thành Tiếng Việt',
        icon: 'Languages',
        path: 'Commands > Localization',
        keywords: ['tieng viet', 'vietnamese', 'ngon ngu'],
        action: { type: 'command', payload: { commandId: 'locale:vi' } },
      },
      {
        id: 'cmd:lang-en',
        category: 'command',
        title: 'Switch UI Language to English',
        description: 'Set user interface language to English',
        icon: 'Languages',
        path: 'Commands > Localization',
        keywords: ['english', 'en', 'language'],
        action: { type: 'command', payload: { commandId: 'locale:en' } },
      },
      {
        id: 'cmd:lang-zh',
        category: 'command',
        title: '切换界面语言为简体中文 (Chinese)',
        description: '将用户界面语言设置为简体中文',
        icon: 'Languages',
        path: 'Commands > Localization',
        keywords: ['chinese', 'zhongwen', 'jianti', 'yuyan'],
        action: { type: 'command', payload: { commandId: 'locale:zh' } },
      },
      {
        id: 'cmd:lang-ja',
        category: 'command',
        title: 'UI表示言語を日本語に切り替え (Japanese)',
        description: 'ユーザーインターフェース言語を日本語に設定します',
        icon: 'Languages',
        path: 'Commands > Localization',
        keywords: ['japanese', 'nihongo', 'gengo'],
        action: { type: 'command', payload: { commandId: 'locale:ja' } },
      },
      {
        id: 'cmd:lang-ko',
        category: 'command',
        title: 'UI 표시 언어를 한국어로 전환 (Korean)',
        description: '사용자 인터페이스 언어를 한국어로 설정합니다',
        icon: 'Languages',
        path: 'Commands > Localization',
        keywords: ['korean', 'hangugeo', 'eoneo'],
        action: { type: 'command', payload: { commandId: 'locale:ko' } },
      },
      {
        id: 'cmd:lang-es',
        category: 'command',
        title: 'Cambiar Idioma de Interfaz a Español',
        description: 'Establecer el idioma de la interfaz de usuario en español',
        icon: 'Languages',
        path: 'Commands > Localization',
        keywords: ['spanish', 'espanol', 'idioma'],
        action: { type: 'command', payload: { commandId: 'locale:es' } },
      },
      {
        id: 'cmd:lang-fr',
        category: 'command',
        title: 'Passer la Langue de l\'Interface en Français',
        description: 'Définir la langue de l\'interface utilisateur en français',
        icon: 'Languages',
        path: 'Commands > Localization',
        keywords: ['french', 'francais', 'langue'],
        action: { type: 'command', payload: { commandId: 'locale:fr' } },
      },
      {
        id: 'cmd:lang-de',
        category: 'command',
        title: 'Oberflächensprache auf Deutsch umstellen',
        description: 'Benutzeroberflächensprache auf Deutsch festlegen',
        icon: 'Languages',
        path: 'Commands > Localization',
        keywords: ['german', 'deutsch', 'sprache'],
        action: { type: 'command', payload: { commandId: 'locale:de' } },
      },
      {
        id: 'cmd:lang-ru',
        category: 'command',
        title: 'Переключить Язык Интерфейса на Русский',
        description: 'Установить русский язык интерфейса приложения',
        icon: 'Languages',
        path: 'Commands > Localization',
        keywords: ['russian', 'russkiy', 'yazyk'],
        action: { type: 'command', payload: { commandId: 'locale:ru' } },
      },

      // 6. Maintenance & Diagnostics
      {
        id: 'cmd:open-logs',
        category: 'command',
        title: 'Open Diagnostic Logs Directory',
        description: 'Open the local directory containing Winston log files in Explorer',
        icon: 'FileText',
        path: 'Commands > Diagnostics',
        keywords: ['logs', 'debug', 'folder', 'nhat ky', 'thu muc log'],
        action: { type: 'command', payload: { commandId: 'app:open-logs' } },
      },
      {
        id: 'cmd:clear-ocr-history',
        category: 'command',
        title: 'Clear Screen OCR History',
        description: 'Delete all saved OCR translation records from local SQLite storage',
        icon: 'Trash2',
        path: 'Commands > Privacy',
        keywords: ['clear', 'delete', 'ocr history', 'xoa lich su'],
        action: { type: 'command', payload: { commandId: 'history:clear-ocr' } },
      },
      {
        id: 'cmd:reset-settings',
        category: 'command',
        title: 'Reset Application Preferences to Default',
        description: 'Restore all appearance, audio, and subtitle options to original defaults',
        icon: 'RotateCcw',
        path: 'Commands > Settings',
        keywords: ['reset', 'defaults', 'restore', 'dat lai'],
        action: { type: 'command', payload: { commandId: 'settings:reset' } },
      },
    ];

    return items;
  }

  public getResults(query: string): SearchResultItem[] {
    const items = this.getItems();
    if (!query) return items;

    const matched: SearchResultItem[] = [];
    for (const item of items) {
      const match = scoreSearchResult(item, query);
      if (match.score > 0) {
        matched.push({
          ...item,
          score: match.score,
          titleHighlights: match.titleHighlights,
          descHighlights: match.descHighlights,
        });
      }
    }

    return matched;
  }

  public getInitialItems(): SearchResultItem[] {
    return this.getItems().slice(0, 5);
  }
}

