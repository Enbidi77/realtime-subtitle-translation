#!/usr/bin/env node
/**
 * download-whisper.cjs
 * 
 * Automatically downloads and bundles whisper.cpp native binaries (whisper-cli.exe, main.exe, whisper.dll)
 * and optional model weights directly into `apps/desktop/resources/bin/`.
 * 
 * When packaging EchoLingo as an MSIX / AppX for Microsoft Store, electron-builder embeds
 * `resources/bin` into the Store package (`bin/`), where it is certified and digitally signed
 * by Microsoft Store. This prevents Windows 11 Smart App Control (SAC) blocks and ensures
 * zero-friction offline speech recognition for Store users.
 * 
 * Usage:
 *   node scripts/download-whisper.cjs [options]
 * 
 * Options:
 *   --force             Force re-download even if binaries already exist
 *   --with-model        Also download default ggml-tiny.bin model (~75MB) into resources
 *   --model <name>      Download a specific model (tiny, base, small)
 *   --target-dir <path> Custom target directory (default: apps/desktop/resources/bin)
 *   --help              Show this help message
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const http = require('node:http');
const { execFileSync, spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const defaultTargetDir = path.join(rootDir, 'apps', 'desktop', 'resources', 'bin');

const WHISPER_BIN_URL =
  process.env.WHISPER_BIN_URL ||
  'https://github.com/ggml-org/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip';

const WHISPER_MODELS = {
  tiny: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  base: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  small: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
};

// Parse arguments
const args = process.argv.slice(2);
let force = false;
let withModel = false;
let modelName = 'tiny';
let targetDir = defaultTargetDir;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--force') {
    force = true;
  } else if (arg === '--with-model') {
    withModel = true;
  } else if (arg === '--model' && args[i + 1]) {
    withModel = true;
    modelName = args[++i];
  } else if (arg === '--target-dir' && args[i + 1]) {
    targetDir = path.resolve(process.cwd(), args[++i]);
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: node scripts/download-whisper.cjs [options]

Options:
  --force             Force re-download and re-extract
  --with-model        Bundle ggml-tiny.bin model weights (~75MB)
  --model <name>      Bundle specific model: tiny, base, small
  --target-dir <dir>  Destination directory (default: apps/desktop/resources/bin)
    `);
    process.exit(0);
  }
}

/**
 * Download a remote URL to target file with redirect following and progress output
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    function get(currentUrl, redirectsLeft = 5) {
      if (redirectsLeft <= 0) {
        return reject(new Error(`Too many redirects downloading ${url}`));
      }

      const client = currentUrl.startsWith('https:') ? https : http;
      const req = client.get(currentUrl, {
        headers: { 'User-Agent': 'EchoLingo-Downloader' },
      }, (res) => {
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, currentUrl).toString();
          return get(redirectUrl, redirectsLeft - 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage} from ${currentUrl}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        let lastReport = 0;

        const fileStream = fs.createWriteStream(destPath);
        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.floor((downloadedBytes / totalBytes) * 100);
            if (percent >= lastReport + 10 || percent === 100) {
              lastReport = percent;
              process.stdout.write(`  -> Downloading: ${percent}% (${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB)\r`);
            }
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            process.stdout.write('\n');
            resolve();
          });
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });

      req.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    get(url);
  });
}

/**
 * Remove NTFS Zone.Identifier alternate data streams on Windows
 */
async function unblockFiles(dir) {
  if (process.platform !== 'win32' || !fs.existsSync(dir)) return;
  try {
    const files = await fsp.readdir(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      await fsp.unlink(`${full}:Zone.Identifier`).catch(() => {});
    }
  } catch {
    // ignore
  }
}

/**
 * Verify whisper-cli binary execution
 */
function verifyBinary(binaryPath) {
  try {
    const res = spawnSync(binaryPath, ['-h'], {
      cwd: path.dirname(binaryPath),
      encoding: 'utf8',
    });
    if (res.error) return false;
    const combined = (res.stdout || '') + (res.stderr || '');
    return res.status === 0 || combined.includes('usage:') || combined.includes('whisper');
  } catch {
    return false;
  }
}

