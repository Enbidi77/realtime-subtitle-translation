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

export interface PingResult {
  message: string;
  version: string;
  timestamp: number;
  platform: string;
}

