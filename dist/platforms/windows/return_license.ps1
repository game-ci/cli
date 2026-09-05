# Return the active Unity license
#
# $ACTIVATE_LICENSE_PATH (no $Env: prefix, here and at the -projectPath use
# below) is an unset local PowerShell variable, not the environment
# variable set by the caller - see activate.ps1 for the full explanation
# and the confirmed live failure this caused (game-ci/cli#844).
. (Join-Path $PSScriptRoot 'licensing_method.ps1')

Write-Host "Changing to `"$Env:ACTIVATE_LICENSE_PATH`" directory."
Push-Location $Env:ACTIVATE_LICENSE_PATH

# Which license to hand back. Not simply activate.ps1's strategy - the original
# conditions here keyed off the raw env vars, and are preserved so that no
# return which used to happen stops happening. See licensing_method.ps1.
$ReturnStrategy = Get-UnityLicenseReturnStrategy

# See build.ps1 for why UNITY_PATH (game-ci/cli#77), not Hub's default install location.
$LicensingClientPath = "$Env:UNITY_PATH\Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe"

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

if ($ReturnStrategy -eq 'floating') {
  #
  # Return any floating license used.
  #
  Write-Host "Returning floating license: `"$($global:FLOATING_LICENSE)`""
  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    $ReturnOutput = & $LicensingClientPath --return-floating $global:FLOATING_LICENSE 2>&1 | Tee-Object -Variable ReturnOutputVar
    $ReturnOutput | Out-Host
    $ReturnExitCode = $LASTEXITCODE
    $ReturnText = ($ReturnOutputVar | Out-String)

    if ($ReturnExitCode -eq 0) { break }

    if ($Attempt -lt $MaxAttempts -and $ReturnText -match $TransientPattern) {
      # Exponential backoff - see mac/steps/activate.sh's matching comment.
      $CurrentRetryDelay = $RetryDelaySeconds * [math]::Pow(2, $Attempt - 1)
      Write-Host "Floating license return failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${CurrentRetryDelay}s..."
      Start-Sleep -Seconds $CurrentRetryDelay
      continue
    }
    break
  }
  if ($ReturnExitCode -ne 0) {
    Write-Host "##[warning] Failed to return floating license `"$($global:FLOATING_LICENSE)`" after $MaxAttempts attempts - this seat may still be held by Unity's license server."
  }
}
elseif ($ReturnStrategy -eq 'personal') {
  #
  # PERSONAL (FREE) LICENSE MODE
  #
  # Releases the Personal seat acquired by activate.ps1's matching branch.
  # This branch did not exist before Unity moved Personal onto seats: a .ulf
  # was a file, so there was nothing to give back, which is also why the
  # `file` strategy still has no return step. Hold a Personal seat and every
  # later run on the account fails with "no available seats".
  Write-Host 'Returning personal license seat'

  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    $ReturnOutput = & $LicensingClientPath --return-ulf 2>&1 | Tee-Object -Variable ReturnOutputVar
    $ReturnOutput | Out-Host
    $ReturnExitCode = $LASTEXITCODE
    $ReturnText = ($ReturnOutputVar | Out-String)

    if ($ReturnExitCode -eq 0) { break }

    if ($Attempt -lt $MaxAttempts -and $ReturnText -match $TransientPattern) {
      # Exponential backoff - see mac/steps/activate.sh's matching comment.
      $CurrentRetryDelay = $RetryDelaySeconds * [math]::Pow(2, $Attempt - 1)
      Write-Host "Personal license return failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${CurrentRetryDelay}s..."
      Start-Sleep -Seconds $CurrentRetryDelay
      continue
    }
    break
  }
  if ($ReturnExitCode -ne 0) {
    Write-Host "##[warning] Failed to return the Personal license seat after $MaxAttempts attempts."
    Write-Host '##[warning] That seat is likely still held. Release it at https://id.unity.com or'
    Write-Host '##[warning] run ''game-ci return-license'', otherwise later runs on this account'
    Write-Host '##[warning] will fail with ''no available seats''.'
  }
}
elseif ($ReturnStrategy -eq 'serial') {
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
      # Exponential backoff - see mac/steps/activate.sh's matching comment.
      $CurrentRetryDelay = $RetryDelaySeconds * [math]::Pow(2, $Attempt - 1)
      Write-Host "License return failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${CurrentRetryDelay}s..."
      Start-Sleep -Seconds $CurrentRetryDelay
      continue
    }
    break
  }
  if ($ReturnExitCode -ne 0) {
    Write-Host "##[warning] Failed to return the Unity license after $MaxAttempts attempts - this seat may still be held by Unity's license server."
  }
}

Pop-Location