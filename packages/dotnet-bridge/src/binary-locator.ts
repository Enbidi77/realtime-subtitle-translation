import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('DotnetBinaryLocator');

export class DotnetBinaryLocator {
  private static cachedPath: string | null = null;

  public static isSupportedPlatform(): boolean {
    return process.platform === 'win32';
  }

  public static getBinaryPath(): string | null {
    if (!this.isSupportedPlatform()) {
      return null;
    }

    if (this.cachedPath && fs.existsSync(this.cachedPath)) {
      return this.cachedPath;
    }

    const candidatePaths: string[] = [];

    // 1. Explicit environment variable override
    if (process.env.ECHOLINGO_DOTNET_BIN) {
      candidatePaths.push(process.env.ECHOLINGO_DOTNET_BIN);
    }

    // 2. Electron packaged runtime (process.resourcesPath)
    if ((process as unknown as { resourcesPath?: string }).resourcesPath) {
      const resourcesPath = (process as unknown as { resourcesPath: string }).resourcesPath;
      candidatePaths.push(path.join(resourcesPath, 'bin', 'EchoLingo.Ipc.exe'));
      candidatePaths.push(path.join(resourcesPath, 'resources', 'bin', 'EchoLingo.Ipc.exe'));
    }

    // 3. Monorepo development paths (relative to this module or current working dir)
    const baseDirs = [
      __dirname,
      process.cwd(),
      path.resolve(__dirname, '../../..'),
      path.resolve(__dirname, '../..'),
    ];

    for (const base of baseDirs) {
      candidatePaths.push(path.join(base, 'packages/dotnet-bridge/bin/EchoLingo.Ipc.exe'));
      candidatePaths.push(path.join(base, 'apps/desktop/resources/bin/EchoLingo.Ipc.exe'));
      candidatePaths.push(path.join(base, 'ipc/bin/publish/EchoLingo.Ipc.exe'));
      candidatePaths.push(path.join(base, 'ipc/bin/Release/net8.0-windows10.0.19041.0/win-x64/EchoLingo.Ipc.exe'));
      candidatePaths.push(path.join(base, 'ipc/bin/Debug/net8.0-windows10.0.19041.0/win-x64/EchoLingo.Ipc.exe'));
    }

    for (const candidate of candidatePaths) {
      try {
        if (candidate && fs.existsSync(candidate)) {
          this.cachedPath = path.resolve(candidate);
          log.info('Found .NET IPC binary at:', this.cachedPath);
          return this.cachedPath;
        }
      } catch {
        // Ignore file access errors
      }
    }

    log.warn('.NET IPC binary not found among candidate paths');
    return null;
  }

  public static isAvailable(): boolean {
    return this.getBinaryPath() !== null;
  }

  public static resetCache(): void {
    this.cachedPath = null;
  }
}

