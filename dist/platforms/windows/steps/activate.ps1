# Native Windows host-mode equivalent of ../../ubuntu/steps/activate.sh -
# see runsteps.ps1's doc comment. Same three activation strategies, checked
# in the same order, with the same success/failure detection logic (Unity's
# own stdout/log text doesn't differ by platform, so the strings matched
# below are identical to the bash version).
$StepsDir = if ($Env:STEPS_DIR) { $Env:STEPS_DIR } else { $PSScriptRoot }
. (Join-Path $StepsDir 'resolve_unity_path.ps1')

Write-Host "Changing to `"$Env:ACTIVATE_LICENSE_PATH`" directory."
Push-Location $Env:ACTIVATE_LICENSE_PATH

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

  # Serial mode is preferred over personal-license (below) whenever both are
  # configured - see mac/steps/activate.sh's matching comment: a manually-
  # activated .ulf is bound to the machine fingerprint of whatever machine
  # originally requested it, which doesn't necessarily match every runner.
  $HasSerialCredentials = $Env:UNITY_SERIAL -and $Env:UNITY_EMAIL -and $Env:UNITY_PASSWORD

  if ((-not $HasSerialCredentials) -and ($Env:UNITY_LICENSE -or $Env:UNITY_LICENSE_FILE)) {
    #
    # PERSONAL LICENSE MODE
    #
    # This will activate Unity, using a license file. Note that this is the
    # ONLY WAY for PERSONAL LICENSES in 2020 - see
    # https://gitlab.com/gableroux/unity3d-gitlab-ci-example/issues/5#note_72815478
    #
    # The license file can be acquired using
    # `webbertakken/request-manual-activation-file` action.
    #
    Write-Host 'Requesting activation (personal license)'

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
  } elseif ($HasSerialCredentials) {
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
  } elseif ($Env:UNITY_LICENSING_SERVER) {
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
  } else {
    #
    # NO LICENSE ACTIVATION STRATEGY MATCHED
    #
    Write-Host 'License activation strategy could not be determined.'
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
