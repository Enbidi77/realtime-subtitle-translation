import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import { createLogger } from "@echo-lingo/logger";
import { IpcRequest, IpcResponse } from "./types";

const log = createLogger("DotnetPipeClient");

/**
 * Resolves the platform-specific address for a named pipe / domain socket.
 * - Windows: \\.\pipe\<pipeName>
 * - macOS/Linux: <tmpdir>/CoreFxPipe_<pipeName> (.NET System.IO.Pipes default)
 */
export function resolvePipePath(pipeName: string): string {
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\${pipeName}`;
  }
  return path.join(os.tmpdir(), `CoreFxPipe_${pipeName}`);
}

export interface DotnetPipeClientOptions {
  pipeName: string;
  defaultTimeoutMs?: number;
}

export class DotnetPipeClient {
  private pipeName: string;
  private pipePath: string;
  private defaultTimeoutMs: number;
  private socket: net.Socket | null = null;
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
  private connectPromise: Promise<net.Socket> | null = null;
  private isDisposed = false;

  constructor(options: DotnetPipeClientOptions) {
    this.pipeName = options.pipeName;
    this.pipePath = resolvePipePath(options.pipeName);
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15000;
  }

  public getPipeName(): string {
    return this.pipeName;
  }

  public getPipePath(): string {
    return this.pipePath;
  }

  public isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  public async connect(maxWaitMs = 5000): Promise<net.Socket> {
    if (this.isDisposed) {
      throw new Error("DotnetPipeClient is disposed");
    }

    if (this.socket && !this.socket.destroyed) {
      return this.socket;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.connectWithRetry(maxWaitMs).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private async connectWithRetry(maxWaitMs: number): Promise<net.Socket> {
    const startTime = Date.now();
    const retryIntervalMs = 50;
    let lastError: Error | null = null;

    log.debug(`Connecting to .NET Named Pipe at: ${this.pipePath}`);

    while (Date.now() - startTime < maxWaitMs) {
      if (this.isDisposed) {
        throw new Error("DotnetPipeClient was disposed during connection");
      }

      try {
        const remaining = maxWaitMs - (Date.now() - startTime);
        const socket = await this.tryConnectOnce(Math.min(remaining, 1000));
        log.info(`Connected to .NET Named Pipe at: ${this.pipePath}`);
        return socket;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await new Promise((r) => setTimeout(r, retryIntervalMs));
      }
    }

    throw new Error(
      `Failed to connect to .NET Named Pipe '${this.pipePath}' within ${maxWaitMs}ms. Last error: ${lastError?.message || "Unknown error"}`,
    );
  }

  private tryConnectOnce(timeoutMs: number): Promise<net.Socket> {
    return new Promise<net.Socket>((resolve, reject) => {
      let settled = false;
      const socket = net.createConnection(this.pipePath);

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(new Error(`Connection attempt to ${this.pipePath} timed out`));
        }
      }, timeoutMs);

      socket.once("connect", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.setupSocket(socket);
          resolve(socket);
        }
      });

      socket.once("error", (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          socket.destroy();
          reject(err);
        }
      });
    });
  }

  private setupSocket(socket: net.Socket): void {
    this.socket = socket;

    this.rl = readline.createInterface({
      input: socket,
      crlfDelay: Infinity,
    });

    this.rl.on("line", (line: string) => {
      this.handleLine(line);
    });

    socket.on("error", (err) => {
      log.warn(`Named Pipe socket error: ${err.message}`);
      this.handleClose();
    });

    socket.on("close", () => {
      log.debug("Named Pipe socket closed.");
      this.handleClose();
    });

    socket.on("end", () => {
      log.debug("Named Pipe socket stream ended.");
    });
  }

  private handleLine(line: string): void {
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
          pending.reject(new Error(response.error || "Unknown IPC error"));
        }
      }
    } catch (err) {
      log.warn(
        "Failed to parse JSON response from .NET Named Pipe:",
        trimmed,
        err,
      );
    }
  }

  private handleClose(): void {
    if (this.rl) {
      try {
        this.rl.close();
      } catch {
        // Ignore
      }
      this.rl = null;
    }

    if (this.socket) {
      if (!this.socket.destroyed) {
        try {
          this.socket.destroy();
        } catch {
          // Ignore
        }
      }
      this.socket = null;
    }

    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(
        new Error(
          `.NET Named Pipe disconnected while request ${id} was pending`,
        ),
      );
    }
    this.pendingRequests.clear();
  }

  public async sendRequest<TReq = unknown, TRes = unknown>(
    command: string,
    payload?: TReq,
    timeoutMs?: number,
  ): Promise<TRes> {
    if (this.isDisposed) {
      throw new Error("DotnetPipeClient is disposed");
    }

    const socket = await this.connect();
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
        reject(
          new Error(
            `.NET Named Pipe request '${command}' (id: ${reqId}) timed out after ${timeout}ms`,
          ),
        );
      }, timeout);

      this.pendingRequests.set(reqId, {
        resolve: (val) => resolve(val as TRes),
        reject,
        timer,
      });

      const line = JSON.stringify(request) + "\n";
      log.info(`Sending request to .NET Named Pipe: ${line.trim()}`);
      socket.write(line, "utf8", (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingRequests.delete(reqId);
          reject(
            new Error(`Failed to write to .NET Named Pipe: ${err.message}`),
          );
        }
      });
    });
  }

  public async dispose(): Promise<void> {
    this.isDisposed = true;

    if (this.socket && !this.socket.destroyed) {
      try {
        // Send exit command
        const exitLine = JSON.stringify({ command: "exit" }) + "\n";
        this.socket.write(exitLine, "utf8");
        this.socket.end();
      } catch {
        // Ignore
      }
    }

    this.handleClose();
  }
}
