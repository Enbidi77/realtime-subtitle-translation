import {
  OcrLanguageInfo,
  OcrProviderCapability,
  OcrProviderId,
  OcrRecognizeRequest,
  OcrResponse,
  OcrBlock,
  OcrLine,
  OcrWord,
} from '@echo-lingo/contracts';
import { IOcrProvider, normalizeOcrResponse } from '@echo-lingo/ocr-core';
import { dotnetBridge } from '@echo-lingo/dotnet-bridge';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('WindowsNativeOcrProvider');

const execFileAsync = promisify(execFile);

const POWERSHELL_OCR_SCRIPT = `
param(
    [string]$ImagePath,
    [string]$LanguageTag = "auto"
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod
} | Select-Object -First 1

function AwaitTask($WinRtAsyncAction, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtAsyncAction))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

try {
    $fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)
    $file = AwaitTask $fileTask ([Windows.Storage.StorageFile])

    $streamTask = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    $stream = AwaitTask $streamTask ([Windows.Storage.Streams.IRandomAccessStream])

    $decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
    $decoder = AwaitTask $decoderTask ([Windows.Graphics.Imaging.BitmapDecoder])

    $bitmapTask = $decoder.GetSoftwareBitmapAsync()
    $bitmap = AwaitTask $bitmapTask ([Windows.Graphics.Imaging.SoftwareBitmap])

    # Select OCR Engine
    $engine = $null
    if ($LanguageTag -and $LanguageTag -ne "auto") {
        $langObj = [Windows.Globalization.Language]::new($LanguageTag)
        if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($langObj)) {
            $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($langObj)
        }
    }
    if ($null -eq $engine) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    }
    if ($null -eq $engine) {
        $available = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
        if ($available.Count -gt 0) {
            $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($available[0])
        }
    }
    if ($null -eq $engine) {
        Write-Output '{"error": "No supported Windows OCR engine found"}'
        exit 1
    }

    $ocrTask = $engine.RecognizeAsync($bitmap)
    $ocrResult = AwaitTask $ocrTask ([Windows.Media.Ocr.OcrResult])

    $linesList = @()
    foreach ($line in $ocrResult.Lines) {
        $wordsList = @()
        foreach ($word in $line.Words) {
            $wordsList += @{
                text = $word.Text
                confidence = 0.95
                boundingBox = @{
                    x = [int]$word.BoundingRect.X
                    y = [int]$word.BoundingRect.Y
                    width = [int]$word.BoundingRect.Width
                    height = [int]$word.BoundingRect.Height
                }
            }
        }
        $linesList += @{
            text = $line.Text
            confidence = 0.95
            words = $wordsList
        }
    }

    $output = @{
        text = $ocrResult.Text
        lines = $linesList
        confidence = 0.95
        language = $engine.RecognizerLanguage.LanguageTag
    }

    $json = $output | ConvertTo-Json -Depth 5 -Compress
    Write-Output $json
} catch {
    $errObj = @{ error = $_.Exception.Message }
    Write-Output ($errObj | ConvertTo-Json -Compress)
    exit 1
}
`;

export class WindowsNativeOcrProvider implements IOcrProvider {
  public readonly id: OcrProviderId = 'windows-native';
  public readonly displayName = 'Windows Native OCR (Hardware Accelerated)';
  public readonly isLocal = true;

  private scriptPath: string | null = null;
  private cachedLanguages: OcrLanguageInfo[] | null = null;

  public getSupportedLanguages(): OcrLanguageInfo[] {
    if (this.cachedLanguages) return this.cachedLanguages;

    return [
      { code: 'auto', name: 'Auto Detect / System Default', nativeName: 'Tự động phát hiện' },
      { code: 'en-US', name: 'English (United States)', nativeName: 'English' },
      { code: 'zh-Hant-TW', name: 'Chinese (Traditional, Taiwan)', nativeName: '繁體中文' },
      { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
    ];
  }

  public async refreshSupportedLanguages(): Promise<OcrLanguageInfo[]> {
    if (process.platform !== 'win32') {
      return this.getSupportedLanguages();
    }

    if (dotnetBridge.isAvailable()) {
      try {
        const langs = await dotnetBridge.ocr.getAvailableLanguages();
        if (langs && langs.length > 0) {
          this.cachedLanguages = [
            { code: 'auto', name: 'Auto Detect / System Default', nativeName: 'Tự động phát hiện' },
            ...langs.map((l) => ({
              code: l.languageTag,
              name: l.displayName,
              nativeName: l.displayName,
            })),
          ];
          return this.cachedLanguages;
        }
      } catch (err) {
        log.warn('DotnetBridge OCR languages error, falling back to PowerShell:', err);
      }
    }

    try {
      const psCommand = `
        [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
        $langs = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
        $langs | ForEach-Object {
          @{ code = $_.LanguageTag; name = $_.DisplayName; nativeName = $_.NativeName }
        } | ConvertTo-Json -Compress
      `;

      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand], {
        timeout: 5000,
      });

      if (stdout && stdout.trim()) {
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        this.cachedLanguages = [
          { code: 'auto', name: 'Auto Detect / System Default', nativeName: 'Tự động phát hiện' },
          ...list.map((l: any) => ({
            code: l.code,
            name: l.name,
            nativeName: l.nativeName,
          })),
        ];
        return this.cachedLanguages;
      }
    } catch (err) {
      log.warn('Error detecting installed OCR languages:', err);
    }

