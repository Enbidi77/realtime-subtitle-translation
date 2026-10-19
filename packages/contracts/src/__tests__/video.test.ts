import { describe, it, expect } from 'vitest';
import {
  toMediaProtocolUrl,
  MEDIA_PROTOCOL_SCHEME,
  VideoMetadataSchema,
  SubtitleStyleOptionsSchema,
} from '../video.js';

describe('Video Contracts & Media Protocol', () => {
  it('converts Windows file paths to echolingo-media:// URL', () => {
    const winPath = 'C:\\Users\\PC\\Downloads\\my_video.mp4';
    const mediaUrl = toMediaProtocolUrl(winPath);

    expect(mediaUrl).toBe('echolingo-media://load?path=C%3A%5CUsers%5CPC%5CDownloads%5Cmy_video.mp4');
  });

  it('converts file:/// URLs to echolingo-media:// URL', () => {
    const fileUrl = 'file:///C:/Users/PC/Downloads/6951813-uhd_3840_2160_25fps_subtitled.mp4';
    const mediaUrl = toMediaProtocolUrl(fileUrl);

    expect(mediaUrl).toBe(
      'echolingo-media://load?path=C%3A%2FUsers%2FPC%2FDownloads%2F6951813-uhd_3840_2160_25fps_subtitled.mp4'
    );
  });

  it('preserves existing echolingo-media URLs without double-wrapping', () => {
    const existing = 'echolingo-media://load?path=something';
    expect(toMediaProtocolUrl(existing)).toBe(existing);
  });

  it('returns empty string for empty input', () => {
    expect(toMediaProtocolUrl('')).toBe('');
  });

  it('validates VideoMetadata with mediaUrl', () => {
    const data = {
      filePath: 'C:\\Videos\\sample.mp4',
      mediaUrl: 'echolingo-media://load?path=C%3A%5CVideos%5Csample.mp4',
      fileName: 'sample.mp4',
      fileSizeBytes: 1048576,
      durationSeconds: 14.5,
      width: 1920,
      height: 1080,
      aspectRatio: '16:9',
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
      hasAudio: true,
    };

    const parsed = VideoMetadataSchema.parse(data);
    expect(parsed.mediaUrl).toBe('echolingo-media://load?path=C%3A%5CVideos%5Csample.mp4');
    expect(parsed.width).toBe(1920);
  });

  it('validates default SubtitleStyleOptions', () => {
    const parsed = SubtitleStyleOptionsSchema.parse({});
    expect(parsed.fontFamily).toBe('Arial');
    expect(parsed.fontSize).toBe(28);
    expect(parsed.alignment).toBe('bottom-center');
  });
});

