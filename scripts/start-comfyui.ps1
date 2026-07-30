[CmdletBinding()]
param(
    [string]$InstallRoot = "C:\AI\ComfyUI-GTX1080",
    [int]$Port = 8188
)

$ErrorActionPreference = "Stop"
$launcher = Join-Path $InstallRoot "start-gtx1080.ps1"
if (-not (Test-Path -LiteralPath $launcher)) {
    throw "ComfyUI launcher not found at '$launcher'. Run scripts\install-comfyui-gtx1080.ps1 first."
}

& $launcher
