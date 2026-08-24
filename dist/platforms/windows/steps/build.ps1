# Native Windows host-mode equivalent of ../../ubuntu/steps/build.sh - see
# runsteps.ps1's doc comment. chown/chmod calls from the Linux version are
# dropped entirely (no Windows equivalent, and were only ever meaningful
# for a container's root-owned files in the first place).
$StepsDir = if ($Env:STEPS_DIR) { $Env:STEPS_DIR } else { $PSScriptRoot }
. (Join-Path $StepsDir 'resolve_unity_path.ps1')

#
# Set project path
#
$Env:UNITY_PROJECT_PATH = Join-Path $Env:GITHUB_WORKSPACE $Env:PROJECT_PATH
Write-Host "Using project path `"$($Env:UNITY_PROJECT_PATH)`"."

Write-Host "Using build name `"$($Env:BUILD_NAME)`"."
Write-Host "Using build target `"$($Env:BUILD_TARGET)`"."

if (-not $Env:BUILD_PROFILE) {
  Write-Host "Doing a default `"$($Env:BUILD_TARGET)`" platform build."
} else {
  Write-Host "Using build profile `"$($Env:BUILD_PROFILE)`" relative to `"$($Env:UNITY_PROJECT_PATH)`"."
}

Write-Host "Using build path `"$($Env:BUILD_PATH)`" to save file `"$($Env:BUILD_FILE)`"."
$BuildPathFull = Join-Path $Env:GITHUB_WORKSPACE $Env:BUILD_PATH
$CustomBuildPath = Join-Path $BuildPathFull $Env:BUILD_FILE

#
# Set the build method, must reference one of:
#   - <NamespaceName.ClassName.MethodName>
#   - <ClassName.MethodName>
# For example: `BuildCommand.PerformBuild`
# The method must be declared static and placed in project/Assets/Editor
#
if ($Env:BUILD_METHOD) {
  Write-Host "Using build method `"$($Env:BUILD_METHOD)`"."
} else {
  Write-Host 'Using built-in build method.'

  $EditorDir = Join-Path $Env:UNITY_PROJECT_PATH 'Assets\Editor'
  if (-not (Test-Path $EditorDir)) {
    New-Item -ItemType Directory -Force -Path $EditorDir | Out-Null
  }

  # Copy the build script of Unity Builder action - dist/default-build-script
  # is the native (non-container) equivalent of the Docker image's
  # /UnityBuilderAction, mirroring MacBuilder's own native build.sh, which
  # already uses this same source.
  Copy-Item -Path (Join-Path $Env:ACTION_FOLDER 'default-build-script\Assets\Editor\*') -Destination $EditorDir -Recurse -Force

  $Env:BUILD_METHOD = 'UnityBuilderAction.Builder.BuildProject'

  Get-ChildItem -Path $EditorDir -Recurse
}

Write-Host ''
Write-Host '###########################'
Write-Host '#    Custom parameters    #'
Write-Host '###########################'
Write-Host ''
Write-Host "$($Env:CUSTOM_PARAMETERS)"

Write-Host ''
Write-Host '###########################'
Write-Host '#    Current build dir    #'
Write-Host '###########################'
Write-Host ''
Write-Host "Creating `"$BuildPathFull`" if it does not exist."
if (-not (Test-Path $BuildPathFull)) {
  New-Item -ItemType Directory -Force -Path $BuildPathFull | Out-Null
}
Get-ChildItem $BuildPathFull

Write-Host ''
Write-Host '###########################'
Write-Host '#    Project directory    #'
Write-Host '###########################'
Write-Host ''
Get-ChildItem $Env:UNITY_PROJECT_PATH

#
# Build
#
Write-Host ''
Write-Host '###########################'
Write-Host '#    Building project     #'
Write-Host '###########################'
Write-Host ''

# Reference: https://docs.unity3d.com/2019.3/Documentation/Manual/CommandLineArguments.html

# MANUAL_EXIT=true skips -quit so the build method can stay in play mode and
# call EditorApplication.Exit(0) itself (see game-ci/cli#13).
$QuitArgs = @('-quit')
if ($Env:MANUAL_EXIT -eq 'true') {
  $QuitArgs = @()
}

# BUILD_PROFILE (Unity 6) determines the target itself, so -buildTarget is
# omitted when one is set - matches real unity-builder's own handling.
$BuildTargetArgs = @('-buildTarget', $Env:BUILD_TARGET)
$BuildProfileArgs = @()
if ($Env:BUILD_PROFILE) {
  $BuildTargetArgs = @()
  $BuildProfileArgs = @('-activeBuildProfile', $Env:BUILD_PROFILE)
}

# CUSTOM_PARAMETERS is a single string of space-separated Unity CLI args -
# split into an array so it argv-splits the same way the bash version's
# unquoted $CUSTOM_PARAMETERS does, without going through Invoke-Expression
# (which would risk shell-injecting CUSTOM_PARAMETERS, a user-controlled
# input - same reasoning as the bash version's own comment on this).
$CustomParametersArray = @()
if ($Env:CUSTOM_PARAMETERS) {
  $CustomParametersArray = $Env:CUSTOM_PARAMETERS -split '\s+' | Where-Object { $_ -ne '' }
}

try {
  $UnityExePath = Get-UnityEditorExePath
  $LogPath = Join-Path $BuildPathFull 'build.log'

  Invoke-UnityLaunch -ExePath $UnityExePath @QuitArgs -batchmode -nographics `
    -logFile $LogPath `
    -customBuildName $Env:BUILD_NAME `
    -projectPath $Env:UNITY_PROJECT_PATH `
    @BuildTargetArgs `
    -customBuildTarget $Env:BUILD_TARGET `
    -customBuildPath $CustomBuildPath `
    -customBuildProfile $Env:BUILD_PROFILE `
    @BuildProfileArgs `
    -executeMethod $Env:BUILD_METHOD `
    -buildVersion $Env:VERSION `
    -androidVersionCode $Env:ANDROID_VERSION_CODE `
    -androidKeystoreName $Env:ANDROID_KEYSTORE_NAME `
    -androidKeystorePass $Env:ANDROID_KEYSTORE_PASS `
    -androidKeyaliasName $Env:ANDROID_KEYALIAS_NAME `
    -androidKeyaliasPass $Env:ANDROID_KEYALIAS_PASS `
    -androidTargetSdkVersion $Env:ANDROID_TARGET_SDK_VERSION `
    -androidExportType $Env:ANDROID_EXPORT_TYPE `
    -androidSymbolType $Env:ANDROID_SYMBOL_TYPE `
    @CustomParametersArray | Out-Host

  $global:BUILD_EXIT_CODE = $LASTEXITCODE
  if (Test-Path $LogPath) { Get-Content $LogPath | Out-Host }
} catch {
  Write-Host "Unity Editor could not be run: $($_.Exception.Message)"
  $global:BUILD_EXIT_CODE = 1
}

if ($global:BUILD_EXIT_CODE -eq 0) {
  Write-Host 'Build succeeded'
} else {
  Write-Host "Build failed, with exit code $($global:BUILD_EXIT_CODE)"
}

Write-Host ''
Write-Host '###########################'
Write-Host '#       Build output      #'
Write-Host '###########################'
Write-Host ''
Get-ChildItem $BuildPathFull
