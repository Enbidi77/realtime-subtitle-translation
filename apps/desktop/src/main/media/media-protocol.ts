import { protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createLogger } from '@echo-lingo/logger';
import { MEDIA_PROTOCOL_SCHEME } from '@echo-lingo/contracts';

const log = createLogger('MediaProtocol');

/**
 * Register media scheme as privileged. MUST be called BEFORE app.whenReady().
 */
export function registerMediaSchemeAsPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        bypassCSP: true,
        allowServiceWorkers: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);
  log.info(`Privileged scheme "${MEDIA_PROTOCOL_SCHEME}" registered.`);
}

/**
 * Get MIME type by file extension for accurate browser media demuxing
 */
export function getMediaMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mkv':
      return 'video/x-matroska';
    case '.mov':
      return 'video/quicktime';
    case '.avi':
      return 'video/x-msvideo';
    case '.wmv':
      return 'video/x-ms-wmv';
    case '.flv':
      return 'video/x-flv';
    case '.ts':
      return 'video/mp2t';
    case '.ogv':
      return 'video/ogg';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
    case '.oga':
      return 'audio/ogg';
    case '.m4a':
    case '.aac':
      return 'audio/aac';
    case '.flac':
      return 'audio/flac';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Extract normalized absolute local filesystem path from an echolingo-media:// URL
 */
export function extractFilePathFromMediaUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    // 1. Check ?path= parameter (preferred and URL-safe)
    const queryPath = parsed.searchParams.get('path');
    if (queryPath) {
      return path.normalize(decodeURIComponent(queryPath));
    }

    // 2. Direct pathname format: echolingo-media://load/<path> or echolingo-media:///C:/...
    let clean = rawUrl.replace(/^echolingo-media:\/\/(?:load\/)?/, '');
    clean = decodeURIComponent(clean);
    if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(clean)) {
      clean = clean.slice(1);
    }
    return path.normalize(clean);
  } catch (err) {
    log.error(`Failed to parse media URL "${rawUrl}":`, err);
    return '';
  }
}

/**
 * Register the custom protocol handler for echolingo-media:// with full HTTP Range request / 206 Partial Content support.
 * MUST be called in or after app.whenReady().
 */
export function registerMediaProtocolHandler(): void {
  protocol.handle(MEDIA_PROTOCOL_SCHEME, async (request) => {
    const filePath = extractFilePathFromMediaUrl(request.url);

    if (!filePath || !fs.existsSync(filePath)) {
      log.warn(`Media file not found: ${filePath} (requested from ${request.url})`);
      return new Response('Media file not found', { status: 404 });
    }

    try {
      const stat = await fs.promises.stat(filePath);
      const fileSize = stat.size;
      const mimeType = getMediaMimeType(filePath);
      const rangeHeader = request.headers.get('range');

      // 1. Handle HTTP Range Requests (Seeking, progressive chunk buffering)
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
          log.warn(`Invalid range request [${rangeHeader}] for file size ${fileSize}`);
          return new Response(null, {
            status: 416,
            headers: {
              'Content-Range': `bytes */${fileSize}`,
            },
          });
        }

        const chunkSize = end - start + 1;
        const nodeStream = fs.createReadStream(filePath, { start, end });
        const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

        return new Response(webStream, {
          status: 206, // Partial Content
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // 2. Full file response (Initial metadata or complete download)
      const nodeStream = fs.createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
          'Content-Type': mimeType,
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err: any) {
      log.error(`Error serving media file "${filePath}":`, err);
      return new Response(err.message || 'Internal media streaming error', { status: 500 });
    }
  });

  log.info(`Media protocol handler "${MEDIA_PROTOCOL_SCHEME}://" successfully initialized.`);
}
