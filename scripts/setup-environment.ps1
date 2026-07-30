<#
.SYNOPSIS
    Bootstrap a fresh Windows environment for gigbizness-stories-factory.

.DESCRIPTION
    Copies .env.example to .env when missing, creates the required workspaces folder,
    and installs ffmpeg automatically with winget when available.
#>

function Write-Ok($message) {
    Write-Host "[OK]   $message" -ForegroundColor Green
}

function Write-Warn($message) {
    Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Write-ErrorAndExit($message) {
    Write-Host "[ERROR] $message" -ForegroundColor Red
    exit 1
}

function Test-Command($name) {
    try {
        Get-Command $name -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")

Set-Location $repoRoot

Write-Host "Bootstrapping gigbizness-stories-factory in $repoRoot"

$envExample = Join-Path $repoRoot ".env.example"
$envPath = Join-Path $repoRoot ".env"
if (-not (Test-Path $envExample)) {
    Write-ErrorAndExit "Missing .env.example in repository root."
}

if (-not (Test-Path $envPath)) {
    Copy-Item -Path $envExample -Destination $envPath
    Write-Ok "Created .env from .env.example. Update .env with machine-specific values."
} else {
    Write-Ok ".env already exists."
}

$workspacesDir = Join-Path $repoRoot "workspaces"
if (-not (Test-Path $workspacesDir)) {
    New-Item -ItemType Directory -Path $workspacesDir | Out-Null
    Write-Ok "Created workspaces/ directory."
} else {
    Write-Ok "workspaces/ directory already exists."
}

$requiredCommands = @(
    @{ Name = 'node'; Check = { Test-Command 'node' } }
    @{ Name = 'python'; Check = { Test-Command 'python' } }
    @{ Name = 'ffmpeg'; Check = { Test-Command 'ffmpeg' } }
)

$missing = @()
foreach ($entry in $requiredCommands) {
    if (-not (& $entry.Check)) {
        $missing += $entry.Name
    }
}

if ($missing -contains 'ffmpeg') {
    if (Test-Command 'winget') {
        Write-Host "ffmpeg is missing. Installing via winget..."
        winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
        if (-not (Test-Command 'ffmpeg')) {
            Write-Warn "ffmpeg installation completed but ffmpeg is still not available on PATH. Restart your shell if needed."
        } else {
            Write-Ok "ffmpeg installed successfully."
            $missing = $missing | Where-Object { $_ -ne 'ffmpeg' }
        }
    } else {
        Write-Warn "ffmpeg is missing and winget is not available. Install ffmpeg manually from https://ffmpeg.org/."
    }
}

if ($missing.Count -gt 0) {
    Write-Warn "Missing commands: $($missing -join ', ')"
    Write-Host "Please install the missing tools and rerun this script."
} else {
    Write-Ok "All required commands are available."
}

Write-Host "Setup summary:"
Write-Host "  .env file: $([bool](Test-Path $envPath))"
Write-Host "  workspaces/: $([bool](Test-Path $workspacesDir))"
Write-Host "  node: $(if (Test-Command 'node') { 'installed' } else { 'missing' })"
Write-Host "  python: $(if (Test-Command 'python') { 'installed' } else { 'missing' })"
Write-Host "  ffmpeg: $(if (Test-Command 'ffmpeg') { 'installed' } else { 'missing' })"

Write-Host "Done. Run 'npm run system:check' next to validate the repo environment."
