import {
  ISpeechProvider,
  TranscriptionOptions,
  TranscriptionResponse,
  encodeWav,
} from '@echo-lingo/speech-core';
import { SpeechEngineType, SpeechModelStatus } from '@echo-lingo/contracts';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

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

interface SapiRecognizerItem {
  id: string;
  name: string;
  culture: string;
  description: string;
}

const SAPI_CS_SOURCE = `using System;
using System.IO;
using System.Speech.Recognition;
using System.Text;

class Program {
    static int Main(string[] args) {
        if (args.Length == 0) {
            Console.WriteLine("{\\"text\\":\\"\\",\\"confidence\\":0,\\"error\\":\\"Missing arguments\\"}");
            return 1;
        }

        if (args[0] == "--list") {
            try {
                var recs = SpeechRecognitionEngine.InstalledRecognizers();
                StringBuilder sbList = new StringBuilder();
                sbList.Append("[");
                for (int i = 0; i < recs.Count; i++) {
                    var r = recs[i];
                    if (i > 0) sbList.Append(",");
                    string idEsc = r.Id.Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\\"");
                    string nameEsc = r.Name.Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\\"");
                    string descEsc = r.Description.Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\\"");
                    sbList.Append(string.Format("{{\\"id\\":\\"{0}\\",\\"name\\":\\"{1}\\",\\"culture\\":\\"{2}\\",\\"description\\":\\"{3}\\"}}", idEsc, nameEsc, r.Culture.Name, descEsc));
                }
                sbList.Append("]");
                Console.WriteLine(sbList.ToString());
                return 0;
            } catch (Exception ex) {
                Console.WriteLine(string.Format("{{\\"error\\":\\"{0}\\"}}", ex.Message.Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\\"")));
                return 1;
            }
        }

        string wavPath = args[0];
        string targetLang = args.Length > 1 ? args[1] : "";

        if (!File.Exists(wavPath)) {
            Console.WriteLine("{\\"text\\":\\"\\",\\"confidence\\":0,\\"error\\":\\"File not found\\"}");
            return 1;
        }

        RecognizerInfo selected = null;
        var installed = SpeechRecognitionEngine.InstalledRecognizers();
        if (installed.Count == 0) {
            Console.WriteLine("{\\"text\\":\\"\\",\\"confidence\\":0,\\"error\\":\\"No speech recognizers installed\\"}");
            return 1;
        }

        if (!string.IsNullOrEmpty(targetLang) && targetLang != "auto") {
            foreach (var rec in installed) {
                if (rec.Culture.Name.StartsWith(targetLang, StringComparison.OrdinalIgnoreCase) ||
                    rec.Culture.TwoLetterISOLanguageName.Equals(targetLang, StringComparison.OrdinalIgnoreCase)) {
                    selected = rec;
                    break;
                }
            }
        }

        if (selected == null) {
            selected = installed[0];
        }

        try {
            using (var engine = new SpeechRecognitionEngine(selected.Id)) {
                engine.LoadGrammar(new DictationGrammar());
                engine.SetInputToWaveFile(wavPath);

                StringBuilder sb = new StringBuilder();
                double totalConfidence = 0;
                int count = 0;

                while (true) {
                    RecognitionResult result = null;
                    try {
                        result = engine.Recognize(TimeSpan.FromSeconds(4));
                    } catch (InvalidOperationException) {
                        // End of stream / audio reached
                        break;
                    }
                    if (result == null) break;
                    if (!string.IsNullOrWhiteSpace(result.Text)) {
                        if (sb.Length > 0) sb.Append(" ");
                        sb.Append(result.Text);
                        totalConfidence += result.Confidence;
                        count++;
                    }
                }

                engine.SetInputToNull();

                double avgConf = count > 0 ? Math.Round(totalConfidence / count, 2) : 0.85;
                string escapedText = sb.ToString().Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\\"").Replace("\\r", "").Replace("\\n", " ");
                Console.WriteLine(string.Format("{{\\"text\\":\\"{0}\\",\\"confidence\\":{1},\\"culture\\":\\"{2}\\"}}", escapedText, avgConf, selected.Culture.Name));
                return 0;
            }
        } catch (Exception ex) {
            string escapedErr = ex.Message.Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\\"");
            Console.WriteLine(string.Format("{{\\"text\\":\\"\\",\\"confidence\\":0,\\"error\\":\\"{0}\\"}}", escapedErr));
            return 1;
        }
    }
}
`;

export class WindowsSpeechProvider implements ISpeechProvider {
  public readonly id: SpeechEngineType = 'windows-speech';
  public readonly name = 'Windows System Speech (SAPI / Offline)';
  public readonly isLocal = true;

  private preferredCulture?: string;
  private usePowerShellOnly = false;
  private binaryPath: string | null = null;
  private isBinaryChecked = false;

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

    if (process.platform === 'win32' && !this.usePowerShellOnly) {
      this.binaryPath = this.getOrCompileBinary();
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

    if (!this.isBinaryChecked && !this.usePowerShellOnly) {
      this.binaryPath = this.getOrCompileBinary();
      this.isBinaryChecked = true;
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
      console.error('[WindowsSpeechProvider] Transcription error:', errMsg);
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
    // Attempt fast C# binary execution first if available
    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      try {
        const { stdout } = await execFileAsync(this.binaryPath, [wavPath, targetLang || '']);
        const parsed = JSON.parse(stdout.trim());
        return parsed;
      } catch (err) {
        console.warn('[WindowsSpeechProvider] Binary run failed, falling back to PowerShell:', err);
      }
    }

    // PowerShell fallback
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

  private async getInstalledRecognizers(): Promise<SapiRecognizerItem[]> {
    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      try {
        const { stdout } = await execFileAsync(this.binaryPath, ['--list']);
        return JSON.parse(stdout.trim());
      } catch {
        // Fall back to PowerShell
      }
    }

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

  private getOrCompileBinary(): string | null {
    if (process.platform !== 'win32') return null;

    const cacheDir = path.join(os.tmpdir(), 'echolingo-sapi');
    const exePath = path.join(cacheDir, 'sapi-recognizer.exe');

    if (fs.existsSync(exePath)) {
      return exePath;
    }

    const cscCandidates = [
      'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
      'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
    ];
    const cscPath = cscCandidates.find((p) => fs.existsSync(p));
    if (!cscPath) return null;

    const wpfDllCandidates = [
      'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\WPF\\System.Speech.dll',
      'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\WPF\\System.Speech.dll',
    ];
    const wpfDll = wpfDllCandidates.find((p) => fs.existsSync(p));
    if (!wpfDll) return null;

    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      const csSourcePath = path.join(cacheDir, 'sapi-recognizer.cs');
      fs.writeFileSync(csSourcePath, SAPI_CS_SOURCE, 'utf8');

      execFileSync(cscPath, [
        '/nologo',
        '/optimize',
        '/target:exe',
        `/r:${wpfDll}`,
        `/out:${exePath}`,
        csSourcePath,
      ]);

      if (fs.existsSync(exePath)) {
        return exePath;
      }
    } catch (err) {
      console.warn('[WindowsSpeechProvider] Could not compile SAPI CLI helper, will use PowerShell:', err);
    }

    return null;
  }
}

