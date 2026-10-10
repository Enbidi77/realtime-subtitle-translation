import { z } from 'zod';

export const AudioSourceTypeSchema = z.enum(['microphone', 'system', 'file']);
export type AudioSourceType = z.infer<typeof AudioSourceTypeSchema>;

export const AudioStreamStateSchema = z.enum([
  'idle',
  'initializing',
  'listening',
  'paused',
  'stopped',
  'error',
]);
export type AudioStreamState = z.infer<typeof AudioStreamStateSchema>;

export const AudioDeviceInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['audioinput', 'audiooutput']),
  isDefault: z.boolean().optional(),
  groupId: z.string().optional(),
});
export type AudioDeviceInfo = z.infer<typeof AudioDeviceInfoSchema>;

export const AudioLevelEventSchema = z.object({
  rms: z.number().min(0).max(1),
  peak: z.number().min(0).max(1),
  speechDetected: z.boolean(),
  timestamp: z.number(),
});
export type AudioLevelEvent = z.infer<typeof AudioLevelEventSchema>;

export const AudioChunkPayloadSchema = z.object({
  sessionId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  timestamp: z.number(),
  sampleRate: z.number().default(16000),
  samples: z.array(z.number()),
  isSpeech: z.boolean(),
});
export type AudioChunkPayload = z.infer<typeof AudioChunkPayloadSchema>;

export const AudioPipelineStatusSchema = z.object({
  sourceType: AudioSourceTypeSchema,
  deviceName: z.string().optional(),
  state: AudioStreamStateSchema,
  sampleRate: z.number(),
  channelCount: z.number(),
  isSpeechActive: z.boolean(),
  rms: z.number(),
  bufferFillRatio: z.number(),
  lastProcessedTimestamp: z.number().optional(),
  errorMessage: z.string().nullable().optional(),
});
export type AudioPipelineStatus = z.infer<typeof AudioPipelineStatusSchema>;
