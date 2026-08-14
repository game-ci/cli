# Return the active Unity license
Write-Host "Changing to `"$ACTIVATE_LICENSE_PATH`" directory."
Push-Location $ACTIVATE_LICENSE_PATH

if ($env:UNITY_LICENSING_SERVER) {
  #
  # Return any floating license used.
  #
  Write-Host "Returning floating license: `"$($global:FLOATING_LICENSE)`""
  # Was single-quoted, so $Env:UNITY_VERSION was never interpolated at all
  # (literal text) on top of pointing at the wrong install location -
  # see build.ps1 for why UNITY_PATH (game-ci/cli#77).
  & "$Env:UNITY_PATH\Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe" --return-floating $global:FLOATING_LICENSE
}
else {
  # -projectPath points at the scratch activation directory, not the built
  # project, so Unity doesn't reopen the real project (and reimport its
  # library against whatever the editor's default target is) just to
  # return the license (game-ci/cli#33).
  & "$Env:UNITY_PATH\Editor\Unity.exe" -batchmode -quit -nographics `
                                                                            -username $Env:UNITY_EMAIL `
                                                                            -password $Env:UNITY_PASSWORD `
                                                                            -returnlicense `
                                                                            -projectPath $ACTIVATE_LICENSE_PATH `
                                                                            -logfile | Out-Host
}

Pop-Location