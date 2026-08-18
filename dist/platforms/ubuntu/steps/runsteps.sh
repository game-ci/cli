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

# TEMPORARY: tracing every command to stderr while diagnosing a real CI
# failure where a Docker test run produces zero visible stdout before
# failing near-instantly (game-ci/cli - see the PR this landed in for
# context). Remove once root-caused.
set -x

source "$STEPS_DIR/set_extra_git_configs.sh"
source "$STEPS_DIR/set_gitcredential.sh"

if [ "$SKIP_ACTIVATION" != "true" ]; then
  source "$STEPS_DIR/activate.sh"

  # If we didn't activate successfully, exit with the exit code from the activation step.
  if [[ $UNITY_EXIT_CODE -ne 0 ]]; then
    exit $UNITY_EXIT_CODE
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

if [ "$SKIP_ACTIVATION" != "true" ]; then
  source "$STEPS_DIR/return_license.sh"
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
