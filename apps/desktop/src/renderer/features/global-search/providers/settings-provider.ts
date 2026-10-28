import { ISearchProvider, SearchResultItem } from '../types.js';
import { scoreSearchResult } from '../scoring.js';
import { useSettingsStore } from '@/stores/settings-store.js';

export class SettingsProvider implements ISearchProvider {
  public readonly id = 'settings';
  public readonly category = 'settings';
  public readonly name = 'Settings';

  private getItems(): SearchResultItem[] {
    const settings = useSettingsStore.getState().settings;

    return [
      {
        id: 'set:theme',
        category: 'settings',
        title: 'Theme & Color Scheme',
        description: `Current: ${settings.theme === 'dark' ? 'Dark' : settings.theme === 'light' ? 'Light' : 'Follow System'}. Select dark, light, or system appearance.`,
        icon: 'Palette',
        path: 'Settings > Appearance',
        keywords: ['theme', 'dark', 'light', 'appearance', 'mau sac', 'giao dien'],
        action: { type: 'setting', payload: { settingKey: 'theme' } },
      },
      {
        id: 'set:glass-intensity',
        category: 'settings',
        title: 'Glassmorphism Intensity',
        description: `Current: ${settings.glassIntensity || 'balanced'}. Control refractive blur and border translucency.`,
        icon: 'Sparkles',
        path: 'Settings > Appearance',
        keywords: ['glass', 'blur', 'intensity', 'mo ao', 'hieu ung kinh'],
        action: { type: 'setting', payload: { settingKey: 'glassIntensity' } },
      },
      {
        id: 'set:locale',
        category: 'settings',
        title: 'Interface Display Language',
        description: `Current: ${{ en: 'English', vi: 'Tiếng Việt', zh: '简体中文', ja: '日本語', ko: '한국어', es: 'Español', fr: 'Français', de: 'Deutsch', ru: 'Русский' }[settings.locale] || 'English'}. Choose application UI language.`,
        icon: 'Languages',
        path: 'Settings > Appearance',
        keywords: ['language', 'locale', 'vietnamese', 'english', 'chinese', 'japanese', 'korean', 'spanish', 'french', 'german', 'russian', 'ngon ngu'],
        action: { type: 'setting', payload: { settingKey: 'locale' } },
      },
      {
        id: 'set:subtitle-font-size',
        category: 'settings',
        title: 'Subtitle Font Size',
        description: `Current: ${settings.subtitleAppearance?.fontSize || 24}px. Adjust typography scale for live subtitles.`,
        icon: 'Captions',
        path: 'Settings > Subtitles',
        keywords: ['font size', 'subtitle text size', 'co chu', 'phu de'],
        action: { type: 'setting', payload: { settingKey: 'fontSize' } },
      },
      {
        id: 'set:subtitle-opacity',
        category: 'settings',
        title: 'Subtitle Background Opacity',
        description: `Current: ${Math.round((settings.subtitleAppearance?.backgroundOpacity || 0.88) * 100)}%. Change backdrop transparency for captions.`,
        icon: 'Layers',
        path: 'Settings > Subtitles',
        keywords: ['opacity', 'transparency', 'background', 'do mo'],
        action: { type: 'setting', payload: { settingKey: 'backgroundOpacity' } },
      },
      {
        id: 'set:subtitle-alignment',
        category: 'settings',
        title: 'Subtitle Text Alignment',
        description: `Current: ${settings.subtitleAppearance?.textAlignment || 'center'}. Align captions to center or left.`,
        icon: 'Sliders',
        path: 'Settings > Subtitles',
        keywords: ['alignment', 'align', 'center', 'left', 'can le'],
        action: { type: 'setting', payload: { settingKey: 'textAlignment' } },
      },
      {
        id: 'set:subtitle-display-mode',
        category: 'settings',
        title: 'Subtitle Display Mode',
        description: `Current: ${settings.subtitleAppearance?.displayMode || 'both'}. Show dual bilingual, translation-only, or original-only.`,
        icon: 'Captions',
        path: 'Settings > Subtitles',
        keywords: ['display mode', 'bilingual', 'original', 'translation', 'che do hien thi'],
        action: { type: 'setting', payload: { settingKey: 'displayMode' } },
      },
      {
        id: 'set:audio-source',
        category: 'settings',
        title: 'Audio Input Source',
        description: `Current: ${settings.audioSourceType === 'system' ? 'System Audio (PC/YouTube)' : 'Microphone'}. Choose audio capture device.`,
        icon: 'Mic',
        path: 'Settings > Audio & VAD',
        keywords: ['audio', 'microphone', 'system audio', 'youtube', 'nguon am thanh', 'loa'],
        action: { type: 'setting', payload: { settingKey: 'audioSource' } },
      },
      {
        id: 'set:vad-sensitivity',
        category: 'settings',
        title: 'Voice Activity Detection (VAD) Sensitivity',
        description: `Current threshold: ${settings.vadSensitivity || 0.02}. Configure RMS energy threshold to filter background noise.`,
        icon: 'Sliders',
        path: 'Settings > Audio & VAD',
        keywords: ['vad', 'sensitivity', 'threshold', 'noise', 'do nhay giong noi'],
        action: { type: 'setting', payload: { settingKey: 'vadSensitivity' } },
      },
      {
        id: 'set:speech-engine',
        category: 'settings',
        title: 'Speech Recognition Engine',
        description: `Current: ${settings.speechEngine || 'whisper-local'}. Local Whisper, Windows SAPI, Groq Whisper, or OpenAI.`,
        icon: 'Cpu',
        path: 'Settings > Speech',
        keywords: ['engine', 'speech provider', 'whisper', 'sapi', 'nhan dien giong noi'],
        action: { type: 'setting', payload: { settingKey: 'speechEngine' } },
      },
      {
        id: 'set:whisper-model',
        category: 'settings',
        title: 'Local Whisper Model Size',
        description: `Current: ${settings.localWhisperModel || 'tiny'}. Download and select Whisper model (tiny, base, small).`,
        icon: 'Download',
        path: 'Settings > Speech',
        keywords: ['whisper model', 'tiny', 'base', 'small', 'mo hinh whisper'],
        action: { type: 'setting', payload: { settingKey: 'whisperModel' } },
      },
      {
        id: 'set:translation-provider',
        category: 'settings',
        title: 'Default Translation Provider',
        description: `Current: ${settings.translationProvider || 'google-web'}. Google Web, DeepL, LibreTranslate, or Ollama.`,
        icon: 'Languages',
        path: 'Settings > Translation',
        keywords: ['translation engine', 'deepl', 'google', 'ollama', 'bo dich'],
        action: { type: 'setting', payload: { settingKey: 'translationProvider' } },
      },
      {
        id: 'set:show-paid-providers',
        category: 'settings',
        title: 'Show Paid Translation & Subtitle Providers',
        description: `Current: ${settings.showPaidProviders ? 'Enabled' : 'Disabled'}. Show commercial cloud providers like OpenAI Whisper, Google Cloud, and DeepL.`,
        icon: 'CreditCard',
        path: 'Settings > Providers',
        keywords: ['paid', 'commercial', 'openai', 'deepl', 'google cloud', 'nha cung cap tra phi', 'show paid'],
        action: { type: 'setting', payload: { settingKey: 'showPaidProviders' } },
      },
      {
        id: 'set:close-behavior',
        category: 'settings',
        title: 'Window Close Behavior',
        description: `Current: ${settings.closeBehavior || 'ask'}. Ask confirmation, minimize to system tray, or quit immediately.`,
        icon: 'AppWindow',
        path: 'Settings > Lifecycle',
        keywords: ['close', 'tray', 'minimize', 'quit', 'dong cua so'],
        action: { type: 'setting', payload: { settingKey: 'closeBehavior' } },
      },
      {
        id: 'set:keyboard-shortcuts',
        category: 'settings',
        title: 'Global Keyboard Shortcuts Configuration',
        description: 'Review and configure hotkeys for overlay, screen OCR, and speech control.',
        icon: 'Keyboard',
        path: 'Settings > Shortcuts',
        keywords: ['shortcuts', 'hotkeys', 'keybindings', 'phim tat'],
        action: { type: 'setting', payload: { settingKey: 'shortcuts' } },
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
    return this.getItems().slice(0, 3);
  }
}

