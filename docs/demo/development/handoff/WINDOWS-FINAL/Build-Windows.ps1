#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$SourceRoot,
    [Parameter(Mandatory = $true)][string]$NodeRuntime,
    [string]$Manifest,
    [string]$OutputRoot,
    [switch]$Build
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
if ($env:OS -ne 'Windows_NT' -or -not [Environment]::Is64BitOperatingSystem) { throw 'Run on native Windows x64' }
# Resolve defaults in the body: param defaults must not depend on $PSScriptRoot.
if (-not $SourceRoot) { $SourceRoot = Join-Path $PSScriptRoot '..\..\..\..\..' }
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$NodeRuntime = (Resolve-Path -LiteralPath $NodeRuntime).Path
if (-not $Manifest) { $Manifest = Join-Path (Split-Path -Parent $SourceRoot) 'source-manifest.json' }
$Manifest = (Resolve-Path -LiteralPath $Manifest).Path
if (-not $OutputRoot) { $OutputRoot = Join-Path (Split-Path -Parent $SourceRoot) ('private-run-' + (Get-Date -Format 'yyyyMMdd-HHmmss')) }
if (-not [IO.Path]::IsPathRooted($OutputRoot)) { throw 'OutputRoot must be absolute' }
if (Test-Path -LiteralPath $OutputRoot) { throw 'OutputRoot already exists; preserve previous evidence and choose a new directory' }
New-Item -ItemType Directory -Path $OutputRoot | Out-Null
$node = Join-Path $NodeRuntime 'node.exe'
$tool = Join-Path $PSScriptRoot 'Verify-Handoff.mjs'
function Invoke-Logged([string]$Command, [string[]]$Arguments, [string]$Name) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $Command @Arguments 2>&1 | Out-File -LiteralPath (Join-Path $OutputRoot ($Name + '.log')) -Encoding utf8
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previous }
    if ($code -ne 0) { throw "$Name failed (exit $code); inspect private log" }
}
try {
    if (-not (Test-Path -LiteralPath $node -PathType Leaf)) { throw 'NodeRuntime must contain node.exe' }
    $runtime = & $node -p 'JSON.stringify([process.platform,process.arch,process.versions.node])'
    if ($LASTEXITCODE -ne 0 -or ($runtime -join '').Trim() -ne '["win32","x64","24.15.0"]') { throw 'Need exact Node 24.15.0 win32/x64' }
    Invoke-Logged $node @($tool, 'source', '--source', $SourceRoot, '--manifest', $Manifest, '--out', (Join-Path $OutputRoot 'source-check.json')) 'source-check'
    foreach ($name in @('go', 'bun')) {
        if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { throw "$name missing from PATH" }
    }
    $oldCurrentDirectory = [Environment]::CurrentDirectory
    Push-Location -LiteralPath $SourceRoot
    [Environment]::CurrentDirectory = $SourceRoot
    try {
        $env:BEEFTV_NODE_RUNTIME = $NodeRuntime
        $env:GOOS = 'windows'
        $env:GOARCH = 'amd64'
        $env:GOTOOLCHAIN = 'local'
        & (Join-Path $SourceRoot 'scripts\assert-windows-dwarf5-cgo.ps1')
        Invoke-Logged 'go' @('version') 'go-version'
        Invoke-Logged 'bun' @('--version') 'bun-version'
        Invoke-Logged 'bun' @((Join-Path $SourceRoot 'scripts\package-agent-host.mjs'), 'windows/amd64', '--verify-runtime') 'node-runtime'
        $os = Get-CimInstance Win32_OperatingSystem
        [ordered]@{ utc=[DateTime]::UtcNow.ToString('o'); os=$os.Caption; version=$os.Version; architecture=$os.OSArchitecture; powershell=$PSVersionTable.PSVersion.ToString(); sourceManifestSHA256=(Get-FileHash -LiteralPath $Manifest -Algorithm SHA256).Hash.ToLowerInvariant(); requestedBuild=[bool]$Build; nativeBuildTested=$false; modelCalls=0 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputRoot 'environment.json') -Encoding utf8
        if ($Build) {
            # Separate process ensures a terminating build failure becomes a nonzero exit.
            $escaped = (Join-Path $SourceRoot 'scripts\build-beeftv-windows-release.ps1').Replace("'", "''")
            Invoke-Logged 'powershell.exe' @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', "& '$escaped'") 'windows-build'
            $bin = Join-Path $SourceRoot 'backend\cmd\desktop\build\bin'
            Invoke-Logged $node @($tool, 'bundle', '--source', $SourceRoot, '--bundle', $bin, '--out', (Join-Path $OutputRoot 'payload-manifest.json')) 'payload-inspect'
            $bundledNode = Join-Path $bin 'agent-host\runtime\node.exe'
            $actual = & $bundledNode -p 'JSON.stringify([process.platform,process.arch,process.versions.node])'
            if ($LASTEXITCODE -ne 0 -or ($actual -join '').Trim() -ne '["win32","x64","24.15.0"]') { throw 'Shipped Node runtime mismatch' }
            Invoke-Logged $bundledNode @('--test', (Join-Path $SourceRoot 'docs\demo\development\tools\Inspect-Saved-Project.test.mjs')) 'snapshot-tests'
            Copy-Item -LiteralPath $bin -Destination (Join-Path $OutputRoot 'portable') -Recurse
            Invoke-Logged $node @($tool, 'bundle', '--source', $SourceRoot, '--bundle', (Join-Path $OutputRoot 'portable'), '--out', (Join-Path $OutputRoot 'portable-manifest.json')) 'portable-inspect'
            if ((Get-FileHash -LiteralPath (Join-Path $OutputRoot 'payload-manifest.json')).Hash -ne (Get-FileHash -LiteralPath (Join-Path $OutputRoot 'portable-manifest.json')).Hash) { throw 'Copied payload differs from build output' }
            Compress-Archive -Path (Join-Path $OutputRoot 'portable\*') -DestinationPath (Join-Path $OutputRoot 'BeefTV-windows-x64.zip') -CompressionLevel Optimal
            Expand-Archive -LiteralPath (Join-Path $OutputRoot 'BeefTV-windows-x64.zip') -DestinationPath (Join-Path $OutputRoot 'zip-check')
            Invoke-Logged $node @($tool, 'bundle', '--source', $SourceRoot, '--bundle', (Join-Path $OutputRoot 'zip-check'), '--out', (Join-Path $OutputRoot 'zip-check-manifest.json')) 'zip-inspect'
            if ((Get-FileHash -LiteralPath (Join-Path $OutputRoot 'payload-manifest.json')).Hash -ne (Get-FileHash -LiteralPath (Join-Path $OutputRoot 'zip-check-manifest.json')).Hash) { throw 'ZIP extraction differs from build output' }
            Invoke-Logged $node @($tool, 'source', '--source', $SourceRoot, '--manifest', $Manifest, '--out', (Join-Path $OutputRoot 'source-after-build.json')) 'source-after-build'
            Get-FileHash -LiteralPath (Join-Path $OutputRoot 'BeefTV-windows-x64.zip') -Algorithm SHA256 | Select-Object Hash | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputRoot 'portable-zip-sha256.json') -Encoding utf8
        }
    } finally {
        Pop-Location
        [Environment]::CurrentDirectory = $oldCurrentDirectory
    }
    [ordered]@{ pass=$true; buildCompleted=[bool]$Build; nativeLaunchTested=$false; modelCalls=0 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputRoot 'preparation-result.json') -Encoding utf8
    Write-Host "Preparation complete: $OutputRoot. Native launch and E2E acceptance remain pending."
} catch {
    [ordered]@{ pass=$false; buildRequested=[bool]$Build; nativeLaunchTested=$false; error=$_.Exception.Message } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputRoot 'preparation-result.json') -Encoding utf8
    throw
}
