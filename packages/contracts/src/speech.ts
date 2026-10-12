import { z } from 'zod';

export const SpeechEngineTypeSchema = z.enum([
  'whisper-local',
  'openai-whisper',
  'groq-whisper',
  'mock',
  'windows-speech',
]);
export type SpeechEngineType = z.infer<typeof SpeechEngineTypeSchema>;

export const TranscriptionSegmentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  text: z.string(),
  isFinal: z.boolean(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
  language: z.string().optional(),
  provider: z.string(),
  createdAt: z.number(),
});
export type TranscriptionSegment = z.infer<typeof TranscriptionSegmentSchema>;

export const TranscriptionEventSchema = z.object({
  sessionId: z.string(),
  segment: TranscriptionSegmentSchema,
  translations: z.record(z.string(), z.string()).optional(),
  pipelineLatencyMs: z.number().optional(),
});
export type TranscriptionEvent = z.infer<typeof TranscriptionEventSchema>;

export const SpeechModelStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  isInstalled: z.boolean(),
  downloadProgress: z.number().min(0).max(100).optional(),
  sizeBytes: z.number().optional(),
  path: z.string().optional(),
  error: z.string().optional(),
});
export type SpeechModelStatus = z.infer<typeof SpeechModelStatusSchema>;
