# Copy .upmconfig.toml if it exists
if (Test-Path "C:\githubhome\.upmconfig.toml") {
  Write-Host "Copying .upmconfig.toml to $Env:USERPROFILE\.upmconfig.toml"
  Copy-Item -Path "C:\githubhome\.upmconfig.toml" -Destination "$Env:USERPROFILE\.upmconfig.toml" -Force
} else {
  Write-Host "No .upmconfig.toml found at C:\githubhome"
}

# Import any necessary registry keys, ie: location of windows 10 sdk
# No guarantee that there will be any necessary registry keys, ie: tvOS
Get-ChildItem -Path c:\registry-keys -File | ForEach-Object {reg import $_.fullname}

# Register the Visual Studio installation so Unity can find it
regsvr32 C:\ProgramData\Microsoft\VisualStudio\Setup\x64\Microsoft.VisualStudio.Setup.Configuration.Native.dll

# Install Visual C++ 2013 Redistributables - Unity fails on some GitHub
# Actions Windows runners without this (see game-ci/cli#65, item 5).
& "c:\steps\install_vcredist13.ps1"

# Setup Git Credentials
& "c:\steps\set_gitcredential.ps1"

if ($Env:ENABLE_GPU -eq "true") {
  # Install LLVMpipe software graphics driver
  & "c:\steps\install_llvmpipe.ps1"
}

# Activate Unity
#
# $Env:ACTIVATE_LICENSE_PATH was never set here at all - activate.ps1 and
# return_license.ps1 (both -projectPath and their own "Changing to ..."
# directory) always saw it empty, which is what "CreateDirectory ...
# AppData/Local/Unity/Caches failed" and "Unclassified error occured while
# trying to activate license." actually meant the whole time (confirmed
# live on unity-builder#844's Windows CI - #180 fixed activate.ps1's own
# missing $Env: prefix, but that alone can't help when the variable itself
# is never populated). Mirrors mac/entrypoint.sh's own
# ACTIVATE_LICENSE_PATH="$ACTION_FOLDER/BlankProject" + mkdir -p pattern -
# a scratch directory Unity can use as -projectPath purely to activate/
# return the license against, distinct from the real project.
#
# Returns the license exactly once, however this script ends.
#
# A Personal seat stays consumed until returned, unlike a serial
# (re-activatable) or a .ulf (a file, not a seat), so a missed return breaks
# every later run on the account. See steps/runsteps.ps1's fuller comment.
#
$script:UnityLicenseReturned = $false

function Invoke-ReturnLicenseOnce {
  if ($script:UnityLicenseReturned) {
    return
  }
  $script:UnityLicenseReturned = $true

  & "c:\steps\return_license.ps1"
}

# RETURN_LICENSE_ONLY=true (used by `game-ci return-license`) is the
# counterpart to ACTIVATE_ONLY below: it releases a seat left active by an
# earlier `game-ci activate` and stops.
if ($Env:RETURN_LICENSE_ONLY -eq "true") {
  $Env:ACTIVATE_LICENSE_PATH = "c:\ActivateLicense"
  New-Item -ItemType Directory -Force -Path $Env:ACTIVATE_LICENSE_PATH | Out-Null

  Invoke-ReturnLicenseOnce
  Remove-Item -Recurse -Force $Env:ACTIVATE_LICENSE_PATH -ErrorAction SilentlyContinue
  exit 0
}

if ($Env:SKIP_ACTIVATION -ne "true") {
  $Env:ACTIVATE_LICENSE_PATH = "c:\ActivateLicense"
  New-Item -ItemType Directory -Force -Path $Env:ACTIVATE_LICENSE_PATH | Out-Null
  & "c:\steps\activate.ps1"
} else {
  Write-Host "Skipping activation"
}

# ACTIVATE_ONLY=true (used by `game-ci activate`) activates and stops here -
# no build, and the license is deliberately left active for a later step to
# use, so no return_license.ps1 either (and no cleanup of
# ACTIVATE_LICENSE_PATH, matching mac/entrypoint.sh's same carve-out).
if ($Env:ACTIVATE_ONLY -eq "true") {
  exit $LASTEXITCODE
}

# RUN_TESTS=true (used by `game-ci test --docker`, see game-ci/cli's
# UnityTestCommand) runs the classic batchmode test flow instead of a build -
# same activation/license-return steps either way, only the middle step
# differs. Mirrors ubuntu/steps/runsteps.sh's own RUN_TESTS branch.
#
# The test implementation is deliberately NOT duplicated into this
# container script set. steps/test.ps1 (the native-host set, one directory
# down) is already container-safe: the only container/host difference that
# ever mattered is how the Unity Editor is located, and its
# resolve_unity_path.ps1 already honours the image-baked $Env:UNITY_PATH
# as-is (see Get-UnityEditorRoot) before falling back to the Unity Hub
# default. Docker.getWindowsCommand mounts the whole
# dist/platforms/windows directory at c:\steps, so that script is already
# present at c:\steps\steps\test.ps1 - no extra volume needed. The doubled
# "steps\steps" path is that mount's artifact, not a typo.
#
# Dot-sourced rather than called with & so the $global:TEST_RUNNER_EXIT_CODE
# it sets is visible here; build.ps1 communicates via $Env: instead, which
# crosses the & call boundary on its own.
try {
  if ($Env:RUN_TESTS -eq "true") {
    . "c:\steps\steps\test.ps1"
    $StepExitCode = [int]$global:TEST_RUNNER_EXIT_CODE
  } else {
    & "c:\steps\build.ps1"
    $StepExitCode = [int]$Env:BUILD_EXIT_CODE
  }
} finally {
  # Free the seat for the activated license - in a finally so it still happens
  # when the build/test step above throws or the job is cancelled.
  if ($Env:SKIP_ACTIVATION -ne "true") {
    Invoke-ReturnLicenseOnce
    Remove-Item -Recurse -Force $Env:ACTIVATE_LICENSE_PATH -ErrorAction SilentlyContinue
  }
}

#
# Instructions for debugging - matches ubuntu/steps/runsteps.sh's own block.
#

if ($StepExitCode -gt 0) {
  Write-Host ""
  Write-Host "###########################"
  Write-Host "#         Failure         #"
  Write-Host "###########################"
  Write-Host ""
  Write-Host "Please note that the exit code is not very descriptive."
  Write-Host "Most likely it will not help you solve the issue."
  Write-Host ""
  Write-Host "To find the reason for failure: please search for errors in the log above."
  Write-Host ""
}

#
# Exit with the code from the build/test step.
#
# Previously this script just fell off the end, so the container's exit code
# was whatever the last command (return_license.ps1) happened to leave
# behind - a build/test failure could therefore surface as a *successful*
# container run. Builds were saved from that by
# UnityBuildValidation.validateBuild parsing the log output, but a test run
# has no equivalent output check, so propagate the real code explicitly.
#

exit $StepExitCode
