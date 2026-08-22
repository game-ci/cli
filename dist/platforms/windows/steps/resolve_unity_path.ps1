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

# Invokes the Unity Editor executable, transparently prefixing the
# invocation with $Env:ENGINE_LAUNCH_WRAPPER when it is set (e.g. a
# self-hosted runner's own launch-serialization lock). When unset, this is
# byte-identical to calling `& $ExePath @Arguments` directly - no wrapper
# process is introduced. $Arguments is passed through unmodified via
# splatting so each call site's exact existing argument list (flags, quit
# args, custom-parameter arrays, etc.) is preserved unchanged.
#
# ENGINE_LAUNCH_WRAPPER may itself be a multi-word command (e.g.
# "flock /tmp/unity.lock --"), matching the Linux side's unquoted
# $ENGINE_LAUNCH_WRAPPER, which bash word-splits. PowerShell's `&` call
# operator does not split a single string argument the same way - passing
# the whole value as one token would make it look for a single (nonexistent)
# executable literally named "flock /tmp/unity.lock --" - so it's split into
# tokens here first, the same way this script set already splits
# CUSTOM_PARAMETERS elsewhere (build.ps1/test.ps1).
function Invoke-UnityLaunch {
  param(
    [Parameter(Mandatory)]
    [string]$ExePath,
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$Arguments
  )

  if ($Env:ENGINE_LAUNCH_WRAPPER) {
    $WrapperParts = @($Env:ENGINE_LAUNCH_WRAPPER -split '\s+' | Where-Object { $_ -ne '' })
    $WrapperExe = $WrapperParts[0]
    $WrapperArgs = if ($WrapperParts.Length -gt 1) { $WrapperParts[1..($WrapperParts.Length - 1)] } else { @() }
    & $WrapperExe @WrapperArgs $ExePath @Arguments
  } else {
    & $ExePath @Arguments
  }
}

function Get-UnityLicensingClientExePath {
  $root = Get-UnityEditorRoot
  $exePath = Join-Path $root 'Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe'

  if (-not (Test-Path $exePath)) {
    throw "Unity Licensing Client not found at `"$exePath`"."
  }

  return $exePath
}
