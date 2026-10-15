import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as https from 'node:https';
import * as http from 'node:http';
import * as path from 'node:path';

export interface DownloadFileOptions {
  onProgress?: (progress: number) => void;
  maxRedirects?: number;
  userAgent?: string;
  headers?: Record<string, string>;
}

/**
 * Downloads a file over HTTP/HTTPS with automatic redirect following and progress reporting.
 * Writes to a temporary file first and renames atomically upon completion.
 */
export function downloadFile(
  fileUrl: string,
  targetPath: string,
  onProgressOrOptions?: ((progress: number) => void) | DownloadFileOptions,
  maxRedirectsParam = 5
): Promise<void> {
  const options: DownloadFileOptions =
    typeof onProgressOrOptions === 'function'
      ? { onProgress: onProgressOrOptions, maxRedirects: maxRedirectsParam }
      : onProgressOrOptions || {};

  const maxRedirects = options.maxRedirects ?? maxRedirectsParam ?? 5;
  const userAgent = options.userAgent ?? 'EchoLingo-Desktop';

  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects while downloading'));
    }

    const tmpPath = `${targetPath}.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const parsed = new URL(fileUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const reqHeaders: Record<string, string> = {
      'User-Agent': userAgent,
      ...(options.headers || {}),
    };

    // Ensure target directory exists
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (mkdirErr) {
        return reject(mkdirErr);
      }
    }

    const req = client.get(fileUrl, { headers: reqHeaders }, (res) => {
      // Follow redirects
      if (
        res.statusCode &&
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location
      ) {
        res.resume();
        const redirectUrl = new URL(res.headers.location, fileUrl).toString();
        return downloadFile(redirectUrl, targetPath, {
          ...options,
          maxRedirects: maxRedirects - 1,
        })
          .then(resolve)
          .catch(reject);
      }

      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`Failed to download ${fileUrl}: HTTP ${res.statusCode}`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      const fileStream = fs.createWriteStream(tmpPath);

      res.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0 && options.onProgress) {
          const pct = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
          options.onProgress(pct);
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(async () => {
          try {
            await fsp.rename(tmpPath, targetPath);
            resolve();
          } catch (renameErr) {
            reject(renameErr);
          }
        });
      });

      fileStream.on('error', (err) => {
        fs.unlink(tmpPath, () => {});
        reject(err);
      });
    });

    req.on('error', (err) => {
      fs.unlink(tmpPath, () => {});
      reject(err);
    });
  });
}

