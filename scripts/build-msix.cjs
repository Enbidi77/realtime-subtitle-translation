#!/usr/bin/env node
/**
 * build-msix.cjs
 * 
 * Automates building and packaging EchoLingo as an MSIX / AppX package for Microsoft Partner Center.
 * 
 * Usage:
 *   node scripts/build-msix.cjs [version] [--identity <Name>] [--publisher <CN=...>] [--publisher-display-name <DisplayName>]
 * 
 * Examples:
 *   node scripts/build-msix.cjs 1.0.0
 *   node scripts/build-msix.cjs 1.0.0 --identity EchoLingo --publisher "CN=12345678-ABCD-EF01-2345-6789ABCDEF01"
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const rootPkgPath = path.join(rootDir, 'package.json');
const desktopPkgPath = path.join(rootDir, 'apps', 'desktop', 'package.json');

const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf8'));

// Parse arguments
const args = process.argv.slice(2);
let targetVersion = null;
let identityName = process.env.APPX_IDENTITY_NAME || 'Enbidi.EchoLingoApp';
let publisher = process.env.APPX_PUBLISHER || 'CN=7D350121-9482-4DA4-B852-3D95D4F0BF11';
let publisherDisplayName = process.env.APPX_PUBLISHER_DISPLAY_NAME || 'Enbidi';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--identity' && args[i + 1]) {
    identityName = args[++i];
  } else if (arg === '--publisher' && args[i + 1]) {
    publisher = args[++i];
  } else if (arg === '--publisher-display-name' && args[i + 1]) {
    publisherDisplayName = args[++i];
  } else if (!arg.startsWith('-') && !targetVersion) {
    targetVersion = arg;
  }
}

if (!targetVersion) {
  targetVersion = rootPkg.version || '1.0.0';
  console.log(`[build-msix] No version specified. Using current version: ${targetVersion}`);
} else {
  const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
  if (!semverRegex.test(targetVersion)) {
    console.error(`[build-msix] Error: Invalid semver format "${targetVersion}". Expected format like 1.0.0 or 1.0.1`);
    process.exit(1);
  }
}

console.log(`=======================================================`);
console.log(` Building EchoLingo MSIX / AppX v${targetVersion} for Microsoft Partner Center`);
console.log(`=======================================================\n`);

// 1. Update version in package.json files
if (rootPkg.version !== targetVersion) {
  rootPkg.version = targetVersion;
  fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n', 'utf8');
  console.log(`✔ Updated root package.json -> v${targetVersion}`);
}

if (desktopPkg.version !== targetVersion) {
  desktopPkg.version = targetVersion;
  fs.writeFileSync(desktopPkgPath, JSON.stringify(desktopPkg, null, 2) + '\n', 'utf8');
  console.log(`✔ Updated apps/desktop/package.json -> v${targetVersion}`);
}

// 2. Build .NET IPC binary
console.log('\n[Step 1/3] Building .NET IPC binary...');
try {
  execSync('node scripts/build-dotnet.cjs', { stdio: 'inherit', cwd: rootDir });
  console.log('✔ .NET IPC binary build completed.');
} catch (err) {
  console.error('✖ Failed building .NET IPC binary:', err.message);
  process.exit(1);
}

// 3. Build Desktop Renderer & Main bundles, and package AppX
console.log('\n[Step 2/3] Building Electron Vite app and MSIX / AppX package...');
try {
  const overrideArgs = [];
  if (identityName) {
    overrideArgs.push(`-c.appx.identityName="${identityName}"`);
  }
  if (publisher) {
    overrideArgs.push(`-c.appx.publisher="${publisher}"`);
  }
  if (publisherDisplayName) {
    overrideArgs.push(`-c.appx.publisherDisplayName="${publisherDisplayName}"`);
  }

  const cmd = `pnpm --filter @echo-lingo/desktop package:appx ${overrideArgs.length ? '-- ' + overrideArgs.join(' ') : ''}`;
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: rootDir });
  console.log('✔ AppX / MSIX packaging completed successfully.');
} catch (err) {
  console.error('✖ Failed packaging AppX / MSIX:', err.message);
  process.exit(1);
}

// 4. Verify output and create .msix alias copy
console.log('\n[Step 3/3] Verifying output artifacts...');
const releaseDir = path.join(rootDir, 'apps', 'desktop', 'release', targetVersion);
const appxPath = path.join(releaseDir, `EchoLingo-${targetVersion}.appx`);
const msixPath = path.join(releaseDir, `EchoLingo-${targetVersion}.msix`);

if (fs.existsSync(appxPath)) {
  // Create .msix copy so user has both .appx and .msix formats ready
  try {
    fs.copyFileSync(appxPath, msixPath);
  } catch {
    // ignore
  }

  const stats = fs.statSync(appxPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('\n=======================================================');
  console.log(' Build Result & Microsoft Partner Center Details');
  console.log('=======================================================');
  console.log(`✔ AppX Package: ${appxPath}`);
  console.log(`✔ MSIX Package: ${msixPath}`);
  console.log(`✔ Package Size: ${sizeMB} MB`);
  console.log('\n--- HOW TO SUBMIT TO MICROSOFT STORE ---');
  console.log('1. Go to Microsoft Partner Center -> Your App -> Packages');
  console.log('2. Drag & drop either the .msix or .appx file into the Packages box.');
  console.log('3. Microsoft Store will automatically validate and digitally sign the package for free.');
  console.log('=======================================================\n');
} else {
  console.warn(`[build-msix] Warning: Could not find ${appxPath}. Check directory: ${releaseDir}`);
}

