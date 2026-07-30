<#
.SYNOPSIS
    Installs the repository's ComfyUI integration for an NVIDIA GeForce GTX 1080.

.DESCRIPTION
    Recreates the machine layout recorded in the repository documentation:
    C:\AI\ComfyUI-GTX1080, a Python 3.11 virtual environment, PyTorch CUDA 11.8,
    the required animation custom nodes, and the SD 1.5 motion-support models.

    The script is safe to rerun. Existing clones, environments, models, and .env
    values are retained.
#>

[CmdletBinding()]
param(
    [string]$InstallRoot = "C:\AI\ComfyUI-GTX1080",
    [int]$Port = 8188,
    [switch]$SkipModels
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonVersion = "3.11"
$torchVersion = "2.7.1"

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,
        [string[]]$ArgumentList = @()
    )

    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE`: $FilePath $($ArgumentList -join ' ')"
    }
}

function Get-Python311 {
    try {
        $candidate = (& py "-$pythonVersion" -c "import sys; print(sys.executable)" 2>$null)
        if ($LASTEXITCODE -eq 0 -and $candidate) {
            return $candidate.Trim()
        }
    } catch {
        # Python launcher or requested interpreter is not installed.
    }

    $knownPaths = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe"),
        "C:\Program Files\Python311\python.exe"
    )
    foreach ($candidate in $knownPaths) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }
    return $null
}

function Install-GitRepository {
    param(
        [Parameter(Mandatory)]
        [string]$Url,
        [Parameter(Mandatory)]
        [string]$Destination
    )

    if (Test-Path -LiteralPath (Join-Path $Destination ".git")) {
        Write-Host "Keeping existing repository: $Destination"
        return
    }
    if (Test-Path -LiteralPath $Destination) {
        throw "Destination exists but is not a Git checkout: $Destination"
    }
    Invoke-Checked git @("clone", "--depth", "1", $Url, $Destination)
}

function Install-RequirementsIfPresent {
    param(
        [Parameter(Mandatory)]
        [string]$Python,
        [Parameter(Mandatory)]
        [string]$Directory
    )

    $requirements = Join-Path $Directory "requirements.txt"
    if (Test-Path -LiteralPath $requirements) {
        Invoke-Checked $Python @("-m", "pip", "install", "-r", $requirements)
    }
}

function Get-RemoteFile {
    param(
        [Parameter(Mandatory)]
        [string]$Url,
        [Parameter(Mandatory)]
        [string]$Destination
    )

    if ((Test-Path -LiteralPath $Destination) -and ((Get-Item -LiteralPath $Destination).Length -gt 1MB)) {
        Write-Host "Keeping existing model: $Destination"
        return
    }
    $destinationDirectory = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
    Write-Host "Downloading $(Split-Path -Leaf $Destination)..."
    Invoke-Checked curl.exe @("-L", "--fail", "--retry", "3", "--retry-delay", "3", "-o", $Destination, $Url)
}

Write-Step "Checking the GPU"
$gpuName = (& nvidia-smi --query-gpu=name --format=csv,noheader 2>$null | Select-Object -First 1)
if (-not $gpuName) {
    throw "nvidia-smi could not detect an NVIDIA GPU."
}
if ($gpuName -notmatch "GTX 1080") {
    Write-Warning "Expected a GTX 1080, but detected '$gpuName'. The install will continue with the documented GTX profile."
} else {
    Write-Host "Detected $gpuName."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is required. Install Git for Windows, then rerun this script."
}
if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
    throw "curl.exe is required and normally ships with current Windows versions."
}

Write-Step "Locating Python $pythonVersion"
$basePython = Get-Python311
if (-not $basePython) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "Python $pythonVersion is required and winget is unavailable."
    }
    Invoke-Checked winget @(
        "install", "--id", "Python.Python.3.11", "-e", "--scope", "user",
        "--accept-package-agreements", "--accept-source-agreements"
    )
    $basePython = Get-Python311
}
if (-not $basePython) {
    throw "Python $pythonVersion was installed but could not be located. Open a new PowerShell window and rerun the script."
}
Write-Host "Using $basePython"

Write-Step "Installing ComfyUI at $InstallRoot"
$installParent = Split-Path -Parent $InstallRoot
New-Item -ItemType Directory -Force -Path $installParent | Out-Null
Install-GitRepository -Url "https://github.com/Comfy-Org/ComfyUI.git" -Destination $InstallRoot

$venvRoot = Join-Path $InstallRoot ".venv"
$venvPython = Join-Path $venvRoot "Scripts\python.exe"
if (-not (Test-Path -LiteralPath $venvPython)) {
    Invoke-Checked $basePython @("-m", "venv", $venvRoot)
}

Write-Step "Installing the CUDA 11.8 runtime recorded for the GTX 1080"
Invoke-Checked $venvPython @("-m", "pip", "install", "--upgrade", "pip", "wheel", "setuptools")
Invoke-Checked $venvPython @(
    "-m", "pip", "install",
    "torch==$torchVersion", "torchvision==0.22.1", "torchaudio==$torchVersion",
    "--index-url", "https://download.pytorch.org/whl/cu118"
)
Install-RequirementsIfPresent -Python $venvPython -Directory $InstallRoot

Write-Step "Installing the documented custom-node stack"
$customNodesRoot = Join-Path $InstallRoot "custom_nodes"
New-Item -ItemType Directory -Force -Path $customNodesRoot | Out-Null
$nodeRepositories = @(
    @{ Url = "https://github.com/cubiq/ComfyUI_IPAdapter_plus.git"; Name = "ComfyUI_IPAdapter_plus" },
    @{ Url = "https://github.com/Kosinkadink/ComfyUI-Advanced-ControlNet.git"; Name = "ComfyUI-Advanced-ControlNet" },
    @{ Url = "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git"; Name = "ComfyUI-VideoHelperSuite" },
    @{ Url = "https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved.git"; Name = "ComfyUI-AnimateDiff-Evolved" },
    @{ Url = "https://github.com/Fannovel16/ComfyUI-Frame-Interpolation.git"; Name = "ComfyUI-Frame-Interpolation" }
)
foreach ($nodeRepository in $nodeRepositories) {
    $nodePath = Join-Path $customNodesRoot $nodeRepository.Name
    Install-GitRepository -Url $nodeRepository.Url -Destination $nodePath
    Install-RequirementsIfPresent -Python $venvPython -Directory $nodePath
}
Invoke-Checked $venvPython @("-m", "pip", "install", "cupy-cuda11x")

if (-not $SkipModels) {
    Write-Step "Downloading the models named by the repository workflow"
    Get-RemoteFile `
        -Url "https://huggingface.co/guoyww/animatediff/resolve/main/mm_sd_v15_v2.ckpt" `
        -Destination (Join-Path $InstallRoot "models\animatediff_models\mm_sd_v15_v2.ckpt")
    Get-RemoteFile `
        -Url "https://huggingface.co/h94/IP-Adapter/resolve/main/models/image_encoder/model.safetensors" `
        -Destination (Join-Path $InstallRoot "models\clip_vision\CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors")
    Get-RemoteFile `
        -Url "https://huggingface.co/h94/IP-Adapter/resolve/main/models/ip-adapter-plus_sd15.safetensors" `
        -Destination (Join-Path $InstallRoot "models\ipadapter\ip-adapter-plus_sd15.safetensors")

    Write-Warning "The licensed SD 1.5 checkpoint named in COMFYUI_CHECKPOINT is not downloaded automatically."
    Write-Host "Place it in $InstallRoot\models\checkpoints before running a motion workflow."
}

Write-Step "Creating the GTX 1080 launcher"
$launcherPath = Join-Path $InstallRoot "start-gtx1080.ps1"
$launcher = @"
`$ErrorActionPreference = "Stop"
Set-Location -LiteralPath "$InstallRoot"
& ".\.venv\Scripts\python.exe" "main.py" --listen 127.0.0.1 --port $Port
"@
Set-Content -LiteralPath $launcherPath -Value $launcher -Encoding UTF8

