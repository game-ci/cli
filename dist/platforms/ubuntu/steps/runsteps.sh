#!/usr/bin/env bash

#
# Run steps
#
# STEPS_DIR defaults to /steps (the Docker container mount point). Host-mode
# execution (no Docker, see src/model/host-runner.ts) runs this script
# directly against the real filesystem and overrides STEPS_DIR to point at
# the CLI's own dist/platforms/ubuntu/steps instead - everything else in
# this file is unchanged either way.
#
STEPS_DIR="${STEPS_DIR:-/steps}"

source "$STEPS_DIR/set_extra_git_configs.sh"
source "$STEPS_DIR/set_gitcredential.sh"

#
# Returns the license exactly once, however this script ends.
#
# Under the serial and .ulf strategies a missed return was survivable - a
# serial can be re-activated, and a .ulf is a file, not a seat. A Personal
# seat is neither: it stays consumed until returned, so a leaked one breaks
# every subsequent run on the account rather than just this one. That makes
# "return on the happy path only", which is all this script did before, an
# actual cascading failure mode once free-tier users arrive.
#
# So the return is armed as an EXIT trap instead - it covers the paths the
# straight-line call missed: a hard exit inside build.sh/test.sh, `set -e`,
# and SIGINT/SIGTERM from a cancelled job.
#
# It has to live here in the shell rather than in the CLI: the TypeScript
# side handles SIGINT with a bare process.exit(130) (src/core/logger/index.ts),
# which pre-empts any JS cleanup handler.
#
UNITY_LICENSE_RETURNED=false

return_license_once() {
  if [ "$UNITY_LICENSE_RETURNED" = "true" ]; then
    return 0
  fi
  UNITY_LICENSE_RETURNED=true

  source "$STEPS_DIR/return_license.sh"
}

# RETURN_LICENSE_ONLY=true (used by `game-ci return-license`, see game-ci/cli's
# ReturnLicenseCommand) is the counterpart to ACTIVATE_ONLY below: it releases
# a seat left active by an earlier `game-ci activate` and stops. No activation,
# no build.
if [ "$RETURN_LICENSE_ONLY" = "true" ]; then
  return_license_once
  rm -r "$ACTIVATE_LICENSE_PATH"
  exit 0
fi

if [ "$SKIP_ACTIVATION" != "true" ]; then
  source "$STEPS_DIR/activate.sh"

  # If we didn't activate successfully, exit with the exit code from the activation step.
  if [[ $UNITY_EXIT_CODE -ne 0 ]]; then
    exit $UNITY_EXIT_CODE
  fi

  # Armed only after activation actually succeeded, and never for
  # ACTIVATE_ONLY, which deliberately hands the live license to a later step.
  if [ "$ACTIVATE_ONLY" != "true" ]; then
    trap return_license_once EXIT
  fi
else
  echo "Skipping activation"
fi

# ACTIVATE_ONLY=true (used by `game-ci activate`, see game-ci/cli's ActivateCommand)
# activates and stops here - no build, and the license is deliberately left
# active for a later step to use, so no return_license.sh either.
if [ "$ACTIVATE_ONLY" = "true" ]; then
  rm -r "$ACTIVATE_LICENSE_PATH"
  exit $UNITY_EXIT_CODE
fi

# RUN_TESTS=true (used by `game-ci test --docker`, see game-ci/cli's
# UnityTestCommand) runs the classic Docker/Hub-image-driven Unity batchmode
# test flow instead of a build - same activation/license-return steps either
# way, only the middle step differs.
if [ "$RUN_TESTS" = "true" ]; then
  source "$STEPS_DIR/test.sh"
  STEP_EXIT_CODE=$TEST_RUNNER_EXIT_CODE
else
  source "$STEPS_DIR/build.sh"
  STEP_EXIT_CODE=$BUILD_EXIT_CODE
fi

# Still returned here on the happy path rather than being left to the trap, so
# it happens before the activation directory is removed below (return_license.sh
# pushd's into it) and before the failure banner. The trap is the safety net for
# the paths that never reach this line.
if [ "$SKIP_ACTIVATION" != "true" ]; then
  return_license_once
fi

#
# Remove license activation directory
#

rm -r "$ACTIVATE_LICENSE_PATH"

#
# Instructions for debugging
#

if [[ $STEP_EXIT_CODE -gt 0 ]]; then
echo ""
echo "###########################"
echo "#         Failure         #"
echo "###########################"
echo ""
echo "Please note that the exit code is not very descriptive."
echo "Most likely it will not help you solve the issue."
echo ""
echo "To find the reason for failure: please search for errors in the log above."
echo ""
fi;

#
# Exit with code from the build/test step.
#

exit $STEP_EXIT_CODE
