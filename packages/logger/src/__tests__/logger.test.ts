import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  createLogger,
  initLogger,
  logger,
  getLogDirectory,
  createConsoleFormat,
  fileFormat,
  stripAnsi,
  ANSI,
  ANSI_REGEX,
  shouldColorize,
} from '../index.js';

describe('Logger Module', () => {
  let tempLogDir: string;

  beforeEach(() => {
    tempLogDir = path.join(os.tmpdir(), `echolingo-test-logs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    initLogger({
      logDir: tempLogDir,
      level: 'debug',
      silent: false,
    });
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempLogDir)) {
        fs.rmSync(tempLogDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it('creates scoped loggers and formats messages', () => {
    const testLogger = createLogger('TestScope');
    expect(testLogger).toBeDefined();
    expect(typeof testLogger.info).toBe('function');
    expect(typeof testLogger.warn).toBe('function');
    expect(typeof testLogger.error).toBe('function');
    expect(typeof testLogger.debug).toBe('function');

    testLogger.info('Testing info message', { foo: 'bar' });
    testLogger.warn('Testing warning message');
    testLogger.error('Testing error message', new Error('Something broke'));
  });

  it('creates child scopes', () => {
    const parent = createLogger('Parent');
    const child = parent.child('Child');
    expect(child).toBeDefined();
    child.info('Message from child');
  });

  it('updates log directory through initLogger', () => {
    expect(getLogDirectory()).toBe(tempLogDir);
  });

  it('writes logs to log file without ANSI escapes', async () => {
    const fileLogger = createLogger('FileScope');
    fileLogger.info('Persistent test log 123 with \x1b[32mcolor\x1b[0m');
    fileLogger.error('Persistent test error 456', new Error('File failure'));

    // Allow winston stream write to flush
    await new Promise((resolve) => setTimeout(resolve, 100));

    const appLogPath = path.join(tempLogDir, 'app.log');
    const errorLogPath = path.join(tempLogDir, 'error.log');

    expect(fs.existsSync(appLogPath)).toBe(true);
    expect(fs.existsSync(errorLogPath)).toBe(true);

    const appContent = fs.readFileSync(appLogPath, 'utf-8');
    const errorContent = fs.readFileSync(errorLogPath, 'utf-8');

    expect(appContent).toContain('[FileScope]');
    expect(appContent).toContain('Persistent test log 123 with color');
    // Ensure no ANSI escape sequences exist in the file logs
    expect(appContent).not.toMatch(ANSI_REGEX);
    expect(errorContent).not.toMatch(ANSI_REGEX);

    expect(errorContent).toContain('Persistent test error 456');
    expect(errorContent).toContain('File failure');
  });

  describe('Console Colorization', () => {
    const messageSym = Symbol.for('message');

    it('colorizes console messages with ANSI sequences when colorize is true', () => {
      const format = createConsoleFormat(true);

      const infoResult = format.transform(
        { timestamp: '2026-10-14 12:00:00.000', level: 'info', message: 'Ready', label: 'Main' },
        {}
      );
      const infoStr = String((infoResult as Record<symbol, unknown>)[messageSym]);
      expect(infoStr).toContain(ANSI.gray);
      expect(infoStr).toContain(ANSI.brightGreen);
      expect(infoStr).toContain('[INFO]');
      expect(infoStr).toContain(ANSI.cyan);
      expect(infoStr).toContain('[Main]');

      const warnResult = format.transform(
        { timestamp: '2026-10-14 12:00:00.000', level: 'warn', message: 'Warning alert', label: 'VAD' },
        {}
      );
      const warnStr = String((warnResult as Record<symbol, unknown>)[messageSym]);
      expect(warnStr).toContain(ANSI.brightYellow);
      expect(warnStr).toContain('[WARN]');
      expect(warnStr).toContain(ANSI.yellow);
      expect(warnStr).toContain('Warning alert');

      const errorResult = format.transform(
        {
          timestamp: '2026-10-14 12:00:00.000',
          level: 'error',
          message: 'Fatal problem',
          label: 'Capture',
          stack: 'Error: Fatal problem\n    at test.ts:1:1',
        },
        {}
      );
      const errorStr = String((errorResult as Record<symbol, unknown>)[messageSym]);
      expect(errorStr).toContain(ANSI.brightRed);
      expect(errorStr).toContain('[ERROR]');
      expect(errorStr).toContain(ANSI.red);
      expect(errorStr).toContain('Fatal problem');

      const debugResult = format.transform(
        { timestamp: '2026-10-14 12:00:00.000', level: 'debug', message: 'Trace info', label: 'Audio' },
        {}
      );
      const debugStr = String((debugResult as Record<symbol, unknown>)[messageSym]);
      expect(debugStr).toContain(ANSI.brightMagenta);
      expect(debugStr).toContain('[DEBUG]');
    });

    it('formats plain uncolored output when colorize is false', () => {
      const format = createConsoleFormat(false);
      const result = format.transform(
        { timestamp: '2026-10-14 12:00:00.000', level: 'info', message: 'Plain info', label: 'Scope' },
        {}
      );
      const outStr = String((result as Record<symbol, unknown>)[messageSym]);
      expect(outStr).toBe('2026-10-14 12:00:00.000 [INFO] [Scope] Plain info');
      expect(outStr).not.toMatch(ANSI_REGEX);
    });

    it('strips ANSI codes in stripAnsi and fileFormat', () => {
      const colored = `\x1b[31mRed Alert\x1b[0m`;
      expect(stripAnsi(colored)).toBe('Red Alert');

      const format = fileFormat;
      const result = format.transform(
        {
          timestamp: '2026-10-14 12:00:00.000',
          level: 'info',
          message: `Testing ${ANSI.green}green${ANSI.reset}`,
          label: `${ANSI.cyan}Scope${ANSI.reset}`,
        },
        {}
      );
      const outStr = String((result as Record<symbol, unknown>)[messageSym]);
      expect(outStr).toBe('2026-10-14 12:00:00.000 [INFO] [Scope] Testing green');
      expect(outStr).not.toMatch(ANSI_REGEX);
    });

    it('determines colorization based on options and environment in shouldColorize', () => {
      expect(shouldColorize(true)).toBe(true);
      expect(shouldColorize(false)).toBe(false);

      const origNoColor = process.env.NO_COLOR;
      const origTerm = process.env.TERM;

      try {
        process.env.NO_COLOR = '1';
        expect(shouldColorize()).toBe(false);

        delete process.env.NO_COLOR;
        process.env.TERM = 'dumb';
        expect(shouldColorize()).toBe(false);

        process.env.TERM = 'xterm-256color';
        expect(shouldColorize()).toBe(true);
      } finally {
        if (origNoColor !== undefined) {
          process.env.NO_COLOR = origNoColor;
        } else {
          delete process.env.NO_COLOR;
        }
        if (origTerm !== undefined) {
          process.env.TERM = origTerm;
        } else {
          delete process.env.TERM;
        }
      }
    });
  });
});

