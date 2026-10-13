import { OcrLanguageInfo, OcrPreprocessOptions, ScreenTranslationSettings } from '@echo-lingo/contracts';

export const DEFAULT_SCREEN_TRANSLATION_SETTINGS: ScreenTranslationSettings = {
  ocrProvider: 'windows-native',
  ocrLanguage: 'auto',
  skipPreview: false,
  profile: 'general',
  continuousIntervalMs: 2000,
  changeThreshold: 0.15,
  ignoreUnchanged: true,
  translateOnlyDiff: false,
  autoHideFloatingPanel: false,
  floatingPanelAutoHideTimeoutMs: 6000,
  floatingPanelAlwaysOnTop: true,
  saveHistory: true,
  persistScreenshots: false,
};

export const OCR_SUPPORTED_LANGUAGES: Array<OcrLanguageInfo & { tesseractCode: string; bcp47: string }> = [
  { code: 'auto', name: 'Auto Detect / System Default', nativeName: 'Tự động phát hiện', tesseractCode: 'eng', bcp47: 'en-US' },
  { code: 'en', name: 'English', nativeName: 'English', tesseractCode: 'eng', bcp47: 'en-US' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', tesseractCode: 'jpn', bcp47: 'ja-JP' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', tesseractCode: 'chi_sim', bcp47: 'zh-Hans-CN' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', tesseractCode: 'chi_tra', bcp47: 'zh-Hant-TW' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', tesseractCode: 'kor', bcp47: 'ko-KR' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', tesseractCode: 'vie', bcp47: 'vi-VN' },
  { code: 'fr', name: 'French', nativeName: 'Français', tesseractCode: 'fra', bcp47: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', tesseractCode: 'deu', bcp47: 'de-DE' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', tesseractCode: 'spa', bcp47: 'es-ES' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', tesseractCode: 'rus', bcp47: 'ru-RU' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', tesseractCode: 'por', bcp47: 'pt-BR' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', tesseractCode: 'ita', bcp47: 'it-IT' },
];

export const OCR_PROFILE_PRESETS: Record<string, OcrPreprocessOptions> = {
  general: {
    profile: 'general',
    grayscale: true,
    contrastStretch: true,
    binarize: false,
    invert: false,
    scale: 1,
  },
  'game-subtitles': {
    profile: 'game-subtitles',
    grayscale: true,
    contrastStretch: true,
    binarize: true,
    invert: false,
    scale: 1,
  },
  'small-ui': {
    profile: 'small-ui',
    grayscale: true,
    contrastStretch: true,
    binarize: false,
    invert: false,
    scale: 2,
  },
  'high-contrast': {
    profile: 'high-contrast',
    grayscale: true,
    contrastStretch: true,
    binarize: true,
    invert: false,
    scale: 1,
  },
  cjk: {
    profile: 'cjk',
    grayscale: true,
    contrastStretch: true,
    binarize: false,
    invert: false,
    scale: 1.5,
  },
  none: {
    profile: 'none',
    grayscale: false,
    contrastStretch: false,
    binarize: false,
    invert: false,
    scale: 1,
  },
};
