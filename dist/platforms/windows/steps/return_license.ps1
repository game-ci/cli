# Native Windows host-mode equivalent of ../../ubuntu/steps/return_license.sh -
# see runsteps.ps1's doc comment.
$StepsDir = if ($Env:STEPS_DIR) { $Env:STEPS_DIR } else { $PSScriptRoot }
. (Join-Path $StepsDir 'resolve_unity_path.ps1')

Write-Host "Changing to `"$Env:ACTIVATE_LICENSE_PATH`" directory."
Push-Location $Env:ACTIVATE_LICENSE_PATH

try {
  if ($Env:UNITY_LICENSING_SERVER) {
    #
    # Return any floating license used.
    #
    Write-Host "Returning floating license: `"$($global:FLOATING_LICENSE)`""
    $LicensingClientPath = Get-UnityLicensingClientExePath
    & $LicensingClientPath --return-floating $global:FLOATING_LICENSE
  } elseif ($Env:UNITY_SERIAL) {
    #
    # PROFESSIONAL (SERIAL) LICENSE MODE
    #
    # -projectPath points at the scratch activation directory, not the
    # built project, so Unity doesn't reopen the real project (and
    # reimport its library against whatever the editor's default target
    # is) just to return the license (game-ci/cli#33).
    #
    $UnityExePath = Get-UnityEditorExePath
    $LogPath = Join-Path $Env:ACTIVATE_LICENSE_PATH 'return_license.log'
    & $UnityExePath -logFile $LogPath -quit -returnlicense -projectPath $Env:ACTIVATE_LICENSE_PATH | Out-Host
    if (Test-Path $LogPath) { Get-Content $LogPath | Out-Host }
  }
} catch {
  Write-Host "Could not return license: $($_.Exception.Message)"
}

Pop-Location
