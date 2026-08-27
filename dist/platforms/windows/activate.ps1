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
Write-Host "Changing to `"$Env:ACTIVATE_LICENSE_PATH`" directory."
Push-Location $Env:ACTIVATE_LICENSE_PATH

# Same UNITY_LICENSE_RETRY_MAX_ATTEMPTS as build.ps1's matching retry - one
# knob covers every activation mode below since they're the same underlying
# flakiness.
$MaxAttempts = if ($Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS) { [int]$Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS } else { 4 }
$RetryDelaySeconds = 20
$TransientPattern = 'TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active'

# Serial mode is preferred over personal-license (below) whenever both are
# configured - see mac/steps/activate.sh's matching comment: a manually-
# activated .ulf is bound to the machine fingerprint of whatever machine
# originally requested it, which real CI evidence shows genuinely doesn't
# match every runner (confirmed "Machine bindings don't match" on windows
# specifically, with the identical .ulf activating cleanly elsewhere).
# Serial credentials have no such constraint, so given a choice, prefer them.
$HasSerialCredentials = $Env:UNITY_SERIAL -and $Env:UNITY_EMAIL -and $Env:UNITY_PASSWORD

if ((-not $HasSerialCredentials) -and ($Env:UNITY_LICENSE -or $Env:UNITY_LICENSE_FILE)) {
  #
  # PERSONAL LICENSE MODE
  #
  # windows never had this branch at all - only ubuntu/steps/activate.sh
  # did. A repo whose only configured credential is UNITY_LICENSE (no
  # UNITY_SERIAL/EMAIL/PASSWORD - exactly game-ci/unity-test-runner's actual
  # repo secrets) had no way to activate on windows at all: activation
  # always fell through to serial mode with empty credentials, producing
  # the same "License is not active"/"0 entitlement groups" symptoms as
  # genuine license-server flakiness, but persistent and 100% reproducible
  # rather than transient - no amount of retrying a fundamentally missing
  # credential ever helps.
  Write-Host "Requesting activation (personal license)"

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
      Write-Host "Unity activation failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${RetryDelaySeconds}s..."
      Start-Sleep -Seconds $RetryDelaySeconds
      continue
    }
    break
  }
  Remove-Item -Force -ErrorAction SilentlyContinue $FilePath
}
elseif ($env:UNITY_LICENSING_SERVER) {
  #
  # Custom Unity License Server
  #
  Write-Host "Adding licensing server config"

  # See build.ps1 for why UNITY_PATH (game-ci/cli#77), not Hub's default install location.
  & "$Env:UNITY_PATH\Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe" --acquire-floating | Out-File -FilePath license.txt -Encoding UTF8 # Note: using Out-File instead of redirection

  $PARSEDFILE = Select-String -Path license.txt -Pattern '\".*?\"' | ForEach-Object { $_.Matches.Value -replace '"' }
  $global:FLOATING_LICENSE = $($PARSEDFILE[1])
  $global:FLOATING_LICENSE_TIMEOUT = $($PARSEDFILE[3])

  Write-Host "Acquired floating license: `"$FLOATING_LICENSE`" with timeout $FLOATING_LICENSE_TIMEOUT"
  # Store the exit code from the verify command
  $global:UNITY_EXIT_CODE = $LASTEXITCODE
}
else {
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
      Write-Host "Unity activation failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${RetryDelaySeconds}s..."
      Start-Sleep -Seconds $RetryDelaySeconds
      continue
    }

    break
  }
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
