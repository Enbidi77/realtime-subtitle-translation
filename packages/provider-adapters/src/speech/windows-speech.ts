import {
  ISpeechProvider,
  TranscriptionOptions,
  TranscriptionResponse,
  encodeWav,
} from '@echo-lingo/speech-core';
import { SpeechEngineType, SpeechModelStatus } from '@echo-lingo/contracts';
import { dotnetBridge, SapiRecognizerItem as DotnetRecognizerItem } from '@echo-lingo/dotnet-bridge';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('WindowsSpeechProvider');

const execFileAsync = promisify(execFile);

export interface WindowsSpeechConfig {
  preferredCulture?: string;
  usePowerShellOnly?: boolean;
}

interface SapiRecognitionResult {
  text?: string;
  confidence?: number;
  culture?: string;
  error?: string;
}

export class WindowsSpeechProvider implements ISpeechProvider {
  public readonly id: SpeechEngineType = 'windows-speech';
  public readonly name = 'Windows System Speech (SAPI / Offline)';
  public readonly isLocal = true;

  private preferredCulture?: string;
  private usePowerShellOnly = false;

  constructor(config: WindowsSpeechConfig = {}) {
    if (config.preferredCulture) this.preferredCulture = config.preferredCulture;
    if (config.usePowerShellOnly !== undefined) this.usePowerShellOnly = config.usePowerShellOnly;
  }

