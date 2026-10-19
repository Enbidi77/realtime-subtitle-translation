import { DotnetProcess } from "./dotnet-process";
import {
  DotnetBridgeTransport,
  DotnetProcessOptions,
  OcrLanguageDto,
  OcrRecognizeRequest,
  OcrRecognizeResult,
  PingResult,
  SapiRecognizerItem,
  SpeechTranscribeRequest,
  SpeechTranscribeResult,
} from "./types";
import { DotnetBinaryLocator } from "./binary-locator";

export type DotnetBridgeOptions = DotnetProcessOptions;

export class DotnetBridge {
  private process: DotnetProcess;

  public readonly speech: {
    getInstalledRecognizers: () => Promise<SapiRecognizerItem[]>;
    transcribe: (
      wavPath: string,
      targetLang?: string,
    ) => Promise<SpeechTranscribeResult>;
  };

  public readonly ocr: {
    getAvailableLanguages: () => Promise<OcrLanguageDto[]>;
    recognize: (
      imagePath: string,
      languageTag?: string,
    ) => Promise<OcrRecognizeResult>;
  };

  constructor(options: DotnetBridgeOptions = {}) {
    this.process = new DotnetProcess(options);

    this.speech = {
      getInstalledRecognizers: async (): Promise<SapiRecognizerItem[]> => {
        return this.process.execute<undefined, SapiRecognizerItem[]>(
          "speech:recognizers",
        );
      },
      transcribe: async (
        wavPath: string,
        targetLang?: string,
      ): Promise<SpeechTranscribeResult> => {
        return this.process.execute<
          SpeechTranscribeRequest,
          SpeechTranscribeResult
        >("speech:transcribe", {
          wavPath,
          targetLang,
        });
      },
    };

    this.ocr = {
      getAvailableLanguages: async (): Promise<OcrLanguageDto[]> => {
        return this.process.execute<undefined, OcrLanguageDto[]>(
          "ocr:languages",
        );
      },
      recognize: async (
        imagePath: string,
        languageTag?: string,
      ): Promise<OcrRecognizeResult> => {
        return this.process.execute<OcrRecognizeRequest, OcrRecognizeResult>(
          "ocr:recognize",
          {
            imagePath,
            languageTag,
          },
        );
      },
    };
  }

  public isAvailable(): boolean {
    return DotnetBinaryLocator.isAvailable();
  }

  public getTransport(): DotnetBridgeTransport {
    return this.process.getTransport();
  }

  public getPipeName(): string {
    return this.process.getPipeName();
  }

  public async ping(): Promise<PingResult> {
    return this.process.execute<undefined, PingResult>("ping");
  }

  public async executeRaw<TReq = unknown, TRes = unknown>(
    command: string,
    payload?: TReq,
    timeoutMs?: number,
  ): Promise<TRes> {
    return this.process.execute<TReq, TRes>(command, payload, timeoutMs);
  }

  public async dispose(): Promise<void> {
    await this.process.dispose();
  }
}

// By default, instantiate DotnetBridge with Named Pipe transport as the default choice
export const dotnetBridge = new DotnetBridge();
