#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PackageRoot,
    [Parameter(Mandatory = $true)][string]$DataDir,
    [Parameter(Mandatory = $true)][string]$EvidenceDir,
    [switch]$RealModels
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Native Windows required' }
$PackageRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$exe = Join-Path $PackageRoot 'BeefTV.exe'
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'Complete portable package root required' }
foreach ($directory in @($DataDir, $EvidenceDir)) {
    if (-not [IO.Path]::IsPathRooted($directory) -or [IO.Path]::GetPathRoot($directory) -eq $directory) { throw 'Use explicit non-root absolute test directories' }
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}
$DataDir = (Resolve-Path -LiteralPath $DataDir).Path
$EvidenceDir = (Resolve-Path -LiteralPath $EvidenceDir).Path
foreach ($process in @(Get-Process -Name BeefTV -ErrorAction SilentlyContinue)) {
    if ($process.Path -eq $exe) { throw 'This executable is already running; save and exit its window first' }
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$saved = @{}
$names = @('CANVAS_DESKTOP_DATA_DIR','BEEFTV_AGENT_BASE_URL','BEEFTV_AGENT_API_KEY','BEEFTV_AGENT_MODEL','BEEFTV_AGENT_PROTOCOL')
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:CANVAS_DESKTOP_DATA_DIR = $DataDir
    if ($RealModels) {
        # Resolve actual model configuration from the formal application UI.
        foreach ($name in $names | Where-Object { $_ -ne 'CANVAS_DESKTOP_DATA_DIR' }) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
    } else {
        $env:BEEFTV_AGENT_BASE_URL = 'http://127.0.0.1:9/v1'
        $env:BEEFTV_AGENT_API_KEY = 'windows-final-no-model'
        $env:BEEFTV_AGENT_MODEL = 'windows-final-no-model'
        $env:BEEFTV_AGENT_PROTOCOL = 'chat-completion'
    }
    $process = Start-Process -FilePath $exe -WorkingDirectory ([IO.Path]::GetTempPath()) -PassThru -RedirectStandardOutput (Join-Path $EvidenceDir ($stamp + '.stdout.log')) -RedirectStandardError (Join-Path $EvidenceDir ($stamp + '.stderr.log'))
    [ordered]@{ utc=[DateTime]::UtcNow.ToString('o'); pid=$process.Id; exeSHA256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant(); dataDirectory=$DataDir; realModelsEnabled=[bool]$RealModels; acceptance='NOT TESTED: verify native window, host readiness and business behavior' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $EvidenceDir ($stamp + '.launch.json')) -Encoding utf8
    Write-Host "Launched PID $($process.Id). Verify the native window and bundled host; process creation is not PASS."
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
