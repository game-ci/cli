# game-ci CLI installer for Windows
# Usage: irm https://raw.githubusercontent.com/game-ci/cli/main/install.ps1 | iex
#
# Environment variables:
#   GAME_CI_VERSION   - Install a specific version (e.g., v0.1.0). Defaults to latest.
#   GAME_CI_INSTALL   - Installation directory. Defaults to $HOME\.game-ci\bin.

$ErrorActionPreference = 'Stop'

$Repo = "game-ci/cli"
$InstallDir = if ($env:GAME_CI_INSTALL) { $env:GAME_CI_INSTALL } else { Join-Path $env:USERPROFILE ".game-ci\bin" }
$AssetName = "game-ci-windows-x64.exe"
$BinaryName = "game-ci.exe"

function Write-Info($Message) {
    Write-Host "info: " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warn($Message) {
    Write-Host "warn: " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

if ($env:GAME_CI_VERSION) {
    $Version = $env:GAME_CI_VERSION
    Write-Info "Using specified version: $Version"
} else {
    Write-Info "Fetching latest release..."
    try {
        $Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
        $Version = $Release.tag_name
    } catch {
        Write-Host "error: Could not determine latest version." -ForegroundColor Red
        exit 1
    }
}

$DownloadUrl = "https://github.com/$Repo/releases/download/$Version/$AssetName"
$ChecksumUrl = "https://github.com/$Repo/releases/download/$Version/checksums.txt"
$BinaryPath = Join-Path $InstallDir $BinaryName

Write-Host ""
Write-Info "Installing game-ci CLI $Version (windows-x64)"
Write-Info "  from: $DownloadUrl"
Write-Info "  to:   $BinaryPath"
Write-Host ""

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $BinaryPath -UseBasicParsing
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "error: Release asset not found: $AssetName ($Version)" -ForegroundColor Red
    } else {
        Write-Host "error: Download failed: $_" -ForegroundColor Red
    }
    exit 1
}

# Verify checksum
try {
    $Checksums = Invoke-WebRequest -Uri $ChecksumUrl -UseBasicParsing | Select-Object -ExpandProperty Content
    $ExpectedLine = $Checksums -split "`n" | Where-Object { $_ -match $AssetName } | Select-Object -First 1
    if ($ExpectedLine) {
        $ExpectedHash = ($ExpectedLine -split '\s+')[0]
        $ActualHash = (Get-FileHash -Path $BinaryPath -Algorithm SHA256).Hash.ToLower()
        if ($ExpectedHash -eq $ActualHash) {
            Write-Info "Checksum verified (SHA256)"
        } else {
            Write-Host "error: Checksum verification failed!" -ForegroundColor Red
            Remove-Item $BinaryPath -Force
            exit 1
        }
    }
} catch {
    # Checksums not available; continue
}

try {
    $VersionOutput = & $BinaryPath --help 2>&1
    Write-Info "Verified: binary runs successfully"
} catch {
    Write-Warn "Binary downloaded but could not verify."
}

Write-Host ""
Write-Host "game-ci CLI installed successfully!" -ForegroundColor Green -BackgroundColor Black
Write-Host ""

$UserPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
if ($UserPath -notlike "*$InstallDir*") {
    Write-Warn "game-ci is not in your PATH."
    Write-Host ""
    Write-Host "To add it permanently, run:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  [Environment]::SetEnvironmentVariable('PATH', ""$InstallDir;"" + [Environment]::GetEnvironmentVariable('PATH', 'User'), 'User')"
    Write-Host ""
    $AddToPath = Read-Host "Add to PATH now? (Y/n)"
    if ($AddToPath -ne 'n' -and $AddToPath -ne 'N') {
        [Environment]::SetEnvironmentVariable('PATH', "$InstallDir;$UserPath", 'User')
        $env:PATH = "$InstallDir;$env:PATH"
        Write-Info "Added to PATH. You can now run: game-ci --help"
    }
} else {
    Write-Info "game-ci is already in your PATH. Run: game-ci --help"
}
