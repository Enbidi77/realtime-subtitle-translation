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