  public async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config?.preferredCulture && typeof config.preferredCulture === 'string') {
      this.preferredCulture = config.preferredCulture;
    }
    if (config?.usePowerShellOnly !== undefined) {
      this.usePowerShellOnly = Boolean(config.usePowerShellOnly);
    }
  }

  public isReady(): boolean {
    return process.platform === 'win32';
  }

  public async transcribe(
    audioSamples: Float32Array,
    options: TranscriptionOptions
  ): Promise<TranscriptionResponse> {
    const start = Date.now();

    // Check audio energy / RMS
    let sum = 0;
    for (let i = 0; i < audioSamples.length; i++) sum += audioSamples[i] * audioSamples[i];
    const rms = Math.sqrt(sum / audioSamples.length);

    if (rms < 0.005) {
      return {
        text: '',
        isFinal: true,
        confidence: 0,
        durationMs: Date.now() - start,
      };
    }

    if (process.platform !== 'win32') {
      return {
        text: '',
        isFinal: true,
        confidence: 0,
        durationMs: Date.now() - start,
      };
    }

    // Encode audio to 16kHz mono WAV format expected by SAPI
    const wavBytes = encodeWav(audioSamples, options.sampleRate || 16000);
    const tempWav = path.join(
      os.tmpdir(),
      `echolingo_sapi_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`
    );

    try {
      await fsp.writeFile(tempWav, Buffer.from(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength));

      const targetLang = options.language || this.preferredCulture || '';
      const result = await this.runRecognition(tempWav, targetLang);

      return {
        text: result.text || '',
        isFinal: true,
        confidence: result.confidence ?? 0.85,
        detectedLanguage: result.culture,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error('Transcription error:', errMsg);
      return {
        text: '',
        isFinal: true,
        confidence: 0,
        durationMs: Date.now() - start,
      };
    } finally {
      await fsp.unlink(tempWav).catch(() => {});
    }
  }

  public async getModelStatus(): Promise<SpeechModelStatus[]> {
    if (process.platform !== 'win32') {
      return [
        {
          id: 'sapi-unavailable',
          name: 'Windows System Speech (Unavailable on non-Windows)',
          isInstalled: false,
          downloadProgress: 0,
          error: 'Windows Speech Recognition requires Windows 10/11.',
        },
      ];
    }

    try {
      const recognizers = await this.getInstalledRecognizers();
      if (recognizers.length === 0) {
        return [
          {
            id: 'sapi-none',
            name: 'Windows System Speech (No recognizer found)',
            isInstalled: false,
            downloadProgress: 0,
            error: 'No speech recognition engines found in Windows System.Speech.',
          },
        ];
      }

      return recognizers.map((r) => ({
        id: r.culture || r.id,
        name: `Windows SAPI - ${r.description || r.name} (${r.culture})`,
        isInstalled: true,
        downloadProgress: 100,
      }));
    } catch (err) {
      return [
        {
          id: 'sapi-error',
          name: 'Windows System Speech',
          isInstalled: false,
          downloadProgress: 0,
          error: err instanceof Error ? err.message : String(err),
        },
      ];
    }
  }

  private async runRecognition(wavPath: string, targetLang: string): Promise<SapiRecognitionResult> {
    // 1. Fast .NET IPC execution
    if (dotnetBridge.isAvailable() && !this.usePowerShellOnly) {
      try {
        const res = await dotnetBridge.speech.transcribe(wavPath, targetLang);
        return {
          text: res.text,
          confidence: res.confidence,
          culture: res.culture,
          error: res.error,
        };
      } catch (err) {
        log.warn('DotnetBridge speech run failed, falling back to PowerShell:', err);
      }
    }

    // 2. PowerShell fallback
    return this.runPowerShellRecognition(wavPath, targetLang);
  }

  private async runPowerShellRecognition(wavPath: string, targetLang: string): Promise<SapiRecognitionResult> {
    const escapedWav = wavPath.replace(/'/g, "''");
    const escapedLang = (targetLang || '').replace(/'/g, "''");

    const script = `
Add-Type -AssemblyName System.Speech
$wav = '${escapedWav}';
$lang = '${escapedLang}';

$installed = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
if ($installed.Count -eq 0) {
    Write-Output '{"text":"","confidence":0,"error":"No speech recognizers installed"}'
    exit 0
}

$selected = $null
if ($lang -ne '' -and $lang -ne 'auto') {
    foreach ($r in $installed) {
        if ($r.Culture.Name.StartsWith($lang, [System.StringComparison]::OrdinalIgnoreCase) -or
            $r.Culture.TwoLetterISOLanguageName.Equals($lang, [System.StringComparison]::OrdinalIgnoreCase)) {
            $selected = $r
            break
        }
    }
}

if ($null -eq $selected) {
    $selected = $installed[0]
}

try {
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($selected.Id)
    $grammar = New-Object System.Speech.Recognition.DictationGrammar
    $engine.LoadGrammar($grammar)
    $engine.SetInputToWaveFile($wav)

    $texts = @()
    $confidences = @()

    while ($true) {
        $res = $null
        try {
            $res = $engine.Recognize([TimeSpan]::FromSeconds(4))
        } catch [System.InvalidOperationException] {
            break
        }
        if ($null -eq $res) { break }
        if ($res.Text) {
            $texts += $res.Text
            $confidences += $res.Confidence
        }
    }

    $engine.SetInputToNull()
    $engine.Dispose()

    $fullText = ($texts -join ' ').Trim()
    $avgConf = 0.85
    if ($confidences.Count -gt 0) {
        $sum = 0
        foreach ($c in $confidences) { $sum += $c }
        $avgConf = [Math]::Round($sum / $confidences.Count, 2)
    }

    [PSCustomObject]@{
        text = $fullText
        confidence = $avgConf
        culture = $selected.Culture.Name
    } | ConvertTo-Json -Compress
} catch {
    [PSCustomObject]@{
        text = ''
        confidence = 0
        error = $_.Exception.Message
    } | ConvertTo-Json -Compress
}
`;

    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      encoded,
    ]);

    try {
      return JSON.parse(stdout.trim());
    } catch {
      return { text: '', confidence: 0 };
    }
  }

  private async getInstalledRecognizers(): Promise<DotnetRecognizerItem[]> {
    // 1. Fast .NET IPC execution
    if (dotnetBridge.isAvailable() && !this.usePowerShellOnly) {
      try {
        return await dotnetBridge.speech.getInstalledRecognizers();
      } catch (err) {
        log.warn('DotnetBridge getInstalledRecognizers failed, falling back to PowerShell:', err);
      }
    }

    // 2. PowerShell fallback
    const script = `
Add-Type -AssemblyName System.Speech
$list = @()
foreach ($r in [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()) {
    $list += [PSCustomObject]@{
        id = $r.Id
        name = $r.Name
        culture = $r.Culture.Name
        description = $r.Description
    }
}
Write-Output ($list | ConvertTo-Json -Compress)
`;
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      encoded,
    ]);

    try {
      const parsed = JSON.parse(stdout.trim());
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }
}
