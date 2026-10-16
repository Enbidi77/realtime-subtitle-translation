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

    // 3. Relative to process.cwd() (handles when cwd is apps/desktop or repo root)
    const cwd = process.cwd();
    candidatePaths.push(path.join(cwd, 'resources', 'bin', 'EchoLingo.Ipc.exe'));
    candidatePaths.push(path.join(cwd, 'apps', 'desktop', 'resources', 'bin', 'EchoLingo.Ipc.exe'));
    candidatePaths.push(path.join(cwd, 'packages', 'dotnet-bridge', 'bin', 'EchoLingo.Ipc.exe'));
    candidatePaths.push(path.join(cwd, 'bin', 'EchoLingo.Ipc.exe'));

    // 4. Relative to __dirname (handles bundled out/main or src)
    candidatePaths.push(path.resolve(__dirname, 'EchoLingo.Ipc.exe'));
    candidatePaths.push(path.resolve(__dirname, '..', 'bin', 'EchoLingo.Ipc.exe'));
    candidatePaths.push(path.resolve(__dirname, '..', '..', 'resources', 'bin', 'EchoLingo.Ipc.exe'));
    candidatePaths.push(path.resolve(__dirname, '..', '..', '..', 'resources', 'bin', 'EchoLingo.Ipc.exe'));

    // 5. Walk up to locate the repository root via marker files (pnpm-workspace.yaml or .git)
    const repoRoots = [
      this.findWorkspaceRoot(__dirname),
      this.findWorkspaceRoot(cwd),
    ].filter((r): r is string => Boolean(r));

    for (const root of repoRoots) {
      candidatePaths.push(path.join(root, 'apps', 'desktop', 'resources', 'bin', 'EchoLingo.Ipc.exe'));
      candidatePaths.push(path.join(root, 'packages', 'dotnet-bridge', 'bin', 'EchoLingo.Ipc.exe'));
      candidatePaths.push(path.join(root, 'ipc', 'bin', 'publish', 'EchoLingo.Ipc.exe'));
      candidatePaths.push(path.join(root, 'ipc', 'bin', 'Release', 'net8.0-windows10.0.19041.0', 'win-x64', 'EchoLingo.Ipc.exe'));
      candidatePaths.push(path.join(root, 'ipc', 'bin', 'Debug', 'net8.0-windows10.0.19041.0', 'win-x64', 'EchoLingo.Ipc.exe'));
    }

    // 6. Check candidates
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

    log.warn('.NET IPC binary not found among candidate paths:', candidatePaths);
    return null;
  }

  public static isAvailable(): boolean {
    return this.getBinaryPath() !== null;
  }

  public static resetCache(): void {
    this.cachedPath = null;
  }

  private static findWorkspaceRoot(startDir: string): string | null {
    let curr = path.resolve(startDir);
    for (let i = 0; i < 6; i++) {
      if (
        fs.existsSync(path.join(curr, 'pnpm-workspace.yaml')) ||
        fs.existsSync(path.join(curr, '.git'))
      ) {
        return curr;
      }
      const parent = path.dirname(curr);
      if (parent === curr) break;
      curr = parent;
    }
    return null;
  }
}
