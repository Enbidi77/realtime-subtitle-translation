import { z } from 'zod';
import { AudioSourceTypeSchema } from './audio.js';

export const SessionStatusSchema = z.enum(['active', 'paused', 'ended']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionMetadataSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: SessionStatusSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  durationSeconds: z.number().nonnegative().default(0),
  sourceLanguage: z.string(),
  targetLanguages: z.array(z.string()),
  segmentCount: z.number().int().nonnegative().default(0),
  speechProvider: z.string(),
  translationProvider: z.string(),
  audioSourceType: AudioSourceTypeSchema,
  audioDeviceId: z.string().optional(),
});
export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

export const CreateSessionRequestSchema = z.object({
  title: z.string().optional(),
  sourceLanguage: z.string().default('auto'),
  targetLanguages: z.array(z.string()).default(['vi']),
  audioSourceType: AudioSourceTypeSchema.default('microphone'),
  audioDeviceId: z.string().optional(),
  speechProvider: z.string().default('whisper-local'),
  translationProvider: z.string().default('google-web'),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
