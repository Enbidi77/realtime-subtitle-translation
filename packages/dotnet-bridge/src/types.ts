export type DotnetBridgeTransport = "pipe" | "daemon" | "cli";

export interface DotnetProcessOptions {
  /**
   * IPC Transport mechanism:
   * - 'pipe' (default): High-performance duplex OS Named Pipe (Windows: \\.\pipe\..., macOS/Linux: Unix Domain Socket)
   * - 'daemon': Persistent child process with JSON-lines over stdin/stdout
   * - 'cli': One-shot child process invocation per request
   */
  transport?: DotnetBridgeTransport;

  /**
   * Backward compatibility flag:
   * If false, transport is forced to 'cli'.
   * If true (or omitted), transport defaults to 'pipe'.
   */
  useDaemon?: boolean;

  /**
   * Request timeout in milliseconds (default: 15000ms).
   */
  timeoutMs?: number;

  /**
   * Custom pipe name for named pipe transport (defaults to echolingo-dotnet-pipe-<pid>).
   */
  pipeName?: string;

  /**
   * Whether to automatically spawn the .NET binary daemon if not already running (default: true).
   */
  autoSpawn?: boolean;
}

export interface IpcRequest {
  id?: string;
  command: string;
  payload?: unknown;
}

export interface IpcResponse<T = unknown> {
  id?: string;
  success: boolean;
  result?: T;
  error?: string;
}

export interface SapiRecognizerItem {
  id: string;
  name: string;
  culture: string;
  description: string;
}

export interface SpeechTranscribeRequest {
  wavPath: string;
  targetLang?: string;
}

export interface SpeechTranscribeResult {
  text: string;
  confidence: number;
  culture?: string;
  error?: string;
}

export interface BoundingBoxDto {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrWordDto {
  text: string;
  confidence: number;
  boundingBox: BoundingBoxDto;
}

export interface OcrLineDto {
  text: string;
  confidence: number;
  words: OcrWordDto[];
}

export interface OcrRecognizeRequest {
  imagePath: string;
  languageTag?: string;
}

export interface OcrRecognizeResult {
  text: string;
  lines: OcrLineDto[];
  detectedLanguage?: string;
  error?: string;
}

export interface OcrLanguageDto {
  languageTag: string;
  displayName: string;
}

export interface HandwritingStrokePointDto {
  x: number;
  y: number;
  pressure?: number;
  timestamp?: number;
}

export interface HandwritingStrokeDto {
  points: HandwritingStrokePointDto[];
}

export interface HandwritingRecognizeRequest {
  strokes: HandwritingStrokeDto[];
  languageTag?: string;
}

export interface HandwritingRecognizeResult {
  text: string;
  lines: OcrLineDto[];
  candidates: string[];
  confidence: number;
  error?: string;
}

export interface PingResult {
  message: string;
  version: string;
  timestamp: number;
  platform: string;
}
