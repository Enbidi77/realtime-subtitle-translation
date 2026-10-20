import { ISearchProvider, SearchResultItem } from '../types.js';
import { scoreSearchResult } from '../scoring.js';

export class HelpProvider implements ISearchProvider {
  public readonly id = 'help';
  public readonly category = 'help';
  public readonly name = 'Help & Documentation';

  private getItems(): SearchResultItem[] {
    return [
      {
        id: 'help:interactive-tour',
        category: 'help',
        title: 'Interactive App Tour & Getting Started Guide',
        description: 'Launch the interactive step-by-step walkthrough for audio sources, subtitle overlay, screen OCR, and shortcuts.',
        icon: 'Sparkles',
        path: 'Help & Documentation',
        keywords: ['tour', 'guide', 'tutorial', 'instructions', 'getting started', 'huong dan', 'bat dau', 'gioi thieu'],
        action: { type: 'command', payload: { commandId: 'tour:open', step: 0 } },
      },
      {
        id: 'help:system-audio',
        category: 'help',
        title: 'Capturing System Audio (YouTube, Meetings, Media)',
        description: 'Set Audio Source to "System Audio" in Home or Settings to capture PC sound directly without picking up microphone room noise.',
        icon: 'HelpCircle',
        path: 'Help & Documentation',
        keywords: ['youtube', 'system audio', 'meeting', 'pc sound', 'huong dan', 'bat tieng may'],
        action: { type: 'navigate', payload: { page: 'dashboard' } },
      },
      {
        id: 'help:screen-ocr',
        category: 'help',
        title: 'Using Screen Translation & OCR',
        description: 'Press Ctrl+Shift+T anytime to freeze and select a region on screen for instant OCR recognition and translation.',
        icon: 'HelpCircle',
        path: 'Help & Documentation',
        keywords: ['ocr guide', 'screen crop', 'hotkey', 'dich man hinh'],
        action: { type: 'navigate', payload: { page: 'ocr-translate' } },
      },
      {
        id: 'help:local-whisper',
        category: 'help',
        title: '100% Offline Speech Recognition with Whisper',
        description: 'Download the tiny or base Whisper model in Providers to transcribe speech completely offline with zero internet connection.',
        icon: 'HelpCircle',
        path: 'Help & Documentation',
        keywords: ['offline', 'whisper', 'local', 'private', 'ngoai tuyen'],
        action: { type: 'navigate', payload: { page: 'providers' } },
      },
      {
        id: 'help:shortcuts-cheatsheet',
        category: 'help',
        title: 'Keyboard Shortcuts Reference',
        description: 'Ctrl+K (Search), Ctrl+Shift+P (Palette), Ctrl+Shift+O (Overlay), Ctrl+Shift+T (Screen OCR), Ctrl+Shift+R (Continuous OCR).',
        icon: 'Keyboard',
        path: 'Help & Documentation',
        keywords: ['shortcuts', 'hotkeys', 'reference', 'cheatsheet', 'phim tat'],
        action: { type: 'setting', payload: { settingKey: 'shortcuts' } },
      },
      {
        id: 'help:export-subtitles',
        category: 'help',
        title: 'Exporting Subtitles (SRT, VTT, TXT, JSON)',
        description: 'Navigate to Sessions tab to export recorded sessions into standard industry subtitle formats for video editors.',
        icon: 'FileText',
        path: 'Help & Documentation',
        keywords: ['export', 'srt', 'vtt', 'txt', 'xuat phu de'],
        action: { type: 'navigate', payload: { page: 'sessions' } },
      },
      {
        id: 'help:privacy',
        category: 'help',
        title: 'Privacy & Offline Guarantee',
        description: 'EchoLingo does not collect telemetry, background analytics, or silently upload speech data. All SQLite data stays on your machine.',
        icon: 'ShieldCheck',
        path: 'Help & Documentation',
        keywords: ['privacy', 'offline', 'security', 'telemetry', 'bao mat'],
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
    return this.getItems().slice(0, 2);
  }
}

