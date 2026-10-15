Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
$langs = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
$result = $langs | ForEach-Object {
    @{
        code = $_.LanguageTag
        name = $_.DisplayName
        nativeName = $_.NativeName
    }
}
Write-Output ($result | ConvertTo-Json -Compress)

