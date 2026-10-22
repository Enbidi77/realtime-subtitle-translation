export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  logDir?: string;
  level?: LogLevel;
  silent?: boolean;
  maxFiles?: number;
  maxSize?: number;
  colorize?: boolean;
}

export interface ILogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  child(scope: string): ILogger;
}

export const ANSI = {
  reset: "",
  bold: "",
  dim: "",
  gray: "",
  red: "",
  green: "",
  yellow: "",
  blue: "",
  magenta: "",
  cyan: "",
  brightRed: "",
  brightGreen: "",
  brightYellow: "",
  brightBlue: "",
  brightMagenta: "",
  brightCyan: "",
} as const;

export function stripAnsi(text: string): string {
  return text;
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        return arg.stack || arg.message || String(arg);
      }
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");
}

class BrowserLogger implements ILogger {
  private readonly scope: string;

  constructor(scope: string) {
    this.scope = scope;
  }

  private sendToMain(level: LogLevel, args: unknown[]): void {
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.log) {
        const msg = formatArgs(args);
        (window as any).electronAPI.log[level](msg, this.scope);
      }
    } catch {
      // Ignore if IPC is unavailable
    }
  }

  public debug(...args: unknown[]): void {
    this.sendToMain("debug", args);
    console.debug(
      `%c[${this.scope}]`,
      "color: #c084fc; font-weight: bold;",
      ...args,
    );
  }

  public info(...args: unknown[]): void {
    this.sendToMain("info", args);
    console.info(
      `%c[${this.scope}]`,
      "color: #4ade80; font-weight: bold;",
      ...args,
    );
  }

  public warn(...args: unknown[]): void {
    this.sendToMain("warn", args);
    console.warn(
      `%c[${this.scope}]`,
      "color: #facc15; font-weight: bold;",
      ...args,
    );
  }

  public error(...args: unknown[]): void {
    this.sendToMain("error", args);
    console.error(
      `%c[${this.scope}]`,
      "color: #f87171; font-weight: bold;",
      ...args,
    );
  }

  public child(subScope: string): ILogger {
    return new BrowserLogger(`${this.scope}:${subScope}`);
  }
}

export function createRendererLogger(scope: string): ILogger {
  return new BrowserLogger(scope);
}

export const logger: ILogger = new BrowserLogger("EchoLingo");

export function initLogger(_options: LoggerOptions = {}): void {
  // No-op in browser environment
}

export function getLogDirectory(): string {
  return "";
}