Write-Step "Connecting this repository"
$envPath = Join-Path $repoRoot ".env"
if (-not (Test-Path -LiteralPath $envPath)) {
    Copy-Item -LiteralPath (Join-Path $repoRoot ".env.example") -Destination $envPath
}
$envText = Get-Content -Raw -LiteralPath $envPath
$settings = [ordered]@{
    "COMFYUI_INSTALL_ROOT" = $InstallRoot
    "COMFYUI_BASE_URL" = "http://127.0.0.1:$Port"
}
foreach ($setting in $settings.GetEnumerator()) {
    $line = "$($setting.Key)=$($setting.Value)"
    if ($envText -match "(?m)^$([regex]::Escape($setting.Key))=") {
        $envText = [regex]::Replace($envText, "(?m)^$([regex]::Escape($setting.Key))=.*$", $line)
    } else {
        $envText = $envText.TrimEnd() + [Environment]::NewLine + $line + [Environment]::NewLine
    }
}
Set-Content -LiteralPath $envPath -Value $envText -Encoding UTF8

Write-Step "Verifying CUDA from the ComfyUI environment"
Invoke-Checked $venvPython @(
    "-c",
    "import torch; print('torch=' + torch.__version__); print('cuda=' + str(torch.cuda.is_available())); print('device=' + (torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none'))"
)

Write-Host "`nComfyUI integration installed." -ForegroundColor Green
Write-Host "Start it: powershell -ExecutionPolicy Bypass -File `"$launcherPath`""
Write-Host "Then check it from this repo: npm run comfyui:check"
