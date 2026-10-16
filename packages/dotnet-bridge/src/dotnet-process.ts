import { ChildProcess, execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import * as readline from 'node:readline';
import { createLogger } from '@echo-lingo/logger';
import { DotnetBinaryLocator } from './binary-locator';
import { IpcRequest, IpcResponse } from './types';

const execFileAsync = promisify(execFile);
const log = createLogger('DotnetProcess');

export interface DotnetProcessOptions {
  useDaemon?: boolean;
  timeoutMs?: number;
}

export class DotnetProcess {
  private child: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private requestCounter = 0;
  private isStartingDaemon = false;
  private useDaemon: boolean;
  private defaultTimeoutMs: number;

  constructor(options: DotnetProcessOptions = {}) {
    this.useDaemon = options.useDaemon ?? true;
    this.defaultTimeoutMs = options.timeoutMs ?? 15000;
  }

  public isAvailable(): boolean {
    return DotnetBinaryLocator.isAvailable();
  }

  public async execute<TReq = unknown, TRes = unknown>(
    command: string,
    payload?: TReq,
    timeoutMs?: number
  ): Promise<TRes> {
    const binaryPath = DotnetBinaryLocator.getBinaryPath();
    if (!binaryPath) {
      throw new Error('.NET IPC binary EchoLingo.Ipc.exe is not available on this platform.');
    }

    if (this.useDaemon) {
      try {
        return await this.executeViaDaemon<TReq, TRes>(binaryPath, command, payload, timeoutMs);
      } catch (err) {
        log.warn(`Daemon execution failed for '${command}', falling back to CLI execution:`, err);
        // Fall back to one-shot CLI execution
        return await this.executeViaCli<TReq, TRes>(binaryPath, command, payload);
      }
    }

    return await this.executeViaCli<TReq, TRes>(binaryPath, command, payload);
  }

  private async executeViaDaemon<TReq, TRes>(
    binaryPath: string,
    command: string,
    payload?: TReq,
    timeoutMs?: number
  ): Promise<TRes> {
    await this.ensureDaemonStarted(binaryPath);

    if (!this.child || !this.child.stdin || this.child.killed) {
      throw new Error('.NET IPC daemon process is not running');
    }

    const reqId = `${Date.now()}-${++this.requestCounter}`;
    const request: IpcRequest = {
      id: reqId,
      command,
      payload,
    };

    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<TRes>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error(`.NET IPC request '${command}' (id: ${reqId}) timed out after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(reqId, {
        resolve: (val) => resolve(val as TRes),
        reject,
        timer,
      });

      const line = JSON.stringify(request) + '\n';
      this.child!.stdin!.write(line, 'utf8', (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingRequests.delete(reqId);
          reject(new Error(`Failed to write to .NET IPC stdin: ${err.message}`));
        }
      });
    });
  }

  private async executeViaCli<TReq, TRes>(
    binaryPath: string,
    command: string,
    payload?: TReq
  ): Promise<TRes> {
    const args = this.mapCommandToCliArgs(command, payload);

    try {
      const { stdout } = await execFileAsync(binaryPath, args, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      });

      const trimmed = stdout.trim();
      if (!trimmed) {
        return {} as TRes;
      }

      const parsed = JSON.parse(trimmed);
      return parsed as TRes;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`CLI execution of '${command}' failed: ${msg}`);
    }
  }

  private mapCommandToCliArgs(command: string, payload: unknown): string[] {
    switch (command) {
      case 'ping':
        return ['ping'];
      case 'speech:recognizers':
        return ['speech', 'recognizers'];
      case 'speech:transcribe': {
        const p = payload as { wavPath?: string; targetLang?: string };
        return ['speech', 'transcribe', p?.wavPath || '', p?.targetLang || ''];
      }
      case 'ocr:languages':
        return ['ocr', 'languages'];
      case 'ocr:recognize': {
        const p = payload as { imagePath?: string; languageTag?: string };
        return ['ocr', 'recognize', p?.imagePath || '', p?.languageTag || ''];
      }
      default:
        throw new Error(`Command '${command}' has no direct CLI mapping`);
    }
  }

  private async ensureDaemonStarted(binaryPath: string): Promise<void> {
    if (this.child && !this.child.killed) {
      return;
    }

    if (this.isStartingDaemon) {
      while (this.isStartingDaemon) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return;
    }

    this.isStartingDaemon = true;
    try {
      log.info('Starting .NET IPC daemon:', binaryPath);
      const child = spawn(binaryPath, ['--daemon'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      this.child = child;

      if (!child.stdout || !child.stdin) {
        throw new Error('Failed to open stdio streams for .NET IPC daemon');
      }

      this.rl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Infinity,
      });

      this.rl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const response = JSON.parse(trimmed) as IpcResponse;
          if (response.id && this.pendingRequests.has(response.id)) {
            const pending = this.pendingRequests.get(response.id)!;
            this.pendingRequests.delete(response.id);
            clearTimeout(pending.timer);

            if (response.success) {
              pending.resolve(response.result);
            } else {
              pending.reject(new Error(response.error || 'Unknown IPC error'));
            }
          }
        } catch (err) {
          log.warn('Failed to parse line from .NET IPC stdout:', trimmed, err);
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8').trim();
        if (text) {
          log.debug(`[.NET IPC stderr] ${text}`);
        }
      });

      child.on('exit', (code, signal) => {
        log.warn(`.NET IPC daemon exited with code ${code}, signal ${signal}`);
        this.cleanup();
      });

      child.on('error', (err) => {
        log.error('.NET IPC daemon process error:', err);
        this.cleanup();
      });
    } finally {
      this.isStartingDaemon = false;
    }
  }

  private cleanup(): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`.NET IPC daemon terminated while request ${id} was pending`));
    }
    this.pendingRequests.clear();

    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    if (this.child) {
      if (!this.child.killed) {
        try {
          this.child.kill();
        } catch {
          // Ignore
        }
      }
      this.child = null;
    }
  }

  public async dispose(): Promise<void> {
    if (this.child && !this.child.killed && this.child.stdin) {
      try {
        this.child.stdin.write('exit\n');
      } catch {
        // Ignore
      }
    }
    this.cleanup();
  }
}

