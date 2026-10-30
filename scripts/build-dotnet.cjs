const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function buildDotnet() {
  if (process.platform !== 'win32') {
    console.log('[build-dotnet] Skipping .NET build: non-Windows platform detected.');
    return;
  }

  // Check if dotnet SDK is available
  try {
    execSync('dotnet --version', { stdio: 'pipe' });
  } catch (err) {
    console.warn('[build-dotnet] Warning: dotnet CLI not found. Skipping .NET compilation.');
    return;
  }

  const rootDir = path.resolve(__dirname, '..');
  const csprojPath = path.join(rootDir, 'ipc', 'EchoLingo.Ipc.csproj');
  const targetBridgeDir = path.join(rootDir, 'packages', 'dotnet-bridge', 'bin');
  const targetDesktopDir = path.join(rootDir, 'apps', 'desktop', 'resources', 'bin');

  if (!fs.existsSync(csprojPath)) {
    console.warn(`[build-dotnet] Warning: Project file not found at ${csprojPath}`);
    return;
  }

  console.log('[build-dotnet] Publishing self-contained .NET IPC binary (win-x64)...');
  
  fs.mkdirSync(targetBridgeDir, { recursive: true });
  fs.mkdirSync(targetDesktopDir, { recursive: true });

  const publishCmd = `dotnet publish "${csprojPath}" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o "${targetBridgeDir}"`;
  
  try {
    execSync(publishCmd, { stdio: 'inherit', cwd: rootDir });

    const sourceExe = path.join(targetBridgeDir, 'EchoLingo.Ipc.exe');
    const destExe = path.join(targetDesktopDir, 'EchoLingo.Ipc.exe');

    if (fs.existsSync(sourceExe)) {
      fs.cpSync(targetBridgeDir, targetDesktopDir, { recursive: true, force: true });
      console.log(`[build-dotnet] Successfully built and placed EchoLingo.Ipc.exe:`);
      console.log(`  -> ${sourceExe}`);
      console.log(`  -> ${destExe}`);
    } else {
      console.error('[build-dotnet] Error: EchoLingo.Ipc.exe was not found after publish.');
    }
  } catch (err) {
    console.error('[build-dotnet] Error during dotnet publish:', err.message);
    // Don't fail entire dev process if .NET build fails temporarily
  }
}

buildDotnet();

