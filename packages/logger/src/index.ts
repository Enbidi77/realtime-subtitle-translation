import fs from 'fs';
import path from 'path';
import os from 'os';
import winston from 'winston';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  logDir?: string;
  level?: LogLevel;
  silent?: boolean;
  maxFiles?: number;
  maxSize?: number;
}

export interface ILogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  child(scope: string): ILogger;
}

function getDefaultLogDirectory(): string {
  try {
    if (process.platform === 'win32') {
      const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(base, 'echolingo', 'logs');
    } else if (process.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Logs', 'EchoLingo');
    } else {
      const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
      return path.join(base, 'echolingo', 'logs');
    }
  } catch {
    return path.join(process.cwd(), 'logs');
  }
}

let currentLogDir = getDefaultLogDirectory();
const isTestEnv = process.env.NODE_ENV === 'test';

function formatArgs(args: unknown[]): { message: string; stack?: string } {
  if (args.length === 0) {
    return { message: '' };
  }

  let stack: string | undefined;
  const parts: string[] = [];

  for (const arg of args) {
    if (arg instanceof Error) {
      parts.push(arg.message || String(arg));
      if (arg.stack) {
        stack = stack ? `${stack}\n${arg.stack}` : arg.stack;
      }
    } else if (typeof arg === 'string') {
      parts.push(arg);
    } else if (typeof arg === 'object' && arg !== null) {
      try {
        parts.push(JSON.stringify(arg));
      } catch {
        parts.push(String(arg));
      }
    } else {
      parts.push(String(arg));
    }
  }

  return {
    message: parts.join(' '),
    stack,
  };
}

const consoleFormat = winston.format.printf(({ timestamp, level, message, label, stack }) => {
  const scopeTag = label ? `[${label}] ` : '';
  const stackInfo = stack ? `\n${stack}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${scopeTag}${message}${stackInfo}`;
});

const fileFormat = winston.format.printf(({ timestamp, level, message, label, stack }) => {
  const scopeTag = label ? `[${label}] ` : '';
  const stackInfo = stack ? `\n${stack}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${scopeTag}${message}${stackInfo}`;
});

function createWinstonInstance(options: LoggerOptions = {}): winston.Logger {
  const logDir = options.logDir || currentLogDir;
  currentLogDir = logDir;

  const transports: winston.transport[] = [];

  // Console transport
  transports.push(
    new winston.transports.Console({
      level: options.level || (isTestEnv ? 'error' : 'debug'),
      silent: options.silent ?? (isTestEnv && !process.env.DEBUG),
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.colorize(),
        consoleFormat
      ),
    })
  );

  // File transports (enabled unless silent or explicitly in test without file log request)
  if (!isTestEnv || options.logDir) {
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const maxSize = options.maxSize || 5 * 1024 * 1024; // 5 MB
      const maxFiles = options.maxFiles || 5;

      // Combined app log (info, warn, error, debug)
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'app.log'),
          level: options.level || 'debug',
          maxsize: maxSize,
          maxFiles,
          tailable: true,
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            fileFormat
          ),
        })
      );

      // Dedicated error log
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: maxSize,
          maxFiles,
          tailable: true,
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            fileFormat
          ),
        })
      );
    } catch (err) {
      // Safe fallback if directory creation or file logging is restricted
      // Fallback does not crash the host application
    }
  }

  return winston.createLogger({
    level: options.level || 'debug',
    transports,
  });
}

let internalLogger: winston.Logger = createWinstonInstance();

export function initLogger(options: LoggerOptions = {}): void {
  if (options.logDir) {
    currentLogDir = options.logDir;
  }
  internalLogger = createWinstonInstance(options);
}

export function getLogDirectory(): string {
  return currentLogDir;
}

class ScopedLogger implements ILogger {
  constructor(private readonly scope: string) {}

  public debug(...args: unknown[]): void {
    const { message, stack } = formatArgs(args);
    internalLogger.debug(message, { label: this.scope, stack });
  }

  public info(...args: unknown[]): void {
    const { message, stack } = formatArgs(args);
    internalLogger.info(message, { label: this.scope, stack });
  }

  public warn(...args: unknown[]): void {
    const { message, stack } = formatArgs(args);
    internalLogger.warn(message, { label: this.scope, stack });
  }

  public error(...args: unknown[]): void {
    const { message, stack } = formatArgs(args);
    internalLogger.error(message, { label: this.scope, stack });
  }

  public child(subScope: string): ILogger {
    return new ScopedLogger(`${this.scope}:${subScope}`);
  }
}

export function createLogger(scope: string): ILogger {
  return new ScopedLogger(scope);
}

export const logger: ILogger = new ScopedLogger('EchoLingo');

