import { describe, it, expect, vi } from 'vitest';
import {
  resampleAudio,
  calculateRms,
  calculatePeak,
  float32ToInt16,
  int16ToFloat32,
  encodeWav,
  VoiceActivityDetector,
  BoundedAudioQueue,
  SpeechPipeline,
  ISpeechProvider,
} from '../index.js';
import { TranscriptionSegment } from '@echo-lingo/contracts';

describe('Speech Core', () => {
  describe('Resampler and Audio Conversion', () => {
    it('resamples audio length proportional to ratio', () => {
      const input = new Float32Array(48000); // 1 second of 48kHz
      for (let i = 0; i < input.length; i++) input[i] = Math.sin(i / 10);

      const resampled = resampleAudio(input, 48000, 16000);
      expect(resampled.length).toBe(16000);
    });

    it('calculates RMS and peak correctly', () => {
      const buffer = new Float32Array([0.5, -0.5, 0.5, -0.5]);
      expect(calculateRms(buffer)).toBeCloseTo(0.5);
      expect(calculatePeak(buffer)).toBe(0.5);
    });

    it('converts Float32 to Int16 PCM and back', () => {
      const original = new Float32Array([0, 0.5, -0.5, 0.99]);
      const int16 = float32ToInt16(original);
      const restored = int16ToFloat32(int16);

      expect(restored[0]).toBeCloseTo(0, 2);
      expect(restored[1]).toBeCloseTo(0.5, 2);
      expect(restored[2]).toBeCloseTo(-0.5, 2);
      expect(restored[3]).toBeCloseTo(0.99, 2);
    });

    it('encodes valid 44-byte WAV header', () => {
      const samples = new Float32Array(1600); // 100ms at 16kHz
      const wav = encodeWav(samples, 16000);
      expect(wav.length).toBe(44 + 1600 * 2);

      // Check RIFF header
      const str = String.fromCharCode(...wav.slice(0, 4));
      expect(str).toBe('RIFF');
    });
  });

  describe('BoundedAudioQueue', () => {
    it('applies backpressure and reports drop when overflowing', () => {
      const queue = new BoundedAudioQueue<number>(3);
      expect(queue.push(1)).toBe(true);
      expect(queue.push(2)).toBe(true);
      expect(queue.push(3)).toBe(true);
      expect(queue.push(4)).toBe(false); // dropped oldest (1)

      expect(queue.length).toBe(3);
      expect(queue.dropped).toBe(1);
      expect(queue.pop()).toBe(2);
    });
  });

  describe('VoiceActivityDetector', () => {
    it('detects silence vs speech and emits finalized chunk after silence timeout', () => {
      const vad = new VoiceActivityDetector({
        threshold: 0.1,
        minSpeechDurationMs: 100,
        silenceTimeoutMs: 100,
        sampleRate: 16000,
      });

      // Frame with silence
      const silenceFrame = new Float32Array(512); // ~32ms of silence
      expect(vad.processFrame(silenceFrame)).toBeNull();
      expect(vad.isSpeechActive).toBe(false);

      // Frames with active sound
      const speechFrame = new Float32Array(512);
      for (let i = 0; i < speechFrame.length; i++) speechFrame[i] = 0.5;

      // 4 frames = ~128ms of speech
      vad.processFrame(speechFrame);
      vad.processFrame(speechFrame);
      vad.processFrame(speechFrame);
      vad.processFrame(speechFrame);
      expect(vad.isSpeechActive).toBe(true);

      // Now feed 4 frames of silence = ~128ms (exceeds silenceTimeoutMs 100ms)
      vad.processFrame(silenceFrame);
      vad.processFrame(silenceFrame);
      vad.processFrame(silenceFrame);
      const event = vad.processFrame(silenceFrame);

      expect(event).not.toBeNull();
      expect(event?.isFinal).toBe(true);
      expect(event?.isSpeech).toBe(true);
      expect(vad.isSpeechActive).toBe(false);
    });
  });

  describe('SpeechPipeline', () => {
    it('coordinates frames, VAD, and transcription callback', async () => {
      const mockProvider: ISpeechProvider = {
        id: 'mock',
        name: 'Mock Speech Provider',
        isLocal: true,
        initialize: async () => {},
        isReady: () => true,
        transcribe: async () => ({
          text: 'Testing live pipeline',
          isFinal: true,
          confidence: 0.98,
          durationMs: 20,
        }),
      };

      const emittedSegments: TranscriptionSegment[] = [];
      const pipeline = new SpeechPipeline({
        sessionId: 'test-session',
        sourceLanguage: 'en',
        provider: mockProvider,
        vadThreshold: 0.05,
        onTranscription: (segment) => {
          emittedSegments.push(segment);
        },
      });

      pipeline.start();

      // Feed active speech frame
      const frame = new Float32Array(16000); // 1s
      for (let i = 0; i < frame.length; i++) frame[i] = 0.2;
      pipeline.feedAudio(frame);

      pipeline.stop();

      // Allow async processing
      await new Promise((r) => setTimeout(r, 50));

      expect(emittedSegments.length).toBeGreaterThan(0);
      expect(emittedSegments[0].text).toBe('Testing live pipeline');
      expect(emittedSegments[0].isFinal).toBe(true);
    });
  });
});
