# game-ci CLI installer for Windows
# Usage: irm https://raw.githubusercontent.com/game-ci/cli/main/install.ps1 | iex
#
# Environment variables:
#   GAME_CI_VERSION   - Install a specific version (e.g., v0.1.0). Defaults to latest.
#   GAME_CI_INSTALL   - Installation directory. Defaults to $HOME\.game-ci\bin.

$ErrorActionPreference = 'Stop'

$Repo = "game-ci/cli"
$InstallDir = if ($env:GAME_CI_INSTALL) { $env:GAME_CI_INSTALL } else { Join-Path $env:USERPROFILE ".game-ci\bin" }
# Releases ship a .zip, not a bare .exe: the binary is not self-contained, it
# resolves its own static assets (default-build-script/, platforms/*,
# unity-config/) from a dist/ directory that must sit next to it on disk (see
# game-ci/cli#73). Both live inside this archive, so the install extracts it.
$AssetName = "game-ci-windows-x64.zip"
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

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("game-ci-" + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
$ArchivePath = Join-Path $TempDir $AssetName

try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ArchivePath -UseBasicParsing
} catch {
    Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "error: Release asset not found: $AssetName ($Version)" -ForegroundColor Red
    } else {
        Write-Host "error: Download failed: $_" -ForegroundColor Red
    }
    exit 1
}

# Verify the checksum of the archive, before extracting it: checksums.txt
# lists the release archives, not the binary inside them.
try {
    $Response = Invoke-WebRequest -Uri $ChecksumUrl -UseBasicParsing
    # .Content comes back as a byte[] rather than a string on some
    # PowerShell/host combinations, which silently yields an empty hash and
    # skips verification entirely - decode explicitly instead.
    $Checksums = if ($Response.Content -is [byte[]]) {
        [System.Text.Encoding]::UTF8.GetString($Response.Content)
    } else {
        $Response.Content
    }
    # Anchor to end-of-line so the arm64 line can't match the x64 asset.
    $ExpectedLine = $Checksums -split "`n" | Where-Object { $_ -match ("\s" + [regex]::Escape($AssetName) + "\s*$") } | Select-Object -First 1
    if ($ExpectedLine) {
        $ExpectedHash = ($ExpectedLine.Trim() -split '\s+')[0]
        $ActualHash = (Get-FileHash -Path $ArchivePath -Algorithm SHA256).Hash.ToLower()
        if ($ExpectedHash -eq $ActualHash) {
            Write-Info "Checksum verified (SHA256)"
        } else {
            Write-Host "error: Checksum verification failed!" -ForegroundColor Red
            Write-Host "  Expected: $ExpectedHash" -ForegroundColor Red
            Write-Host "  Got:      $ActualHash" -ForegroundColor Red
            Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
            exit 1
        }
    } else {
        Write-Warn "No checksum listed for $AssetName; skipping verification."
    }
} catch {
    Write-Warn "Could not fetch checksums.txt; skipping checksum verification."
}

try {
    Expand-Archive -Path $ArchivePath -DestinationPath $InstallDir -Force
} catch {
    Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "error: Failed to extract ${AssetName}: $_" -ForegroundColor Red
    exit 1
}

Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue

if (-not (Test-Path $BinaryPath)) {
    Write-Host "error: Archive extracted but $BinaryName was not found in $InstallDir" -ForegroundColor Red
    exit 1
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
    # The documented usage is `irm ... | iex`, which frequently runs
    # non-interactively (CI, automation, some hosts). Read-Host throws there,
    # which would fail the whole install after it had already succeeded.
    $CanPrompt = -not [System.Console]::IsInputRedirected -and $Host.UI.RawUI -ne $null
    $AddToPath = if ($CanPrompt) {
        try { Read-Host "Add to PATH now? (Y/n)" } catch { 'n' }
    } else {
        Write-Info "Non-interactive shell; leaving PATH unchanged (see the command above)."
        'n'
    }
    if ($AddToPath -ne 'n' -and $AddToPath -ne 'N') {
        [Environment]::SetEnvironmentVariable('PATH', "$InstallDir;$UserPath", 'User')
        $env:PATH = "$InstallDir;$env:PATH"
        Write-Info "Added to PATH. You can now run: game-ci --help"
    }
} else {
    Write-Info "game-ci is already in your PATH. Run: game-ci --help"
}
