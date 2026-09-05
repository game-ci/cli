# Native Windows host-mode equivalent of ../../ubuntu/steps/return_license.sh -
# see runsteps.ps1's doc comment.
$StepsDir = if ($Env:STEPS_DIR) { $Env:STEPS_DIR } else { $PSScriptRoot }
. (Join-Path $StepsDir 'resolve_unity_path.ps1')
. (Join-Path $StepsDir 'licensing_method.ps1')

Write-Host "Changing to `"$Env:ACTIVATE_LICENSE_PATH`" directory."
Push-Location $Env:ACTIVATE_LICENSE_PATH

# Which license to hand back. Not simply activate.ps1's strategy - the original
# conditions here keyed off the raw env vars, and are preserved so that no
# return which used to happen stops happening. See licensing_method.ps1.
$ReturnStrategy = Get-UnityLicenseReturnStrategy

# A failed license *return* is worse than a failed activate/build: it leaks
# the seat back to Unity's license pool - see mac/steps/return_license.sh's
# matching comment. This branch never checked its exit code and never
# retried before now (confirmed live via game-ci/unity-test-runner#310's
# Windows Docker matrix: "Serial number unavailable for ULF return" /
# "Connection attempt to the License Client ... failed" on the very first
# attempt, with no retry and -returnlicense missing -username/-password -
# both required for a SERIAL-mode return, same as
# mac/steps/return_license.sh and the host-mode windows/return_license.ps1
# already pass).
$MaxAttempts = if ($Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS) { [int]$Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS } else { 4 }
$RetryDelaySeconds = 20
$TransientPattern = 'TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active|Serial number unavailable'

try {
  if ($ReturnStrategy -eq 'floating') {
    #
    # Return any floating license used.
    #
    Write-Host "Returning floating license: `"$($global:FLOATING_LICENSE)`""
    $LicensingClientPath = Get-UnityLicensingClientExePath

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
  } elseif ($ReturnStrategy -eq 'personal') {
    #
    # PERSONAL (FREE) LICENSE MODE
    #
    # Releases the Personal seat acquired by activate.ps1's matching branch.
    # This branch did not exist before Unity moved Personal onto seats: a .ulf
    # was a file, so there was nothing to give back, which is also why the
    # `file` strategy still has no return step. Hold a Personal seat and every
    # later run on the account fails with "no available seats".
    #
    Write-Host 'Returning personal license seat'

    $LicensingClientPath = Get-UnityLicensingClientExePath

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
  } elseif ($ReturnStrategy -eq 'serial') {
    #
    # PROFESSIONAL (SERIAL) LICENSE MODE
    #
    # -projectPath points at the scratch activation directory, not the
    # built project, so Unity doesn't reopen the real project (and
    # reimport its library against whatever the editor's default target
    # is) just to return the license (game-ci/cli#33).
    #
    # -username/-password are required here - without them Unity has no
    # way to tell this was a serial-mode activation and instead attempts a
    # personal-license (ULF) return, which fails immediately with "Serial
    # number unavailable for ULF return".
    #
    $UnityExePath = Get-UnityEditorExePath
    $LogPath = Join-Path $Env:ACTIVATE_LICENSE_PATH 'return_license.log'

    for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
      Invoke-UnityLaunch -ExePath $UnityExePath -logFile $LogPath -quit -returnlicense -username $Env:UNITY_EMAIL -password $Env:UNITY_PASSWORD -projectPath $Env:ACTIVATE_LICENSE_PATH | Out-Host
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
} catch {
  Write-Host "Could not return license: $($_.Exception.Message)"
}

Pop-Location
