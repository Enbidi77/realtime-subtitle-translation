import { z } from 'zod';
import { SubtitleSegmentSchema } from '@echo-lingo/contracts/subtitle.js';

export const SubtitleAlignmentSchema = z.enum([
  'bottom-center',
  'bottom-left',
  'bottom-right',
  'top-center',
  'top-left',
  'top-right',
  'middle-center',
]);
export type SubtitleAlignment = z.infer<typeof SubtitleAlignmentSchema>;

export const SubtitleLayoutModeSchema = z.enum(['single-line', 'bilingual-stacked']);
export type SubtitleLayoutMode = z.infer<typeof SubtitleLayoutModeSchema>;

export const SubtitleStyleOptionsSchema = z.object({
  fontFamily: z.string().default('Arial'),
  fontSize: z.number().int().min(10).max(120).default(28),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  primaryColor: z.string().default('#FFFFFF'),
  secondaryColor: z.string().default('#FACC15'),
  outlineColor: z.string().default('#000000'),
  outlineWidth: z.number().min(0).max(10).default(2),
  shadowColor: z.string().default('#00000080'),
  shadowDistance: z.number().min(0).max(10).default(1),
  backgroundBox: z.boolean().default(false),
  backgroundColor: z.string().default('#00000080'),
  alignment: SubtitleAlignmentSchema.default('bottom-center'),
  verticalMargin: z.number().int().min(0).max(500).default(40),
  horizontalMargin: z.number().int().min(0).max(500).default(30),
  showOriginal: z.boolean().default(true),
  showTranslation: z.boolean().default(true),
  translationLanguage: z.string().optional(),
  layoutMode: SubtitleLayoutModeSchema.default('single-line'),
});
export type SubtitleStyleOptions = z.infer<typeof SubtitleStyleOptionsSchema>;

export const MEDIA_PROTOCOL_SCHEME = 'echolingo-media';

/**
 * Convert local file path or file:// URL to custom echolingo-media:// streaming URL
 */
export function toMediaProtocolUrl(filePath: string): string {
  if (!filePath) return '';
  if (filePath.startsWith(`${MEDIA_PROTOCOL_SCHEME}:`)) return filePath;
  let cleanPath = filePath;
  if (cleanPath.startsWith('file://')) {
    cleanPath = decodeURIComponent(cleanPath.replace(/^file:\/\/\/?/, ''));
    if (/^\/[a-zA-Z]:/.test(cleanPath)) {
      cleanPath = cleanPath.slice(1);
    }
  }
  return `${MEDIA_PROTOCOL_SCHEME}://load?path=${encodeURIComponent(cleanPath)}`;
}

export const VideoMetadataSchema = z.object({
  filePath: z.string(),
  mediaUrl: z.string().optional(),
  fileName: z.string(),
  fileSizeBytes: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aspectRatio: z.string(),
  fps: z.number().positive(),
  videoCodec: z.string(),
  audioCodec: z.string().optional(),
  audioChannels: z.number().int().optional(),
  hasAudio: z.boolean(),
});
export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

export const VideoExportModeSchema = z.enum(['hardsub-burnin', 'softsub-embed']);
export type VideoExportMode = z.infer<typeof VideoExportModeSchema>;

export const VideoCodecSchema = z.enum(['libx264', 'h264_nvenc', 'h264_qsv', 'h264_amf', 'copy']);
export type VideoCodec = z.infer<typeof VideoCodecSchema>;

export const AudioCodecSchema = z.enum(['copy', 'aac']);
export type AudioCodec = z.infer<typeof AudioCodecSchema>;

export const QualityPresetSchema = z.enum(['ultrafast', 'veryfast', 'medium', 'slow']);
export type QualityPreset = z.infer<typeof QualityPresetSchema>;

export const VideoExportOptionsSchema = z.object({
  inputVideoPath: z.string(),
  outputVideoPath: z.string(),
  segments: z.array(SubtitleSegmentSchema),
  style: SubtitleStyleOptionsSchema,
  exportMode: VideoExportModeSchema.default('hardsub-burnin'),
  videoCodec: VideoCodecSchema.default('libx264'),
  audioCodec: AudioCodecSchema.default('copy'),
  qualityPreset: QualityPresetSchema.default('veryfast'),
  crf: z.number().int().min(0).max(51).default(21),
});
export type VideoExportOptions = z.infer<typeof VideoExportOptionsSchema>;

export const VideoExportPhaseSchema = z.enum([
  'extracting-audio',
  'transcribing',
  'generating-ass',
  'encoding',
  'muxing',
  'completed',
  'failed',
  'cancelled',
]);
export type VideoExportPhase = z.infer<typeof VideoExportPhaseSchema>;

export const VideoExportProgressSchema = z.object({
  jobId: z.string(),
  phase: VideoExportPhaseSchema,
  progressPercent: z.number().min(0).max(100),
  currentFrame: z.number().optional(),
  fps: z.number().optional(),
  currentTimeSeconds: z.number().optional(),
  totalDurationSeconds: z.number(),
  estimatedSecondsRemaining: z.number().optional(),
  errorMessage: z.string().optional(),
});
export type VideoExportProgress = z.infer<typeof VideoExportProgressSchema>;

export const VideoTranscribeProgressSchema = z.object({
  phase: z.enum(['extracting', 'transcribing', 'translating', 'completed']),
  percent: z.number().min(0).max(100),
  detail: z.string().optional(),
});
export type VideoTranscribeProgress = z.infer<typeof VideoTranscribeProgressSchema>;

