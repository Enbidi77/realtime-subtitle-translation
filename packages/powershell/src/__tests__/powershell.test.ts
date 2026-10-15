import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import {
  POWERSHELL_SCRIPT_FILES,
  PowerShellScriptName,
  getPowerShellScriptsDir,
  getPowerShellScriptPath,
  getPowerShellScriptContent,
  runSpeechRecognizersScript,
  runOcrLanguagesScript,
} from '../index.js';

describe('PowerShell Package', () => {
  const scriptNames: PowerShellScriptName[] = [
    'ocr-recognize',
    'ocr-languages',
    'speech-recognize',
    'speech-recognizers',
    'expand-archive',
  ];

  it('defines file mappings for all required scripts', () => {
    for (const name of scriptNames) {
      const filename = POWERSHELL_SCRIPT_FILES[name];
      expect(filename).toBeDefined();
      expect(filename).toMatch(/\.ps1$/);
    }
  });

  it('resolves valid scripts directory on disk', () => {
    const dir = getPowerShellScriptsDir();
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
  });

  it('resolves and reads valid physical script files for all scripts', () => {
    for (const name of scriptNames) {
      const resolvedPath = getPowerShellScriptPath(name);
      expect(resolvedPath).toBeDefined();
      expect(fs.existsSync(resolvedPath)).toBe(true);
      expect(fs.statSync(resolvedPath).isFile()).toBe(true);

      const content = getPowerShellScriptContent(name);
      expect(content.length).toBeGreaterThan(10);
      expect(content).toBe(fs.readFileSync(resolvedPath, 'utf-8'));
    }
  });

  if (process.platform === 'win32') {
    it('executes speech-recognizers script successfully on Windows', async () => {
      const res = await runSpeechRecognizersScript();
      expect(res.stderr).toBe('');
      expect(res.stdout.length).toBeGreaterThan(0);
      const parsed = JSON.parse(res.stdout);
      expect(Array.isArray(parsed)).toBe(true);
    }, 15000);

    it('executes ocr-languages script successfully on Windows', async () => {
      const res = await runOcrLanguagesScript();
      expect(res.stdout.length).toBeGreaterThan(0);
      const parsed = JSON.parse(res.stdout);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toHaveProperty('code');
    }, 15000);
  }
});
