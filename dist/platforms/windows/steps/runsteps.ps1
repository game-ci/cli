#
# Run steps (native Windows host-mode equivalent of ../../ubuntu/steps/runsteps.sh)
#
# Genuinely native: no Docker container involved. Run directly by
# HostRunner (src/model/host-runner.ts, see its class doc comment) against
# a self-hosted Windows machine with Unity already installed via Unity Hub
# - NOT the dist/platforms/windows/*.ps1 Docker-container script set one
# directory up, which assumes a container-baked $Env:UNITY_PATH and has no
# RUN_TESTS support at all.
#
# $PSScriptRoot is this script's own directory, so sibling steps are always
# resolved correctly regardless of where dist/ was copied to - STEPS_DIR is
# only honored as an explicit override, matching the bash scripts' own
# STEPS_DIR-defaults-but-overridable convention.
#
$StepsDir = if ($Env:STEPS_DIR) { $Env:STEPS_DIR } else { $PSScriptRoot }

. (Join-Path $StepsDir 'set_extra_git_configs.ps1')
. (Join-Path $StepsDir 'set_gitcredential.ps1')

if ($Env:SKIP_ACTIVATION -ne 'true') {
  . (Join-Path $StepsDir 'activate.ps1')

  # If we didn't activate successfully, exit with the exit code from the activation step.
  if ($global:UNITY_EXIT_CODE -ne 0) {
    exit $global:UNITY_EXIT_CODE
  }
} else {
  Write-Host 'Skipping activation'
}

# ACTIVATE_ONLY=true (used by `game-ci activate`, see game-ci/cli's
# ActivateCommand) activates and stops here - no build, and the license is
# deliberately left active for a later step to use, so no
# return_license.ps1 either.
if ($Env:ACTIVATE_ONLY -eq 'true') {
  Remove-Item -Recurse -Force $Env:ACTIVATE_LICENSE_PATH -ErrorAction SilentlyContinue
  exit $global:UNITY_EXIT_CODE
}

# RUN_TESTS=true (used by `game-ci test --docker --local`, see game-ci/cli's
# UnityTestCommand) runs the classic batchmode test flow instead of a
# build - same activation/license-return steps either way, only the middle
# step differs.
if ($Env:RUN_TESTS -eq 'true') {
  . (Join-Path $StepsDir 'test.ps1')
  $StepExitCode = $global:TEST_RUNNER_EXIT_CODE
} else {
  . (Join-Path $StepsDir 'build.ps1')
  $StepExitCode = $global:BUILD_EXIT_CODE
}

if ($Env:SKIP_ACTIVATION -ne 'true') {
  . (Join-Path $StepsDir 'return_license.ps1')
}

#
# Remove license activation directory
#

Remove-Item -Recurse -Force $Env:ACTIVATE_LICENSE_PATH -ErrorAction SilentlyContinue

#
# Instructions for debugging
#

if ($StepExitCode -gt 0) {
  Write-Host ''
  Write-Host '###########################'
  Write-Host '#         Failure         #'
  Write-Host '###########################'
  Write-Host ''
  Write-Host 'Please note that the exit code is not very descriptive.'
  Write-Host 'Most likely it will not help you solve the issue.'
  Write-Host ''
  Write-Host 'To find the reason for failure: please search for errors in the log above.'
  Write-Host ''
}

#
# Exit with code from the build/test step.
#

exit $StepExitCode
