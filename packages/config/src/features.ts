import { AppPage, FeatureFlags } from "@echo-lingo/contracts";

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  liveSubtitles: true,
  videoSubtitles: true,
  screenOcr: true,
  sessions: true,
  history: true,
  providers: false,
};

/**
 * Determines whether a specific application feature / navigation page is enabled
 * according to active feature flags.
 *
 * Core navigation pages ('dashboard' and 'settings') are always enabled.
 * Feature flags support both camelCase ('videoSubtitles') and kebab-case ('video-subtitles').
 */
export function isFeatureEnabled(
  feature: AppPage | string,
  flags?: Partial<FeatureFlags> | Record<string, boolean | undefined>,
): boolean {
  if (feature === "dashboard" || feature === "settings") {
    return true;
  }
  if (!flags) {
    return true;
  }

  // 1. Direct key match (e.g. flags['video-subtitles'] or flags['videoSubtitles'])
  if (feature in flags && flags[feature] !== undefined) {
    return Boolean(flags[feature]);
  }

  // 2. Canonical mapping between AppPage and FeatureFlags
  switch (feature) {
    case "live-subtitles":
    case "liveSubtitles":
      return flags.liveSubtitles ?? true;
    case "video-subtitles":
    case "videoSubtitles":
      return flags.videoSubtitles ?? true;
    case "ocr-translate":
    case "screenOcr":
    case "screen-ocr":
      return flags.screenOcr ?? flags["ocr-translate"] ?? true;
    case "sessions":
      return flags.sessions ?? true;
    case "history":
      return flags.history ?? true;
    case "providers":
      return flags.providers ?? true;
    default:
      return true;
  }
}
