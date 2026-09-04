# Activates Unity
#
# $ACTIVATE_LICENSE_PATH (no $Env: prefix) is an unset local PowerShell
# variable, not the environment variable set by the caller - always empty,
# so Push-Location silently did nothing and every path built from it below
# resolved wrong. Confirmed live: "Changing to "" directory." followed by
# Unity's own "CreateDirectory ... failed" / "Unable to open log file,
# exiting" cascade into "Unclassified error occured while trying to
# activate license." on unity-builder#844's Windows CI (game-ci/cli#844
# investigation). dist/platforms/windows/steps/activate.ps1 (the native,
# non-container path) already uses $Env: correctly.
. (Join-Path $PSScriptRoot 'licensing_method.ps1')

Write-Host "Changing to `"$Env:ACTIVATE_LICENSE_PATH`" directory."
Push-Location $Env:ACTIVATE_LICENSE_PATH

# Which strategy to activate with. Normally resolved by the CLI and passed in
# as UNITY_LICENSING_METHOD; Get-UnityLicensingMethod falls back to deriving it
# from the individual credentials. See licensing_method.ps1.
$LicensingMethod = Get-UnityLicensingMethod
Write-Host "Licensing method: $(if ($LicensingMethod) { $LicensingMethod } else { '<none>' })"

# See build.ps1 for why UNITY_PATH (game-ci/cli#77), not Hub's default install location.
$LicensingClientPath = "$Env:UNITY_PATH\Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe"

# Same UNITY_LICENSE_RETRY_MAX_ATTEMPTS as build.ps1's matching retry - one
# knob covers every activation mode below since they're the same underlying
# flakiness.
$MaxAttempts = if ($Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS) { [int]$Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS } else { 4 }
$RetryDelaySeconds = 20
$TransientPattern = 'TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active'

if ($LicensingMethod -eq 'file') {
  #
  # LICENSE FILE MODE
  #
  # Formerly the only way to activate a PERSONAL license. It no longer is:
  # Unity restricted manual (offline) activation to Enterprise and Industry
  # seats, so a .ulf can't be obtained on a free account at all. Free-tier
  # users want the `personal` branch below. Kept working for the seats that
  # can still produce a .ulf, and for runners with an existing valid one.
  Write-Host "Requesting activation (license file)"

  $FilePath = Join-Path $Env:ACTIVATE_LICENSE_PATH 'UnityLicenseFile.ulf'
  if ($Env:UNITY_LICENSE) {
    ($Env:UNITY_LICENSE -replace "`r", '') | Set-Content -Path $FilePath -NoNewline
  } elseif ($Env:UNITY_LICENSE_FILE) {
    (Get-Content -Raw $Env:UNITY_LICENSE_FILE) -replace "`r", '' | Set-Content -Path $FilePath -NoNewline
  }

  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    # The exit code for personal activation is always 1 - success is
    # determined from the output instead (same as ubuntu's own personal-
    # license branch).
    $ActivationOutput = & "$Env:UNITY_PATH\Editor\Unity.exe" -batchmode -quit -nographics `
                                                                              -manualLicenseFile $FilePath `
                                                                              -projectPath $Env:ACTIVATE_LICENSE_PATH 2>&1 | Tee-Object -Variable ActivationOutputVar
    $ActivationOutput | Out-Host
    $ActivationText = ($ActivationOutputVar | Out-String)

    if ($ActivationText -match 'Next license update check is after') {
      $global:UNITY_EXIT_CODE = 0
      break
    }
    $global:UNITY_EXIT_CODE = 1

    if ($Attempt -lt $MaxAttempts -and $ActivationText -match $TransientPattern) {
      # Exponential backoff (20s, 40s, 80s, ...) - see mac/steps/activate.sh's
      # matching comment.
      $CurrentRetryDelay = $RetryDelaySeconds * [math]::Pow(2, $Attempt - 1)
      Write-Host "Unity activation failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${CurrentRetryDelay}s..."
      Start-Sleep -Seconds $CurrentRetryDelay
      continue
    }
    break
  }
  Remove-Item -Force -ErrorAction SilentlyContinue $FilePath
}
elseif ($LicensingMethod -eq 'floating') {
  #
  # Custom Unity License Server
  #
  Write-Host "Adding licensing server config"

  & $LicensingClientPath --acquire-floating | Out-File -FilePath license.txt -Encoding UTF8 # Note: using Out-File instead of redirection

  $PARSEDFILE = Select-String -Path license.txt -Pattern '\".*?\"' | ForEach-Object { $_.Matches.Value -replace '"' }
  $global:FLOATING_LICENSE = $($PARSEDFILE[1])
  $global:FLOATING_LICENSE_TIMEOUT = $($PARSEDFILE[3])

  Write-Host "Acquired floating license: `"$FLOATING_LICENSE`" with timeout $FLOATING_LICENSE_TIMEOUT"
  # Store the exit code from the verify command
  $global:UNITY_EXIT_CODE = $LASTEXITCODE
}
elseif ($LicensingMethod -eq 'personal') {
  #
  # PERSONAL (FREE) LICENSE MODE
  #
  # Acquires a Personal seat straight from Unity's licensing service using the
  # account credentials - the replacement for the .ulf route, which Unity
  # closed off for free seats. Note this is the *licensing client*, not the
  # editor: Unity.exe -serial -username -password is the serial path, which
  # Unity documents as not applying to Personal.
  #
  # The seat stays held until returned, unlike a .ulf. return_license.ps1 has
  # a matching branch and runsteps.ps1/entrypoint.ps1 run it from a finally
  # block, because a leaked Personal seat breaks every subsequent run on the
  # account rather than just this one.
  Write-Host "Requesting activation (personal license via Unity account)"

  # UNITY_PASSWORD is passed as an argument because the licensing client offers
  # no stdin or file-based alternative, so it is briefly visible in the
  # container's process list. Nothing here echoes it.
  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    $ActivationOutput = & $LicensingClientPath --activate-all --include-personal `
                                               --username $Env:UNITY_EMAIL `
                                               --password $Env:UNITY_PASSWORD 2>&1 | Tee-Object -Variable ActivationOutputVar
    $ActivationOutput | Out-Host
    $global:UNITY_EXIT_CODE = $LASTEXITCODE
    $ActivationText = ($ActivationOutputVar | Out-String)

    if ($global:UNITY_EXIT_CODE -eq 0) { break }

    if ($Attempt -lt $MaxAttempts -and $ActivationText -match $TransientPattern) {
      # Exponential backoff (20s, 40s, 80s, ...) - see mac/steps/activate.sh's
      # matching comment.
      $CurrentRetryDelay = $RetryDelaySeconds * [math]::Pow(2, $Attempt - 1)
      Write-Host "Personal activation failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${CurrentRetryDelay}s..."
      Start-Sleep -Seconds $CurrentRetryDelay
      continue
    }
    break
  }

  # Seat exhaustion and 2FA both surface as a generic non-zero exit but need
  # completely different fixes - say which one it was.
  if ($global:UNITY_EXIT_CODE -ne 0) {
    Write-PersonalActivationFailureHelp -LogText $ActivationText | Out-Null
  }
}
elseif ($LicensingMethod -eq 'serial') {
  # -logfile needs a real path - without one, Unity has nowhere to write
  # and exits immediately with "Unable to open log file, exiting." (compounded
  # by $ACTIVATE_LICENSE_PATH being wrong before the fix above). Also: this
  # branch never captured $LASTEXITCODE at all, so $global:UNITY_EXIT_CODE
  # silently kept whatever value it already had (uninitialized/stale) rather
  # than reflecting whether activation actually succeeded.
  $LogPath = Join-Path $Env:ACTIVATE_LICENSE_PATH 'activate.log'

  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    & "$Env:UNITY_PATH\Editor\Unity.exe" -batchmode -quit -nographics `
                                                                              -username $Env:UNITY_EMAIL `
                                                                              -password $Env:UNITY_PASSWORD `
                                                                              -serial $Env:UNITY_SERIAL `
                                                                              -logfile $LogPath | Out-Host
    $global:UNITY_EXIT_CODE = $LASTEXITCODE
    $LogContent = if (Test-Path $LogPath) { Get-Content $LogPath -Raw } else { '' }
    if ($LogContent) { Get-Content $LogPath | Out-Host }

    if ($global:UNITY_EXIT_CODE -eq 0) { break }

    if ($Attempt -lt $MaxAttempts -and $LogContent -match $TransientPattern) {
      # Exponential backoff (20s, 40s, 80s, ...) - see mac/steps/activate.sh's
      # matching comment.
      $CurrentRetryDelay = $RetryDelaySeconds * [math]::Pow(2, $Attempt - 1)
      Write-Host "Unity activation failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${CurrentRetryDelay}s..."
      Start-Sleep -Seconds $CurrentRetryDelay
      continue
    }

    break
  }
}
else {
  #
  # NO LICENSE ACTIVATION STRATEGY MATCHED
  #
  # Previously the serial branch was the catch-all `else`, so a run with no
  # credentials at all silently attempted activation with empty ones and
  # failed with Unity's generic licensing errors instead of saying what was
  # missing. Now every strategy is explicit and this is the real fallthrough.
  Write-Host 'License activation strategy could not be determined.'
  Write-Host ''
  Write-Host 'Set one of the following:'
  Write-Host '  * UNITY_EMAIL + UNITY_PASSWORD                 - Personal (free) seat'
  Write-Host '  * UNITY_EMAIL + UNITY_PASSWORD + UNITY_SERIAL  - Pro/Plus seat'
  Write-Host '  * UNITY_LICENSE or UNITY_LICENSE_FILE          - a .ulf (Enterprise/Industry)'
  Write-Host '  * UNITY_LICENSING_SERVER                       - floating license server'
  Write-Host ''
  Write-Host 'Visit https://game.ci/docs/github/getting-started for more'
  Write-Host 'details on how to set up one of the possible activation strategies.'

  Pop-Location
  exit 1
}

#
# Display information about the result
#
if ($global:UNITY_EXIT_CODE -eq 0) {
  # Activation was a success
  Write-Host "Activation complete."
}
else {
  # Activation failed so exit with the code from the license verification step
  Write-Host "Unclassified error occured while trying to activate license."
  Write-Host "Exit code was: $($global:UNITY_EXIT_CODE)"
  exit $global:UNITY_EXIT_CODE
}

Pop-Location
