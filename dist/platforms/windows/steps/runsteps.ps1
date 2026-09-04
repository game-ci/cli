#
# Run steps (native Windows host-mode equivalent of ../../ubuntu/steps/runsteps.sh)
#
# Genuinely native: no Docker container involved. Run directly by
# HostRunner (src/model/host-runner.ts, see its class doc comment) against
# a self-hosted Windows machine with Unity already installed via Unity Hub
# - NOT the dist/platforms/windows/*.ps1 Docker-container script set one
# directory up, which assumes a container-baked $Env:UNITY_PATH.
#
# Note that test.ps1 in this directory is shared with that container set:
# entrypoint.ps1's RUN_TESTS branch dot-sources it directly rather than
# duplicating the test flow, since $Env:UNITY_PATH is precisely what
# resolve_unity_path.ps1's Get-UnityEditorRoot checks first. Keep it free
# of host-only assumptions.
#
# $PSScriptRoot is this script's own directory, so sibling steps are always
# resolved correctly regardless of where dist/ was copied to - STEPS_DIR is
# only honored as an explicit override, matching the bash scripts' own
# STEPS_DIR-defaults-but-overridable convention.
#
$StepsDir = if ($Env:STEPS_DIR) { $Env:STEPS_DIR } else { $PSScriptRoot }

. (Join-Path $StepsDir 'set_extra_git_configs.ps1')
. (Join-Path $StepsDir 'set_gitcredential.ps1')

#
# Returns the license exactly once, however this script ends.
#
# Under the serial and .ulf strategies a missed return was survivable - a
# serial can be re-activated, and a .ulf is a file, not a seat. A Personal
# seat is neither: it stays consumed until returned, so a leaked one breaks
# every subsequent run on the account rather than just this one. That makes
# "return on the happy path only", which is all this script did before, an
# actual cascading failure mode now that free-tier users can activate.
#
# The build/test step is therefore wrapped in try/finally below, so the return
# also happens when that step throws or the job is cancelled.
#
$script:UnityLicenseReturned = $false

function Invoke-ReturnLicenseOnce {
  if ($script:UnityLicenseReturned) {
    return
  }
  $script:UnityLicenseReturned = $true

  . (Join-Path $StepsDir 'return_license.ps1')
}

# RETURN_LICENSE_ONLY=true (used by `game-ci return-license`, see game-ci/cli's
# ReturnLicenseCommand) is the counterpart to ACTIVATE_ONLY below: it releases
# a seat left active by an earlier `game-ci activate` and stops. No activation,
# no build.
if ($Env:RETURN_LICENSE_ONLY -eq 'true') {
  Invoke-ReturnLicenseOnce
  Remove-Item -Recurse -Force $Env:ACTIVATE_LICENSE_PATH -ErrorAction SilentlyContinue
  exit 0
}

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
try {
  if ($Env:RUN_TESTS -eq 'true') {
    . (Join-Path $StepsDir 'test.ps1')
    $StepExitCode = $global:TEST_RUNNER_EXIT_CODE
  } else {
    . (Join-Path $StepsDir 'build.ps1')
    $StepExitCode = $global:BUILD_EXIT_CODE
  }
} finally {
  # Runs before the activation directory is removed below (return_license.ps1
  # Push-Location's into it), and still runs if the step above threw.
  if ($Env:SKIP_ACTIVATION -ne 'true') {
    Invoke-ReturnLicenseOnce
  }
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
