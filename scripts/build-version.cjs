#!/usr/bin/env node
/**
 * build-version.cjs
 * 
 * Automates version bumping and building the MSI package for Windows Store / Microsoft Partner Center.
 * 
 * Usage:
 *   node scripts/build-version.cjs [version]
 *   e.g. node scripts/build-version.cjs 1.0.1
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const rootPkgPath = path.join(rootDir, 'package.json');
const desktopPkgPath = path.join(rootDir, 'apps', 'desktop', 'package.json');

const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf8'));

let targetVersion = process.argv[2];

if (!targetVersion) {
  targetVersion = rootPkg.version || '1.0.0';
  console.log(`[build-version] No version specified. Using current version: ${targetVersion}`);
} else {
  // Validate semver-like format: X.Y.Z
  const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
  if (!semverRegex.test(targetVersion)) {
    console.error(`[build-version] Error: Invalid semver format "${targetVersion}". Expected format like 1.0.0 or 1.0.1`);
    process.exit(1);
  }
}

console.log(`=======================================================`);
console.log(` Building EchoLingo MSI v${targetVersion} for Microsoft Partner Center`);
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

// 3. Build Desktop Renderer & Main bundles
console.log('\n[Step 2/3] Building Electron Vite app and MSI package...');
try {
  // Run pnpm --filter @echo-lingo/desktop package:msi
  execSync('pnpm --filter @echo-lingo/desktop package:msi', { stdio: 'inherit', cwd: rootDir });
  console.log('✔ MSI packaging completed successfully.');
} catch (err) {
  console.error('✖ Failed packaging MSI:', err.message);
  process.exit(1);
}

// 4. Verify MSI output
const expectedMsiName = `EchoLingo-Setup-${targetVersion}.msi`;
const outputMsiPath = path.join(rootDir, 'apps', 'desktop', 'release', targetVersion, expectedMsiName);

console.log('\n=======================================================');
console.log(' Build Result & Microsoft Partner Center Details');
console.log('=======================================================');

if (fs.existsSync(outputMsiPath)) {
  const stats = fs.statSync(outputMsiPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✔ MSI File Created: ${outputMsiPath}`);
  console.log(`✔ File Size: ${sizeMB} MB`);

  console.log('\n--- MICROSOFT PARTNER CENTER FIELDS ---');
  console.log(`1. Architecture:        x64`);
  console.log(`2. Installer parameters: /qn`);
  console.log(`   (Windows Installer standard silent switch)`);
  console.log(`3. Recommended Package URL (via GitHub Releases):`);
  console.log(`   https://github.com/Enbidi77/realtime-subtitle-translation/releases/download/v${targetVersion}/${expectedMsiName}`);

  console.log('\n--- HOW TO PUBLISH WITH GITHUB CLI (RECOMMENDED) ---');
  console.log(`gh release create v${targetVersion} "${outputMsiPath}" --title "EchoLingo v${targetVersion}" --notes "EchoLingo v${targetVersion} release installer."`);
  console.log('-------------------------------------------------------\n');
} else {
  console.warn(`[build-version] Warning: Expected MSI at ${outputMsiPath} was not found. Please check apps/desktop/release directory.`);
}

