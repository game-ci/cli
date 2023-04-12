# Activates Unity
Write-Host "Changing to `"$ACTIVATE_LICENSE_PATH`" directory."
Push-Location $ACTIVATE_LICENSE_PATH

if ($env:UNITY_LICENSING_SERVER) {
  #
  # Custom Unity License Server
  #
  Write-Host "Adding licensing server config"

  & "C:\Program Files\Unity\Hub\Editor\$Env:UNITY_VERSION\Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe" --acquire-floating | Out-File -FilePath license.txt -Encoding UTF8 # Note: using Out-File instead of redirection

  $PARSEDFILE = Select-String -Path license.txt -Pattern '\".*?\"' | ForEach-Object { $_.Matches.Value -replace '"' }
  $global:FLOATING_LICENSE = $($PARSEDFILE[1])
  $global:FLOATING_LICENSE_TIMEOUT = $($PARSEDFILE[3])

  Write-Host "Acquired floating license: `"$FLOATING_LICENSE`" with timeout $FLOATING_LICENSE_TIMEOUT"
  # Store the exit code from the verify command
  $global:UNITY_EXIT_CODE = $LASTEXITCODE
}
else {
  & "C:\Program Files\Unity\Hub\Editor\$Env:UNITY_VERSION\Editor\Unity.exe" -batchmode -quit -nographics `
                                                                            -username $Env:UNITY_EMAIL `
                                                                            -password $Env:UNITY_PASSWORD `
                                                                            -serial $Env:UNITY_SERIAL `
                                                                            -logfile | Out-Host
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
