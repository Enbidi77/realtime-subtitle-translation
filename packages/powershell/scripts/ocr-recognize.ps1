param(
    [Parameter(Mandatory = $true)]
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

