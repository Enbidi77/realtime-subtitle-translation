import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  PowerShellScriptName,
  getPowerShellScriptPath,
} from './scripts.js';

const execFileAsync = promisify(execFile);

export interface PowerShellExecutionOptions {
  timeout?: number;
  maxBuffer?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface PowerShellExecutionResult {
  stdout: string;
  stderr: string;
}

/**
 * Returns the platform-appropriate PowerShell executable name.
 */
export function getPowerShellExecutable(): string {
  return process.platform === 'win32' ? 'powershell.exe' : 'powershell';
}

/**
 * Executes a PowerShell script file from disk.
 */
export async function executePowerShellFile(
  scriptPath: string,
  args: string[] = [],
  options: PowerShellExecutionOptions = {}
): Promise<PowerShellExecutionResult> {
  const binary = getPowerShellExecutable();
  const execArgs = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    ...args,
  ];

  const { stdout, stderr } = await execFileAsync(binary, execArgs, {
    timeout: options.timeout ?? 30000,
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    cwd: options.cwd,
    env: options.env,
  });

  return {
    stdout: (stdout || '').trim(),
    stderr: (stderr || '').trim(),
  };
}

/**
 * Executes a named PowerShell script by resolving its path.
 */
export async function executePowerShellScript(
  name: PowerShellScriptName,
  args: string[] = [],
  options: PowerShellExecutionOptions = {}
): Promise<PowerShellExecutionResult> {
  const scriptPath = getPowerShellScriptPath(name);
  return executePowerShellFile(scriptPath, args, options);
}

/**
 * Executes an inline PowerShell command via Base64 UTF-16LE EncodedCommand.
 */
export async function executePowerShellCommand(
  command: string,
  options: PowerShellExecutionOptions = {}
): Promise<PowerShellExecutionResult> {
  const binary = getPowerShellExecutable();
  const encoded = Buffer.from(command, 'utf16le').toString('base64');
  const execArgs = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-EncodedCommand',
    encoded,
  ];

  const { stdout, stderr } = await execFileAsync(binary, execArgs, {
    timeout: options.timeout ?? 30000,
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    cwd: options.cwd,
    env: options.env,
  });

  return {
    stdout: (stdout || '').trim(),
    stderr: (stderr || '').trim(),
  };
}

/**
 * Helper to run OCR recognition via PowerShell.
 */
export async function runOcrRecognizeScript(
  imagePath: string,
  languageTag: string = 'auto',
  options?: PowerShellExecutionOptions
): Promise<PowerShellExecutionResult> {
  return executePowerShellScript(
    'ocr-recognize',
    ['-ImagePath', imagePath, '-LanguageTag', languageTag],
    options
  );
}

/**
 * Helper to enumerate installed OCR languages via PowerShell.
 */
export async function runOcrLanguagesScript(
  options?: PowerShellExecutionOptions
): Promise<PowerShellExecutionResult> {
  return executePowerShellScript('ocr-languages', [], options);
}

/**
 * Helper to run SAPI speech recognition via PowerShell.
 */
export async function runSpeechRecognizeScript(
  wavPath: string,
  targetLang: string = '',
  options?: PowerShellExecutionOptions
): Promise<PowerShellExecutionResult> {
  return executePowerShellScript(
    'speech-recognize',
    ['-WavPath', wavPath, '-TargetLang', targetLang],
    options
  );
}

/**
 * Helper to enumerate installed SAPI speech recognizers via PowerShell.
 */
export async function runSpeechRecognizersScript(
  options?: PowerShellExecutionOptions
): Promise<PowerShellExecutionResult> {
  return executePowerShellScript('speech-recognizers', [], options);
}

/**
 * Helper to extract an archive using PowerShell Expand-Archive.
 */
export async function runExpandArchiveScript(
  path: string,
  destinationPath: string,
  options?: PowerShellExecutionOptions
): Promise<PowerShellExecutionResult> {
  return executePowerShellScript(
    'expand-archive',
    ['-Path', path, '-DestinationPath', destinationPath],
    options
  );
}

