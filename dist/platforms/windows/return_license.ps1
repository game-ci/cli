# Return the active Unity license
#
# $ACTIVATE_LICENSE_PATH (no $Env: prefix, here and at the -projectPath use
# below) is an unset local PowerShell variable, not the environment
# variable set by the caller - see activate.ps1 for the full explanation
# and the confirmed live failure this caused (game-ci/cli#844).
Write-Host "Changing to `"$Env:ACTIVATE_LICENSE_PATH`" directory."
Push-Location $Env:ACTIVATE_LICENSE_PATH

# A failed license *return* is worse than a failed activate/build: it leaks
# the seat back to Unity's license pool. Every subsequent job (this run and
# every other one sharing the same account) then has one fewer seat/entitlement
# available, which surfaces as exactly the same "0 entitlement groups"/
# "License is not active" symptoms activate.ps1 and steps/test.ps1 already
# retry on - a cascading failure mode that gets worse the longer a busy CI
# account runs, not a one-off flake. Neither branch below ever checked its
# exit code before now, so a failed return was silent - this retries on the
# same known-transient signatures and, critically, logs loudly if every
# attempt is exhausted, since a genuinely leaked seat needs a human to know
# about it (nothing here can force Unity's server to release a seat it
# thinks is still in use).
$MaxAttempts = if ($Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS) { [int]$Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS } else { 4 }
$RetryDelaySeconds = 20
$TransientPattern = 'TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active|Serial number unavailable'

if ($env:UNITY_LICENSING_SERVER) {
  #
  # Return any floating license used.
  #
  Write-Host "Returning floating license: `"$($global:FLOATING_LICENSE)`""
  # Was single-quoted, so $Env:UNITY_VERSION was never interpolated at all
  # (literal text) on top of pointing at the wrong install location -
  # see build.ps1 for why UNITY_PATH (game-ci/cli#77).
  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    $ReturnOutput = & "$Env:UNITY_PATH\Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe" --return-floating $global:FLOATING_LICENSE 2>&1 | Tee-Object -Variable ReturnOutputVar
    $ReturnOutput | Out-Host
    $ReturnExitCode = $LASTEXITCODE
    $ReturnText = ($ReturnOutputVar | Out-String)

    if ($ReturnExitCode -eq 0) { break }

    if ($Attempt -lt $MaxAttempts -and $ReturnText -match $TransientPattern) {
      Write-Host "Floating license return failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${RetryDelaySeconds}s..."
      Start-Sleep -Seconds $RetryDelaySeconds
      continue
    }
    break
  }
  if ($ReturnExitCode -ne 0) {
    Write-Host "##[warning] Failed to return floating license `"$($global:FLOATING_LICENSE)`" after $MaxAttempts attempts - this seat may still be held by Unity's license server."
  }
}
else {
  # -projectPath points at the scratch activation directory, not the built
  # project, so Unity doesn't reopen the real project (and reimport its
  # library against whatever the editor's default target is) just to
  # return the license (game-ci/cli#33).
  # -logfile needs a real path, same reasoning as activate.ps1.
  $LogPath = Join-Path $Env:ACTIVATE_LICENSE_PATH 'return_license.log'

  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    & "$Env:UNITY_PATH\Editor\Unity.exe" -batchmode -quit -nographics `
                                                                              -username $Env:UNITY_EMAIL `
                                                                              -password $Env:UNITY_PASSWORD `
                                                                              -returnlicense `
                                                                              -projectPath $Env:ACTIVATE_LICENSE_PATH `
                                                                              -logfile $LogPath | Out-Host
    $ReturnExitCode = $LASTEXITCODE
    $LogContent = if (Test-Path $LogPath) { Get-Content $LogPath -Raw } else { '' }
    if ($LogContent) { Get-Content $LogPath | Out-Host }

    if ($ReturnExitCode -eq 0) { break }

    if ($Attempt -lt $MaxAttempts -and $LogContent -match $TransientPattern) {
      Write-Host "License return failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${RetryDelaySeconds}s..."
      Start-Sleep -Seconds $RetryDelaySeconds
      continue
    }
    break
  }
  if ($ReturnExitCode -ne 0) {
    Write-Host "##[warning] Failed to return the Unity license after $MaxAttempts attempts - this seat may still be held by Unity's license server."
  }
}

Pop-Location