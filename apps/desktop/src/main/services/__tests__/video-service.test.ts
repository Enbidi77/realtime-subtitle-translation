import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => path.resolve(process.cwd(), 'temp-test-userdata', name)),
    getAppPath: vi.fn(() => path.resolve(process.cwd(), 'apps/desktop')),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

vi.mock('../speech-service.js', () => ({
  getSpeechService: vi.fn(() => ({})),
}));

vi.mock('../translation-service.js', () => ({
  getTranslationService: vi.fn(() => ({})),
}));

describe('VideoService FFmpeg Resolution & Installation', () => {
  it('resolves FFmpeg binary from ffmpeg-static or resources/bin', async () => {
    const { VideoService } = await import('../video-service.js');
    const service = VideoService.getInstance();
    const resolved = service.resolveFfmpegBinary();

    expect(resolved).toBeTruthy();
    expect(typeof resolved).toBe('string');
    expect(fs.existsSync(resolved!)).toBe(true);
  });

  it('checks FFmpeg availability via checkFfmpeg()', async () => {
    const { VideoService } = await import('../video-service.js');
    const service = VideoService.getInstance();
    const check = service.checkFfmpeg();

    expect(check.available).toBe(true);
    expect(check.path).toBeTruthy();
    expect(fs.existsSync(check.path!)).toBe(true);
  });

  it('resolves immediately when already available during downloadAndInstallFfmpeg()', async () => {
    const { VideoService } = await import('../video-service.js');
    const service = VideoService.getInstance();
    const progressCalls: number[] = [];

    const result = await service.downloadAndInstallFfmpeg((p) => {
      progressCalls.push(p);
    });

    expect(result.success).toBe(true);
    expect(result.path).toBeTruthy();
    expect(fs.existsSync(result.path)).toBe(true);
    expect(progressCalls).toContain(100);
  });
});
