param(
    [Parameter(Mandatory = $true)]
    [string]$WavPath,
    [string]$TargetLang = ""
)

Add-Type -AssemblyName System.Speech
$wav = $WavPath
$lang = $TargetLang

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

