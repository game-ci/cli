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

if ($env:UNITY_LICENSING_SERVER) {
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
  & "$Env:UNITY_PATH\Editor\Unity.exe" -batchmode -quit -nographics `
                                                                            -username $Env:UNITY_EMAIL `
                                                                            -password $Env:UNITY_PASSWORD `
                                                                            -serial $Env:UNITY_SERIAL `
                                                                            -logfile $LogPath | Out-Host
  $global:UNITY_EXIT_CODE = $LASTEXITCODE
  if (Test-Path $LogPath) { Get-Content $LogPath | Out-Host }
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