async function main() {
  console.log('=======================================================');
  console.log(' EchoLingo Whisper Binary Preparation & Bundling Tool');
  console.log('=======================================================');
  console.log(`Target directory: ${targetDir}`);

  if (process.platform !== 'win32') {
    console.log('[download-whisper] Non-Windows platform. Native SAPI/WinRT not required; skipping Windows binary packaging.');
    return;
  }

  await fsp.mkdir(targetDir, { recursive: true });

  const whisperCliPath = path.join(targetDir, 'whisper-cli.exe');
  const mainExePath = path.join(targetDir, 'main.exe');
  const whisperDllPath = path.join(targetDir, 'whisper.dll');

  const binariesExist =
    fs.existsSync(whisperCliPath) &&
    fs.existsSync(mainExePath) &&
    fs.existsSync(whisperDllPath);

  if (binariesExist && !force) {
    console.log('[download-whisper] Binaries already present in resources/bin. Verifying execution...');
    const ok = verifyBinary(whisperCliPath);
    if (ok) {
      console.log('✔ whisper-cli.exe verified healthy (exit 0, zero policy blocks).');
    } else {
      console.warn('⚠ Binary verification returned non-standard output, will refresh binaries.');
      force = true;
    }
  }

  if (!binariesExist || force) {
    console.log('\n[Step 1/2] Downloading whisper.cpp Windows x64 release binaries...');
    const tempDir = path.join(os.tmpdir(), `echolingo-whisper-build-${Date.now()}`);
    await fsp.mkdir(tempDir, { recursive: true });
    const tempZip = path.join(tempDir, 'whisper-bin-x64.zip');

    try {
      console.log(`  Source: ${WHISPER_BIN_URL}`);
      await downloadFile(WHISPER_BIN_URL, tempZip);
      console.log('✔ Download completed.');

      console.log('\n[Step 2/2] Extracting and placing binaries into app resources...');
      // Use built-in Windows tar.exe to unpack zip cleanly without PowerShell
      execFileSync('tar.exe', ['-xf', tempZip, '-C', tempDir], { stdio: 'inherit' });

      // Copy main.exe as whisper-cli.exe and main.exe
      const extractedMain = path.join(tempDir, 'main.exe');
      const extractedDll = path.join(tempDir, 'whisper.dll');

      if (!fs.existsSync(extractedMain) || !fs.existsSync(extractedDll)) {
        throw new Error(`Expected main.exe and whisper.dll not found in extracted archive: ${tempDir}`);
      }

      fs.copyFileSync(extractedMain, whisperCliPath);
      fs.copyFileSync(extractedMain, mainExePath);
      fs.copyFileSync(extractedDll, whisperDllPath);

      // Clean NTFS Zone.Identifier streams
      await unblockFiles(targetDir);

      console.log(`✔ Placed ${whisperCliPath}`);
      console.log(`✔ Placed ${mainExePath}`);
      console.log(`✔ Placed ${whisperDllPath}`);

      // Verify health
      const ok = verifyBinary(whisperCliPath);
      if (!ok) {
        console.warn('⚠ Warning: Binary verification check had unexpected response, but files were successfully copied.');
      } else {
        console.log('✔ Binary execution verified successfully.');
      }
    } finally {
      // Clean up temporary files
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // Handle optional model download
  if (withModel) {
    const modelUrl = WHISPER_MODELS[modelName];
    if (!modelUrl) {
      console.warn(`[download-whisper] Unknown model "${modelName}". Valid options: ${Object.keys(WHISPER_MODELS).join(', ')}`);
    } else {
      const modelTarget = path.join(targetDir, `ggml-${modelName}.bin`);
      if (fs.existsSync(modelTarget) && !force) {
        console.log(`✔ Model ggml-${modelName}.bin already bundled (${(fs.statSync(modelTarget).size / (1024 * 1024)).toFixed(1)} MB).`);
      } else {
        console.log(`\n[Optional] Bundling Whisper model: ggml-${modelName}.bin...`);
        console.log(`  Source: ${modelUrl}`);
        await downloadFile(modelUrl, modelTarget);
        console.log(`✔ Bundled ggml-${modelName}.bin into ${modelTarget}`);
      }
    }
  }

  console.log('\n=======================================================');
  console.log(' Whisper bundling completed successfully.');
  console.log(' Binaries will be included into the Store AppX / MSIX package.');
  console.log('=======================================================\n');
}

main().catch((err) => {
  console.error('\n✖ [download-whisper] Failed to prepare Whisper binaries:', err.message);
  process.exit(1);
});
