import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createLogger, initLogger, logger, getLogDirectory } from '../index.js';

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

  it('writes logs to log file', async () => {
    const fileLogger = createLogger('FileScope');
    fileLogger.info('Persistent test log 123');
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
    expect(appContent).toContain('Persistent test log 123');
    expect(errorContent).toContain('Persistent test error 456');
    expect(errorContent).toContain('File failure');
  });
});