    return this.getSupportedLanguages();
  }

  public async recognize(request: OcrRecognizeRequest): Promise<OcrResponse> {
    const start = Date.now();

    if (process.platform !== 'win32') {
      throw new Error('Windows Native OCR is only supported on Windows operating systems.');
    }

    if (!request.imageBuffer) {
      return normalizeOcrResponse({
        text: '',
        blocks: [],
        lines: [],
        confidence: 0,
        durationMs: 0,
        providerId: this.id,
      });
    }

    // Prepare temporary image file for PowerShell consumption
    const tempDir = os.tmpdir();
    const tempImagePath = path.join(tempDir, `echolingo_ocr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`);

    try {
      let buffer: Buffer;
      if (typeof request.imageBuffer === 'string') {
        const base64Data = request.imageBuffer.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(request.imageBuffer);
      }

      await fs.writeFile(tempImagePath, buffer);

      const langTag = request.language || 'auto';

      if (dotnetBridge.isAvailable()) {
        try {
          const parsed = await dotnetBridge.ocr.recognize(tempImagePath, langTag);
          if (parsed.error) {
            throw new Error(`Windows OCR failed: ${parsed.error}`);
          }

          const lines: OcrLine[] = (parsed.lines || []).map((l) => ({
            text: l.text,
            confidence: l.confidence ?? 0.95,
            words: (l.words || []).map((w) => ({
              text: w.text,
              confidence: w.confidence ?? 0.95,
              boundingBox: w.boundingBox,
            })),
          }));

          const blocks: OcrBlock[] = [
            {
              text: parsed.text || '',
              confidence: 0.95,
              lines,
            },
          ];

          return normalizeOcrResponse({
            text: parsed.text || '',
            blocks,
            lines,
            confidence: 0.95,
            language: parsed.detectedLanguage || request.language,
            durationMs: Date.now() - start,
            providerId: this.id,
          });
        } catch (err) {
          log.warn('DotnetBridge OCR recognize failed, falling back to PowerShell:', err);
        }
      }

      if (!this.scriptPath) {
        this.scriptPath = path.join(tempDir, 'echolingo_win_ocr.ps1');
        await fs.writeFile(this.scriptPath, POWERSHELL_OCR_SCRIPT, 'utf-8');
      }

      const { stdout, stderr } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath, '-ImagePath', tempImagePath, '-LanguageTag', langTag],
        { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
      );

      if (stderr && stderr.trim().length > 0) {
        log.warn('Stderr output:', stderr);
      }

      const trimmed = (stdout || '').trim();
      if (!trimmed) {
        throw new Error('Windows OCR produced empty output');
      }

      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error(`Invalid JSON output from Windows OCR: ${trimmed}`);
      }

      const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
      if (parsed.error) {
        throw new Error(`Windows OCR failed: ${parsed.error}`);
      }

      const lines: OcrLine[] = (parsed.lines || []).map((l: any) => ({
        text: l.text,
        confidence: l.confidence ?? 0.95,
        words: (l.words || []).map((w: any) => ({
          text: w.text,
          confidence: w.confidence ?? 0.95,
          boundingBox: w.boundingBox,
        })),
      }));

      const blocks: OcrBlock[] = [
        {
          text: parsed.text || '',
          confidence: parsed.confidence ?? 0.95,
          lines,
        },
      ];

      return normalizeOcrResponse({
        text: parsed.text || '',
        blocks,
        lines,
        confidence: parsed.confidence ?? 0.95,
        language: parsed.language || request.language,
        durationMs: Date.now() - start,
        providerId: this.id,
      });
    } finally {
      // Clean up temporary image file promptly
      try {
        await fs.unlink(tempImagePath);
      } catch {
        // ignore cleanup error
      }
    }
  }

  public async healthCheck(): Promise<boolean> {
    return process.platform === 'win32';
  }

  public getCapability(): OcrProviderCapability {
    return {
      id: this.id,
      name: this.displayName,
      description: 'Zero-download, native Windows 10/11 OCR engine with GPU acceleration',
      isLocal: true,
      isAvailable: process.platform === 'win32',
      supportedLanguages: [
        { code: 'auto', name: 'Auto Detect / System Default', nativeName: 'Tự động phát hiện' },
        { code: 'en-US', name: 'English (United States)', nativeName: 'English' },
        { code: 'zh-Hant-TW', name: 'Chinese (Traditional, Taiwan)', nativeName: '繁體中文' },
        { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
      ],
    };
  }
}
