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

# Permanent by construction: the entitlement is bound to the machine that
# activated it, so no retry rebinds it. Checked separately because the same
# failing return also emits "Access token is unavailable", which IS in the
# transient list above - see ubuntu/steps/return_license.sh.
$PermanentPattern = "Machine bindings don't match"

# Not a failure to retry, and usually not a failure at all: it means there is
# no Unity_lic.ulf to hand back, because the seat this run holds is an
# entitlement rather than a file. See the personal branch below.
$NoUlfPattern = 'Ulf license file not found'

# Unity returns the licence and THEN exits non-zero - the seat really is
# returned, but the exit code says failure and the log carries "Access token is
# unavailable", which is in the transient list above. See the matching comment
# in ubuntu/steps/return_license.sh for the measurement.
$SuccessPattern = 'Successfully returned ULF license|Successfully returned floating license|License has been returned'

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

    if ($ReturnText -match $SuccessPattern) { $ReturnExitCode = 0; break }
    if ($ReturnExitCode -eq 0) { break }

    if ($ReturnText -match $PermanentPattern) { break }
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
    Write-Host "##[warning] Failed to return floating license `"$($global:FLOATING_LICENSE)`" after $Attempt attempt(s) - this seat may still be held by Unity's license server."
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

  # The return has to use the same route the activation used, and it picks it
  # the same way - by asking the bundled licensing client what it can do - so
  # the two stay in step by construction rather than by a flag one side has to
  # remember to set. activate.ps1 falls back to the editor when the client
  # predates --include-personal, and that route takes an *entitlement* seat
  # with no Unity_lic.ulf behind it, which --return-ulf can only answer with
  # "Ulf license file not found ... (1404)". See ubuntu/steps/return_license.sh
  # for the measured 2020.3.49f1 case.
  #
  # Probed inline rather than dot-sourced: this container script deliberately
  # stands alone (it resolves $LicensingClientPath itself, above).
  $ReturnViaEditor = -not ((& $LicensingClientPath --help 2>&1 | Out-String) -match '--include-personal')
  $PersonalReturnLogPath = Join-Path $Env:ACTIVATE_LICENSE_PATH 'return_license.log'

  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    if ($ReturnViaEditor) {
      & "$Env:UNITY_PATH\Editor\Unity.exe" -batchmode -quit -nographics `
                                            -username $Env:UNITY_EMAIL `
                                            -password $Env:UNITY_PASSWORD `
                                            -returnlicense `
                                            -projectPath $Env:ACTIVATE_LICENSE_PATH `
                                            -logfile $PersonalReturnLogPath | Out-Host
      $ReturnExitCode = $LASTEXITCODE
      $ReturnText = if (Test-Path $PersonalReturnLogPath) { Get-Content $PersonalReturnLogPath -Raw } else { '' }
      if ($ReturnText) { Write-Host $ReturnText }
    } else {
      $ReturnOutput = & $LicensingClientPath --return-ulf 2>&1 | Tee-Object -Variable ReturnOutputVar
      $ReturnOutput | Out-Host
      $ReturnExitCode = $LASTEXITCODE
      $ReturnText = ($ReturnOutputVar | Out-String)
    }

    if ($ReturnText -match $SuccessPattern) { $ReturnExitCode = 0; break }
    if ($ReturnExitCode -eq 0) { break }

    # The capability probe says which route activate.ps1 *would* take, not
    # which one it did. When the client route meets an entitlement seat it says
    # so plainly, so switch to the route that can hand it back rather than warn
    # about a seat no correct command was ever run against.
    if (-not $ReturnViaEditor -and $ReturnText -match $NoUlfPattern) {
      Write-Host 'No ULF license file to return - this seat is entitlement-based; returning it through the editor instead.'
      $ReturnViaEditor = $true
      continue
    }

    # Nothing to hand back on the editor route either: no seat is being held,
    # so this is not the leak the warning below describes.
    if ($ReturnText -match $NoUlfPattern) {
      Write-Host 'No Personal license seat was held - nothing to return.'
      $ReturnExitCode = 0
      break
    }

    if ($ReturnText -match $PermanentPattern) { break }
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
    Write-Host "##[warning] Failed to return the Personal license seat after $Attempt attempt(s)."
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

    if ($LogContent -match $SuccessPattern) { $ReturnExitCode = 0; break }
    if ($ReturnExitCode -eq 0) { break }

    if ($LogContent -match $PermanentPattern) { break }
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
    if ($LogContent -match $PermanentPattern) {
        Write-Host "##[warning] Could not return the Unity license: it is bound to a different machine than the one returning it."
        Write-Host "##[warning] This is expected when activation and return happen on different machines or containers."
        Write-Host "##[warning] If activations later run out, release them at https://id.unity.com."
      } else {
        Write-Host "##[warning] Failed to return the Unity license after $Attempt attempt(s) - this seat may still be held by Unity's license server."
      }
  }
}

Pop-Location