#
# Set project path
#
$Env:UNITY_PROJECT_PATH="$Env:GITHUB_WORKSPACE\$Env:PROJECT_PATH"
Write-Output "$('Using project path "')$($Env:UNITY_PROJECT_PATH)$('".')"

#
# Display the name for the build, doubles as the output name
#

Write-Output "$('Using build name "')$($Env:BUILD_NAME)$('".')"

#
# Display the build's target platform;
#

Write-Output "$('Using build target "')$($Env:BUILD_TARGET)$('".')"

#
# Display the build profile
#

if (-not $Env:BUILD_PROFILE) {
    Write-Output "$('Doing a default "')$($Env:BUILD_TARGET)$('" platform build.')"
} else {
    Write-Output "$('Using build profile "')$($Env:BUILD_PROFILE)$('" relative to "')$($Env:UNITY_PROJECT_PATH)$('".')"
}

#
# Display build path and file
#

Write-Output "$('Using build path "')$($Env:BUILD_PATH)$('" to save file "')$($Env:BUILD_FILE)$('".')"
$Env:BUILD_PATH_FULL="$Env:GITHUB_WORKSPACE\$Env:BUILD_PATH"
$Env:CUSTOM_BUILD_PATH="$Env:BUILD_PATH_FULL\$Env:BUILD_FILE"

#
# Set the build method, must reference one of:
#
#   - <NamespaceName.ClassName.MethodName>
#   - <ClassName.MethodName>
#
# For example: `BuildCommand.PerformBuild`
#
# The method must be declared static and placed in project/Assets/Editor
#
if ($Env:BUILD_METHOD)
{
    # User has provided their own build method.
    # Assume they also bring their own script.
    Write-Output "$('Using build method "')$($Env:BUILD_METHOD)$('".')"
}
else
{
    # User has not provided their own build command.
    #
    # Use the script from this action which builds the scenes that are enabled in
    # the project.
    #
    Write-Output "Using built-in build method."

    # Create Editor directory if it does not exist
    if(-Not (Test-Path -Path $Env:UNITY_PROJECT_PATH\Assets\Editor))
    {
        # We use -Force to suppress output, doesn't overwrite anything
        New-Item -ItemType Directory -Force -Path $Env:UNITY_PROJECT_PATH\Assets\Editor
    }

    # Copy the build script of Unity Builder action
    # -Force: without it, a retry (e.g. after a transient Unity crash) fails
    # outright since the destination subdirectories already exist from the
    # first attempt - "An item with the specified name ... already exists"
    # for every already-copied file, masking the real retry attempt behind
    # a wall of Copy-Item errors. Matches steps/build.ps1's (the native,
    # non-container path) already-correct -Force usage for the same copy.
    Copy-Item -Path "c:\UnityBuilderAction" -Destination $Env:UNITY_PROJECT_PATH\Assets\Editor -Recurse -Force

    # Set the Build method to that of UnityBuilder Action
    $Env:BUILD_METHOD="UnityBuilderAction.Builder.BuildProject"

    # Verify recursive paths
    Get-ChildItem -Path $Env:UNITY_PROJECT_PATH\Assets\Editor -Recurse
}

#
# Pre-build debug information
#

Write-Output ""
Write-Output "###########################"
Write-Output "#    Custom parameters    #"
Write-Output "###########################"
Write-Output ""

Write-Output "$('"')$($Env:CUSTOM_PARAMETERS)$('"')"

Write-Output ""
Write-Output "###########################"
Write-Output "#    Current build dir    #"
Write-Output "###########################"
Write-Output ""

Write-Output "$('Creating "')$($Env:BUILD_PATH_FULL)$('" if it does not exist.')"
if (-Not (Test-Path -Path $Env:BUILD_PATH_FULL))
{
    mkdir "$Env:BUILD_PATH_FULL"
}
Get-ChildItem $Env:BUILD_PATH_FULL

Write-Output ""
Write-Output "###########################"
Write-Output "#    Project directory    #"
Write-Output "###########################"
Write-Output ""

Get-ChildItem $Env:UNITY_PROJECT_PATH

#
# Build
#

Write-Output ""
Write-Output "###########################"
Write-Output "#    Building project     #"
Write-Output "###########################"
Write-Output ""

# If $Env:CUSTOM_PARAMETERS contains spaces and is passed directly on the command line to Unity, powershell will wrap it
# in double quotes.  To avoid this, parse $Env:CUSTOM_PARAMETERS into an array, while respecting any quotations within the string.
$_, $customParametersArray = Invoke-Expression('Write-Output -- "" ' + $Env:CUSTOM_PARAMETERS)

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

# UNITY_PATH is baked into unityci/editor windows images at build time
# (setx -M UNITY_PATH "C:/UnityEditor/$version" - see game-ci/docker's
# images/windows/editor/Dockerfile). Unity Hub's default install location
# ("C:\Program Files\Unity\Hub\Editor\<version>") is never used - these
# images install to C:/UnityEditor instead (game-ci/cli#77).
& "$Env:UNITY_PATH\Editor\Unity.exe" @QuitArgs -batchmode -nographics `
                                                                          -projectPath $Env:UNITY_PROJECT_PATH `
                                                                          -executeMethod $Env:BUILD_METHOD `
                                                                          @BuildTargetArgs `
                                                                          -customBuildTarget $Env:BUILD_TARGET `
                                                                          -customBuildPath $Env:CUSTOM_BUILD_PATH `
                                                                          -customBuildProfile $Env:BUILD_PROFILE `
                                                                          @BuildProfileArgs `
                                                                          -buildVersion $Env:VERSION `
                                                                          -androidVersionCode $Env:ANDROID_VERSION_CODE `
                                                                          -androidKeystoreName $Env:ANDROID_KEYSTORE_NAME `
                                                                          -androidKeystorePass $Env:ANDROID_KEYSTORE_PASS `
                                                                          -androidKeyaliasName $Env:ANDROID_KEYALIAS_NAME `
                                                                          -androidKeyaliasPass $Env:ANDROID_KEYALIAS_PASS `
                                                                          -androidTargetSdkVersion $Env:ANDROID_TARGET_SDK_VERSION `
                                                                          -androidExportType $Env:ANDROID_EXPORT_TYPE `
                                                                          -androidSymbolType $Env:ANDROID_SYMBOL_TYPE `
                                                                          $customParametersArray `
                                                                          -logfile | Out-Host

# Catch exit code
$Env:BUILD_EXIT_CODE=$LastExitCode

# Display results
if ($Env:BUILD_EXIT_CODE -eq 0)
{
    Write-Output "Build Succeeded!"
} else
{
    Write-Output "$('Build failed, with exit code ')$($Env:BUILD_EXIT_CODE)$('"')"
}

# TODO: Determine if we need to set permissions on any files

#
# Results
#

Write-Output ""
Write-Output "###########################"
Write-Output "#       Build output      #"
Write-Output "###########################"
Write-Output ""

Get-ChildItem $Env:BUILD_PATH_FULL
Write-Output ""
