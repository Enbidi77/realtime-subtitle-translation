import { ISearchProvider, SearchResultItem } from '../types.js';
import { scoreSearchResult } from '../scoring.js';
import { useSessionStore } from '@/stores/session-store.js';

export class NavigationProvider implements ISearchProvider {
  public readonly id = 'navigation';
  public readonly category = 'navigation';
  public readonly name = 'Navigation';

  private getItems(): SearchResultItem[] {
    const isListening = useSessionStore.getState().isListening;

    return [
      {
        id: 'nav:dashboard',
        category: 'navigation',
        title: 'Home & Dashboard',
        description: 'Audio pipeline status, quick start, recent sessions, and translation testing',
        icon: 'LayoutDashboard',
        path: 'Navigation',
        keywords: ['home', 'dashboard', 'status', 'start', 'trang chu'],
        action: { type: 'navigate', payload: { page: 'dashboard' } },
      },
      {
        id: 'nav:live-subtitles',
        category: 'navigation',
        title: 'Live Subtitles',
        description: isListening
          ? 'Active speech recognition session is currently listening'
          : 'Real-time speech recognition and live multi-language subtitle stream',
        icon: 'Mic',
        path: 'Navigation',
        badge: isListening ? 'Active' : undefined,
        keywords: ['live', 'subtitles', 'mic', 'speech', 'phu de', 'truc tiep', 'ghi am'],
        action: { type: 'navigate', payload: { page: 'live-subtitles' } },
      },
      {
        id: 'nav:ocr-translate',
        category: 'navigation',
        title: 'Screen OCR & Translate',
        description: 'Interactive screen crop, continuous visual monitoring, and on-screen translation',
        icon: 'ScanText',
        path: 'Navigation',
        keywords: ['ocr', 'screen', 'crop', 'capture', 'translate', 'chup man hinh', 'dich man hinh'],
        action: { type: 'navigate', payload: { page: 'ocr-translate' } },
      },
      {
        id: 'nav:sessions',
        category: 'navigation',
        title: 'Sessions & Subtitles',
        description: 'Browse recorded audio sessions, manage transcripts, and export SRT / VTT files',
        icon: 'FolderKanban',
        path: 'Navigation',
        keywords: ['sessions', 'history', 'export', 'srt', 'vtt', 'phien', 'phien dich'],
        action: { type: 'navigate', payload: { page: 'sessions' } },
      },
      {
        id: 'nav:history',
        category: 'navigation',
        title: 'Translation History',
        description: 'Full record of captured screen translations and recognized text snippets',
        icon: 'History',
        path: 'Navigation',
        keywords: ['history', 'ocr history', 'records', 'lich su dich'],
        action: { type: 'navigate', payload: { page: 'history' } },
      },
      {
        id: 'nav:providers',
        category: 'navigation',
        title: 'AI Providers & Models',
        description: 'Configure Whisper speech models, Google/DeepL/Ollama translation, and API keys',
        icon: 'Cpu',
        path: 'Navigation',
        keywords: ['providers', 'models', 'whisper', 'deepl', 'ollama', 'groq', 'api keys', 'nha cung cap'],
        action: { type: 'navigate', payload: { page: 'providers' } },
      },
      {
        id: 'nav:settings',
        category: 'navigation',
        title: 'Application Settings',
        description: 'Customize theme, glassmorphism, subtitle appearance, audio devices, and hotkeys',
        icon: 'Settings',
        path: 'Navigation',
        keywords: ['settings', 'preferences', 'theme', 'appearance', 'hotkeys', 'cai dat', 'tuy chon'],
        action: { type: 'navigate', payload: { page: 'settings' } },
      },
    ];
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
    return this.getItems().slice(0, 4);
  }
}

