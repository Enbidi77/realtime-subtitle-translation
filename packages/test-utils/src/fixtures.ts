import { SubtitleSegment } from '@echo-lingo/contracts';

/**
 * Generate a synthetic Float32Array audio buffer
 */
export function generateSineWave(
  frequency = 440,
  durationSec = 1,
  sampleRate = 16000,
  amplitude = 0.5
): Float32Array {
  const sampleCount = Math.floor(durationSec * sampleRate);
  const buffer = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude;
  }
  return buffer;
}

/**
 * Generate silent audio frame
 */
export function generateSilence(durationSec = 1, sampleRate = 16000): Float32Array {
  return new Float32Array(Math.floor(durationSec * sampleRate));
}

export const SAMPLE_SRT_FIXTURE = `1
00:00:01,000 --> 00:00:04,000
Welcome to EchoLingo real-time translation.
Chào mừng bạn đến với bản dịch thời gian thực EchoLingo.

2
00:00:04,500 --> 00:00:07,500
This desktop application provides instant speech recognition.
Ứng dụng máy tính này cung cấp nhận dạng giọng nói tức thì.
`;

export const SAMPLE_SEGMENTS: SubtitleSegment[] = [
  {
    id: 'seg-test-1',
    sessionId: 'session-fixture',
    startTime: 1000,
    endTime: 4000,
    originalText: 'Welcome to EchoLingo real-time translation.',
    translations: { vi: 'Chào mừng bạn đến với bản dịch thời gian thực EchoLingo.' },
    sourceLanguage: 'en',
    targetLanguages: ['vi'],
    status: 'final',
    confidence: 0.98,
    speechProvider: 'whisper-local',
    translationProvider: 'google-web',
    createdAt: Date.now() - 5000,
    updatedAt: Date.now() - 5000,
  },
  {
    id: 'seg-test-2',
    sessionId: 'session-fixture',
    startTime: 4500,
    endTime: 7500,
    originalText: 'This desktop application provides instant speech recognition.',
    translations: { vi: 'Ứng dụng máy tính này cung cấp nhận dạng giọng nói tức thì.' },
    sourceLanguage: 'en',
    targetLanguages: ['vi'],
    status: 'final',
    confidence: 0.96,
    speechProvider: 'whisper-local',
    translationProvider: 'google-web',
    createdAt: Date.now() - 2000,
    updatedAt: Date.now() - 2000,
  },
];
