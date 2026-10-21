#!/usr/bin/env node
const path = require('path');
const cp = require('child_process');
const fs = require('fs');

function rebrandElectron() {
  if (process.platform !== 'win32') {
    return;
  }

  try {
    const rootDir = path.resolve(__dirname, '..');
    const desktopDir = path.join(rootDir, 'apps', 'desktop');

    // 1. Locate electron.exe
    let electronExe;
    try {
      const electronPkgPath = require.resolve('electron', { paths: [desktopDir, rootDir] });
      electronExe = require(electronPkgPath);
    } catch {
      // Electron not installed yet
      return;
    }

    if (!electronExe || !fs.existsSync(electronExe)) {
      return;
    }

    // 2. Locate app-builder binary (contains rcedit)
    let appBuilderPath;
    try {
      const ebPkgPath = require.resolve('electron-builder/package.json', { paths: [desktopDir, rootDir] });
      const ebDir = path.dirname(ebPkgPath);
      const appBuilderPkgPath = require.resolve('app-builder-bin/package.json', { paths: [ebDir, desktopDir, rootDir] });
      const appBuilderBin = require(path.dirname(appBuilderPkgPath));
      appBuilderPath = appBuilderBin.appBuilderPath;
    } catch {
      // app-builder-bin not found
    }

    if (!appBuilderPath || !fs.existsSync(appBuilderPath)) {
      console.warn('[rebrand-electron] app-builder binary not found, skipping dev executable branding.');
      return;
    }

    // 3. Icon path
    const iconPath = path.join(desktopDir, 'build', 'icon.ico');
    const hasIcon = fs.existsSync(iconPath);

    const args = [
      electronExe,
      '--set-version-string', 'FileDescription', 'EchoLingo',
      '--set-version-string', 'ProductName', 'EchoLingo',
    ];

    if (hasIcon) {
      args.push('--set-icon', iconPath);
    }

    cp.execFileSync(appBuilderPath, ['rcedit', '--args', JSON.stringify(args)], {
      stdio: 'pipe',
    });

    console.log('[rebrand-electron] Successfully rebranded electron.exe for EchoLingo.');
  } catch (err) {
    // If the file is locked because electron is currently running, don't crash
    if (err.message && (err.message.includes('EBUSY') || err.message.includes('permission denied'))) {
      console.warn('[rebrand-electron] electron.exe is currently locked by a running process.');
    } else {
      console.warn('[rebrand-electron] Notice: could not patch electron.exe:', err.message || err);
    }
  }
}

rebrandElectron();

