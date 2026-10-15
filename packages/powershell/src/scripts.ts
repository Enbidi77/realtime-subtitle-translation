import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function ensurePhysicalScript(scriptPath: string, filename: string): string {
  // If the path is inside an Electron asar archive, powershell.exe cannot access it directly.
  // Extract to temp directory on physical disk.
  if (scriptPath.includes('.asar')) {
    const cacheDir = path.join(os.tmpdir(), 'echolingo-powershell');
    const cachedPath = path.join(cacheDir, filename);
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cachedPath, fs.readFileSync(scriptPath));
      return cachedPath;
    } catch {
      return cachedPath;
    }
  }
  return scriptPath;
}

export type PowerShellScriptName =
  | 'ocr-recognize'
  | 'ocr-languages'
  | 'speech-recognize'
  | 'speech-recognizers'
  | 'expand-archive';

export const POWERSHELL_SCRIPT_FILES: Record<PowerShellScriptName, string> = {
  'ocr-recognize': 'ocr-recognize.ps1',
  'ocr-languages': 'ocr-languages.ps1',
  'speech-recognize': 'speech-recognize.ps1',
  'speech-recognizers': 'speech-recognizers.ps1',
  'expand-archive': 'expand-archive.ps1',
};

/**
 * Resolves the directory containing the PowerShell .ps1 script files.
 */
export function getPowerShellScriptsDir(): string {
  const electronResources =
    typeof process !== 'undefined' && (process as any).resourcesPath
      ? [
          path.resolve((process as any).resourcesPath, 'scripts'),
          path.resolve((process as any).resourcesPath, 'packages/powershell/scripts'),
        ]
      : [];

  const candidateDirs = [
    path.resolve(__dirname, '../scripts'),
    path.resolve(__dirname, 'scripts'),
    path.resolve(__dirname, '../../packages/powershell/scripts'),
    path.resolve(__dirname, '../../../packages/powershell/scripts'),
    path.resolve(process.cwd(), 'packages/powershell/scripts'),
    path.resolve(process.cwd(), '../packages/powershell/scripts'),
    ...electronResources,
  ];

  for (const candidate of candidateDirs) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Continue checking next candidate
    }
  }

  return path.resolve(__dirname, '../scripts');
}

/**
 * Resolves the absolute path to a specific .ps1 script file on disk.
 */
export function getPowerShellScriptPath(name: PowerShellScriptName): string {
  const filename = POWERSHELL_SCRIPT_FILES[name];
  if (!filename) {
    throw new Error(`Unknown PowerShell script name: ${name}`);
  }

  const scriptsDir = getPowerShellScriptsDir();
  const directPath = path.join(scriptsDir, filename);

  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return ensurePhysicalScript(directPath, filename);
  }

  const candidateDirs = [
    path.resolve(__dirname, '../scripts'),
    path.resolve(__dirname, 'scripts'),
    path.resolve(__dirname, '../../packages/powershell/scripts'),
    path.resolve(__dirname, '../../../packages/powershell/scripts'),
    path.resolve(process.cwd(), 'packages/powershell/scripts'),
    path.resolve(process.cwd(), '../packages/powershell/scripts'),
  ];

  for (const dir of candidateDirs) {
    try {
      const candidatePath = path.join(dir, filename);
      if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
        return ensurePhysicalScript(candidatePath, filename);
      }
    } catch {
      // Continue checking next candidate
    }
  }

  throw new Error(`Could not find PowerShell script "${filename}" on disk.`);
}

/**
 * Reads and returns the raw string content of a PowerShell script file from disk.
 */
export function getPowerShellScriptContent(name: PowerShellScriptName): string {
  const scriptPath = getPowerShellScriptPath(name);
  return fs.readFileSync(scriptPath, 'utf-8');
}
