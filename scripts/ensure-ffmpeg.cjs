#!/usr/bin/env node
/**
 * ensure-ffmpeg.cjs
 * 
 * Verifies that the FFmpeg executable exists in `apps/desktop/resources/bin/`.
 * If missing, it resolves the binary from `ffmpeg-static` or downloads and
 * decompresses it directly from official static releases.
 * 
 * This ensures:
 * 1. Offline video subtitling / audio extraction works out of the box in development.
 * 2. Electron-builder packages `ffmpeg.exe` into the installer / MSIX `bin/` directory.
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const http = require('node:http');
const { createGunzip } = require('node:zlib');
const { pipeline } = require('node:stream/promises');

const rootDir = path.resolve(__dirname, '..');
const targetDir = path.join(rootDir, 'apps', 'desktop', 'resources', 'bin');
const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const targetPath = path.join(targetDir, exeName);

const args = process.argv.slice(2);
const force = args.includes('--force');

const SUPPORTED_ARCHS = {
  darwin: ['x64', 'arm64'],
  linux: ['x64', 'ia32', 'arm64', 'arm'],
  win32: ['x64', 'ia32'],
};

function downloadAndGunzip(url, destinationPath) {
  return new Promise((resolve, reject) => {
    function get(currentUrl, redirectsLeft = 5) {
      if (redirectsLeft <= 0) {
        return reject(new Error(`Too many redirects downloading ${url}`));
      }

      const client = currentUrl.startsWith('https:') ? https : http;
      const req = client.get(
        currentUrl,
        {
          headers: { 'User-Agent': 'EchoLingo-Downloader' },
        },
        async (res) => {
          if (
            res.statusCode &&
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            res.resume();
            const redirectUrl = new URL(res.headers.location, currentUrl).toString();
            return get(redirectUrl, redirectsLeft - 1);
          }

          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage} from ${currentUrl}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let downloadedBytes = 0;
          let lastReport = 0;

          const tmpDest = `${destinationPath}.tmp_${Date.now()}`;
          const writeStream = fs.createWriteStream(tmpDest);
          const gunzip = createGunzip();

          res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0) {
              const percent = Math.floor((downloadedBytes / totalBytes) * 100);
              if (percent >= lastReport + 10 || percent === 100) {
                lastReport = percent;
                process.stdout.write(
                  `  -> Downloading FFmpeg: ${percent}% (${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB compressed)\r`
                );
              }
            }
          });

          try {
            await pipeline(res, gunzip, writeStream);
            if (fs.existsSync(destinationPath)) {
              await fsp.unlink(destinationPath);
            }
            await fsp.rename(tmpDest, destinationPath);
            if (process.platform !== 'win32') {
              await fsp.chmod(destinationPath, 0o755);
            }
            process.stdout.write('\n');
            resolve();
          } catch (pipelineErr) {
            try {
              if (fs.existsSync(tmpDest)) await fsp.unlink(tmpDest);
            } catch {}
            reject(pipelineErr);
          }
        }
      );

      req.on('error', (err) => {
        reject(err);
      });
    }

    get(url);
  });
}

async function main() {
  if (!fs.existsSync(targetDir)) {
    await fsp.mkdir(targetDir, { recursive: true });
  }

  // 1. Check if binary is already present
  if (!force && fs.existsSync(targetPath)) {
    try {
      const stats = await fsp.stat(targetPath);
      if (stats.size > 1024 * 1024) {
        console.log(`[ensure-ffmpeg] FFmpeg binary already present in resources/bin (${(stats.size / 1024 / 1024).toFixed(1)} MB).`);
        return;
      }
    } catch {
      // Proceed to copy / download
    }
  }

  // 2. Check if ffmpeg-static has it on disk
  try {
    const ffmpegStatic = require('ffmpeg-static');
    const staticPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic?.default;
    if (staticPath && fs.existsSync(staticPath) && staticPath !== targetPath) {
      console.log(`[ensure-ffmpeg] Copying FFmpeg binary from ffmpeg-static (${staticPath}) to resources/bin...`);
      await fsp.copyFile(staticPath, targetPath);
      if (process.platform !== 'win32') {
        await fsp.chmod(targetPath, 0o755);
      }
      console.log(`[ensure-ffmpeg] Successfully prepared FFmpeg in resources/bin.`);
      return;
    }
  } catch {
    // Ignore and proceed to network download
  }

  // 3. Download from official release
  const platform = process.platform;
  const arch = process.arch;

  if (!SUPPORTED_ARCHS[platform] || !SUPPORTED_ARCHS[platform].includes(arch)) {
    console.warn(`[ensure-ffmpeg] Platform ${platform}-${arch} not directly supported for auto-download.`);
    return;
  }

  const release = 'b6.1.1';
  const downloadUrl = `https://github.com/eugeneware/ffmpeg-static/releases/download/${release}/ffmpeg-${platform}-${arch}.gz`;

  console.log(`[ensure-ffmpeg] Downloading FFmpeg binary for ${platform}-${arch}...`);
  console.log(`[ensure-ffmpeg] Source: ${downloadUrl}`);
  try {
    await downloadAndGunzip(downloadUrl, targetPath);
    console.log(`[ensure-ffmpeg] FFmpeg downloaded and ready at ${targetPath}.`);
  } catch (err) {
    console.error(`[ensure-ffmpeg] Failed to download FFmpeg:`, err.message);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`[ensure-ffmpeg] Unexpected error:`, err);
  process.exit(1);
});
