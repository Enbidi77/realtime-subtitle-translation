param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$DestinationPath
)

Expand-Archive -Path $Path -DestinationPath $DestinationPath -Force

