import { z } from 'zod';

export const SubtitleSegmentStatusSchema = z.enum(['partial', 'final']);
export type SubtitleSegmentStatus = z.infer<typeof SubtitleSegmentStatusSchema>;

export const SubtitleSegmentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  startTime: z.number().nonnegative(), // in milliseconds from session start
  endTime: z.number().nonnegative(),
  originalText: z.string(),
  translations: z.record(z.string(), z.string()).default({}), // targetLangCode -> translatedText
  sourceLanguage: z.string(),
  targetLanguages: z.array(z.string()).default([]),
  status: SubtitleSegmentStatusSchema,
  confidence: z.number().min(0).max(1).optional(),
  speechProvider: z.string(),
  translationProvider: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type SubtitleSegment = z.infer<typeof SubtitleSegmentSchema>;

export const SubtitleExportFormatSchema = z.enum(['srt', 'vtt', 'txt', 'json']);
export type SubtitleExportFormat = z.infer<typeof SubtitleExportFormatSchema>;

export const SubtitleExportOptionsSchema = z.object({
  format: SubtitleExportFormatSchema,
  includeOriginal: z.boolean().default(true),
  targetLanguage: z.string().optional(),
  includeTimestamps: z.boolean().default(true),
});
export type SubtitleExportOptions = z.infer<typeof SubtitleExportOptionsSchema>;
