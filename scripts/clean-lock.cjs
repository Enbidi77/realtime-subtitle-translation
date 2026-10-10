const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('[EchoLingo] Cleaning up lingering processes and lockfile...');

try {
  if (process.platform === 'win32') {
    execSync('taskkill /F /IM electron.exe /T', { stdio: 'ignore' });
  } else {
    execSync('pkill -f electron', { stdio: 'ignore' });
  }
} catch {
  // Process might not be running, ignore error
}

const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Application Support') : path.join(process.env.HOME || '', '.config'));
const lockfilePath = path.join(appData, '@echo-lingo', 'desktop', 'lockfile');

try {
  if (fs.existsSync(lockfilePath)) {
    fs.unlinkSync(lockfilePath);
    console.log(`[EchoLingo] Removed lockfile at: ${lockfilePath}`);
  }
} catch (e) {
  console.warn(`[EchoLingo] Could not remove lockfile: ${e.message}`);
}

console.log('[EchoLingo] Ready to launch.');
