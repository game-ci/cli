# Resolves the Unity Editor install location for a native (non-Docker,
# non-Hub-container) Windows host, for HostRunner's steps scripts.
#
# Unlike dist/platforms/windows/*.ps1 (the Docker-container script set,
# where UNITY_PATH is a fixed, image-baked value pointing at
# C:/UnityEditor/<version> - see build.ps1's own comment there, and
# game-ci/cli#77), a self-hosted machine has Unity installed by a human (or
# automation) via Unity Hub, so the version-specific install directory has
# to be resolved dynamically instead of assumed. Mirrors
# src/logic/unity/platform-setup/setup-mac.ts's own hardcoded
# `/Applications/Unity/Hub/Editor/$version` for the same reason on macOS -
# there is no existing "find the Unity executable on Windows" helper in
# src/ to reuse (UnityCliAdapter shells out to Unity Technologies' separate
# `unity` CLI tool, which is unrelated and doesn't resolve an Editor path
# either).
#
# $Env:UNITY_PATH, if set, overrides the Hub default entirely and is used
# as-is (the directory containing Editor\Unity.exe) - lets a runner operator
# point at a non-default install location without code changes.
function Get-UnityEditorRoot {
  if ($Env:UNITY_PATH) {
    return $Env:UNITY_PATH
  }

  if (-not $Env:UNITY_VERSION) {
    throw 'UNITY_VERSION is not set and UNITY_PATH was not provided - cannot locate the Unity Editor install.'
  }

  return "C:\Program Files\Unity\Hub\Editor\$Env:UNITY_VERSION"
}

function Get-UnityEditorExePath {
  $root = Get-UnityEditorRoot
  $exePath = Join-Path $root 'Editor\Unity.exe'

  if (-not (Test-Path $exePath)) {
    throw (
      "Unity Editor not found at `"$exePath`". Install Unity $Env:UNITY_VERSION via Unity Hub " +
      '(the default self-hosted-runner install location is used automatically), or set the ' +
      'UNITY_PATH environment variable to the Editor root directory (the one containing Editor\Unity.exe) ' +
      'if Unity is installed somewhere else.'
    )
  }

  return $exePath
}

function Get-UnityLicensingClientExePath {
  $root = Get-UnityEditorRoot
  $exePath = Join-Path $root 'Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe'

  if (-not (Test-Path $exePath)) {
    throw "Unity Licensing Client not found at `"$exePath`"."
  }

  return $exePath
}
