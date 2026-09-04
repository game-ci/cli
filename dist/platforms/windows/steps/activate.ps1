# Native Windows host-mode equivalent of ../../ubuntu/steps/activate.sh -
# see runsteps.ps1's doc comment. Same four activation strategies, checked
# in the same order, with the same success/failure detection logic (Unity's
# own stdout/log text doesn't differ by platform, so the strings matched
# below are identical to the bash version).
$StepsDir = if ($Env:STEPS_DIR) { $Env:STEPS_DIR } else { $PSScriptRoot }
. (Join-Path $StepsDir 'resolve_unity_path.ps1')
. (Join-Path $StepsDir 'licensing_method.ps1')

Write-Host "Changing to `"$Env:ACTIVATE_LICENSE_PATH`" directory."
Push-Location $Env:ACTIVATE_LICENSE_PATH

# Which strategy to activate with. Normally resolved by the CLI and passed in
# as UNITY_LICENSING_METHOD; Get-UnityLicensingMethod falls back to deriving it
# from the individual credentials. See licensing_method.ps1.
$LicensingMethod = Get-UnityLicensingMethod
Write-Host "Licensing method: $(if ($LicensingMethod) { $LicensingMethod } else { '<none>' })"

$global:UNITY_EXIT_CODE = 1

# Same known-transient Unity license-server flakiness as mac/ubuntu (see
# mac/steps/build.sh's matching comment) - this file had NO retry logic at
# all before now, unlike every other activate/return script this session
# (confirmed missing via game-ci/unity-test-runner#310's Windows Docker
# matrix). Retried only on known-transient signatures, so a genuine
# activation failure (bad serial, expired license, etc.) still fails
# immediately.
$MaxAttempts = if ($Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS) { [int]$Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS } else { 4 }
$RetryDelaySeconds = 20
$TransientPattern = 'TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active'

try {
  $UnityExePath = Get-UnityEditorExePath

  if ($LicensingMethod -eq 'file') {
    #
    # LICENSE FILE MODE
    #
    # Formerly the only way to activate a PERSONAL license. It no longer is:
    # Unity restricted manual (offline) activation to Enterprise and Industry
    # seats, so a .ulf can't be obtained on a free account at all. Free-tier
    # users want the `personal` branch below. Kept working for the seats that
    # can still produce a .ulf, and for runners with an existing valid one.
    #
    Write-Host 'Requesting activation (license file)'

    $FilePath = 'UnityLicenseFile.ulf'
    $LogPath = Join-Path $Env:ACTIVATE_LICENSE_PATH 'activate.log'

    if ($Env:UNITY_LICENSE) {
      ($Env:UNITY_LICENSE -replace "`r", '') | Set-Content -Path $FilePath -NoNewline
    } elseif ($Env:UNITY_LICENSE_FILE) {
      ((Get-Content -Raw $Env:UNITY_LICENSE_FILE) -replace "`r", '') | Set-Content -Path $FilePath -NoNewline
    }

    for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
      Invoke-UnityLaunch -ExePath $UnityExePath -logFile $LogPath -quit -manualLicenseFile $FilePath | Out-Host
      $global:UNITY_EXIT_CODE = $LASTEXITCODE

      # The exit code for personal activation is always 1; determine whether
      # activation was successful from the log instead. Successful output
      # should include a line like:
      #   "LICENSE SYSTEM [2020120 18:51:20] Next license update check is after 2019-11-25T18:23:38"
      $LogContent = if (Test-Path $LogPath) { Get-Content -Raw $LogPath } else { '' }
      if ($LogContent -match 'Next license update check is after') {
        $global:UNITY_EXIT_CODE = 0
        break
      }

      if ($Attempt -lt $MaxAttempts -and $LogContent -match $TransientPattern) {
        # Exponential backoff - see mac/steps/activate.sh's matching comment.
        $CurrentRetryDelay = $RetryDelaySeconds * [math]::Pow(2, $Attempt - 1)
        Write-Host "Unity activation failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${CurrentRetryDelay}s..."
        Start-Sleep -Seconds $CurrentRetryDelay
        continue
      }
      break
    }

    Remove-Item -Force $FilePath -ErrorAction SilentlyContinue
  } elseif ($LicensingMethod -eq 'serial') {
    #
    # PROFESSIONAL (SERIAL) LICENSE MODE
    #
    Write-Host 'Requesting activation (professional license)'

    $LogPath = Join-Path $Env:ACTIVATE_LICENSE_PATH 'activate.log'

    for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
      Invoke-UnityLaunch -ExePath $UnityExePath -logFile $LogPath -quit -serial $Env:UNITY_SERIAL -username $Env:UNITY_EMAIL -password $Env:UNITY_PASSWORD | Out-Host
      $global:UNITY_EXIT_CODE = $LASTEXITCODE
      $LogContent = if (Test-Path $LogPath) { Get-Content -Raw $LogPath } else { '' }
      if ($LogContent) { Get-Content $LogPath | Out-Host }

      if ($global:UNITY_EXIT_CODE -eq 0) { break }

      if ($Attempt -lt $MaxAttempts -and $LogContent -match $TransientPattern) {
        # Exponential backoff - see mac/steps/activate.sh's matching comment.
        $CurrentRetryDelay = $RetryDelaySeconds * [math]::Pow(2, $Attempt - 1)
        Write-Host "Unity activation failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${CurrentRetryDelay}s..."
        Start-Sleep -Seconds $CurrentRetryDelay
        continue
      }
      break
    }
  } elseif ($LicensingMethod -eq 'floating') {
    #
    # Custom Unity License Server
    #
    Write-Host 'Adding licensing server config'

    $LicensingClientPath = Get-UnityLicensingClientExePath
    $LicenseTextPath = Join-Path $Env:ACTIVATE_LICENSE_PATH 'license.txt'

    for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
      $AcquireOutput = & $LicensingClientPath --acquire-floating 2>&1 | Tee-Object -Variable AcquireOutputVar
      $AcquireOutput | Out-File -FilePath $LicenseTextPath -Encoding UTF8
      $global:UNITY_EXIT_CODE = $LASTEXITCODE
      $AcquireText = ($AcquireOutputVar | Out-String)

      if ($global:UNITY_EXIT_CODE -eq 0) { break }

      if ($Attempt -lt $MaxAttempts -and $AcquireText -match $TransientPattern) {
        # Exponential backoff - see mac/steps/activate.sh's matching comment.
        $CurrentRetryDelay = $RetryDelaySeconds * [math]::Pow(2, $Attempt - 1)
        Write-Host "Floating license acquisition failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${CurrentRetryDelay}s..."
        Start-Sleep -Seconds $CurrentRetryDelay
        continue
      }
      break
    }

    $ParsedFile = Select-String -Path $LicenseTextPath -Pattern '"[^"]*"' -AllMatches |
      ForEach-Object { $_.Matches } | ForEach-Object { $_.Value -replace '"', '' }
    $global:FLOATING_LICENSE = $ParsedFile[1]
    $global:FLOATING_LICENSE_TIMEOUT = $ParsedFile[3]

    Write-Host "Acquired floating license: `"$($global:FLOATING_LICENSE)`" with timeout $($global:FLOATING_LICENSE_TIMEOUT)"
  } elseif ($LicensingMethod -eq 'personal') {
    #
    # PERSONAL (FREE) LICENSE MODE
    #
    # Acquires a Personal seat straight from Unity's licensing service using
    # the account credentials - the replacement for the .ulf route, which
    # Unity closed off for free seats. Note this is the *licensing client*,
    # not the editor: Unity.exe -serial -username -password is the serial
    # path, which Unity documents as not applying to Personal.
    #
    # The seat stays held until returned, unlike a .ulf. return_license.ps1
    # has a matching branch and runsteps.ps1 runs it from a finally block,
    # because a leaked Personal seat breaks every subsequent run on the
    # account rather than just this one.
    #
    Write-Host 'Requesting activation (personal license via Unity account)'

    $LicensingClientPath = Get-UnityLicensingClientExePath

    # UNITY_PASSWORD is passed as an argument because the licensing client
    # offers no stdin or file-based alternative, so it is briefly visible in
    # the host's process list. Nothing here echoes it.
    for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
      $ActivateOutput = & $LicensingClientPath --activate-all --include-personal `
                                               --username $Env:UNITY_EMAIL `
                                               --password $Env:UNITY_PASSWORD 2>&1 | Tee-Object -Variable ActivateOutputVar
      $ActivateOutput | Out-Host
      $global:UNITY_EXIT_CODE = $LASTEXITCODE
      $ActivateText = ($ActivateOutputVar | Out-String)

      if ($global:UNITY_EXIT_CODE -eq 0) { break }

      if ($Attempt -lt $MaxAttempts -and $ActivateText -match $TransientPattern) {
        # Exponential backoff - see mac/steps/activate.sh's matching comment.
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
      Write-PersonalActivationFailureHelp -LogText $ActivateText | Out-Null
    }
  } else {
    #
    # NO LICENSE ACTIVATION STRATEGY MATCHED
    #
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
} catch {
  Write-Host "Unity Editor could not be run: $($_.Exception.Message)"
  $global:UNITY_EXIT_CODE = 1
}

#
# Display information about the result
#
if ($global:UNITY_EXIT_CODE -eq 0) {
  Write-Host 'Activation complete.'
} else {
  Write-Host 'Unclassified error occured while trying to activate license.'
  Write-Host "Exit code was: $($global:UNITY_EXIT_CODE)"
  Pop-Location
  exit $global:UNITY_EXIT_CODE
}

Pop-Location
