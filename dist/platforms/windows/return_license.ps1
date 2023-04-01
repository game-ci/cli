# Return the active Unity license
Write-Host "Changing to `"$ACTIVATE_LICENSE_PATH`" directory."
Push-Location $ACTIVATE_LICENSE_PATH

if ($env:UNITY_LICENSING_SERVER) {
  #
  # Return any floating license used.
  #
  Write-Host "Returning floating license: `"$($global:FLOATING_LICENSE)`""
  & 'C:\Program Files\Unity\Hub\Editor\$Env:UNITY_VERSION\Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe' --return-floating $global:FLOATING_LICENSE
}
else {
  & "C:\Program Files\Unity\Hub\Editor\$Env:UNITY_VERSION\Editor\Unity.exe" -batchmode -quit -nographics `
                                                                            -username $Env:UNITY_EMAIL `
                                                                            -password $Env:UNITY_PASSWORD `
                                                                            -returnlicense `
                                                                            -logfile | Out-Host
}

Pop-Location